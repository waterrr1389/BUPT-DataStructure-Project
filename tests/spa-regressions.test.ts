import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createJsonResponse,
  createSpaDomEnvironment,
  dispatchDomEvent,
  importSpaModule,
  requireElement,
  settleAsync,
} from "./support/spa-harness";

type Cleanup = (() => void) | null | void;

type PostDetailModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type ExploreModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type MapModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type ComposeModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type HomeModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type FeedModule = {
  render(app: Record<string, unknown>, route: Record<string, unknown>, root: unknown): Promise<Cleanup>;
};

type AppShellModule = {
  createAppShell(root: unknown): {
    dom: {
      viewRoot: unknown;
    };
    fetchFeed(filters?: Record<string, unknown>): Promise<unknown>;
    fetchJournalComments(
      journalId: string,
      options?: { cursor?: string; limit?: number },
    ): Promise<CommentResponse>;
    navigate(href: string, options?: Record<string, unknown>): void;
    start(): Promise<void>;
    state: {
      bootstrap: unknown;
      bootstrapPromise: Promise<unknown> | null;
    };
  };
};

type JournalComment = {
  body: string;
  createdAt: string;
  id: string;
  userId: string;
};

type CommentResponse = {
  available: boolean;
  items: JournalComment[];
  nextCursor: string;
  notice: string;
  totalCount: number;
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function expectRejects(run: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.equal(pattern.test(message), true, message);
    return;
  }
  throw new Error(`Expected rejection matching ${pattern}.`);
}

function createComment(index: number): JournalComment {
  return {
    body: `Comment ${index}`,
    createdAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
    id: `comment-${index}`,
    userId: index % 2 === 0 ? "user-2" : "user-1",
  };
}

function createCommentPage(start: number, count: number, nextCursor: string, totalCount = 23): CommentResponse {
  return {
    available: true,
    items: Array.from({ length: count }, (_, offset) => createComment(start + offset)),
    nextCursor,
    notice: "",
    totalCount,
  };
}

function buildHref(pathname: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(pathname, "http://localhost");
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return `${url.pathname}${url.search}`;
}

function compactText(node: { innerHTML?: string; textContent?: string | null }) {
  const source = (node.textContent ?? "") || node.innerHTML || "";
  return source
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createPostDetailFixture(overrides: { commentPages?: CommentResponse[] } = {}) {
  const bootstrap = {
    users: [
      { id: "user-1", name: "Avery Vale" },
      { id: "user-2", name: "Mina Hart" },
    ],
  };
  const detailCalls: Array<{ journalId: string; viewerUserId: string }> = [];
  const commentCalls: Array<{ cursor: string; journalId: string; limit: number }> = [];
  const commentPages = overrides.commentPages ?? [
    createCommentPage(1, 5, "cursor-2"),
    createCommentPage(6, 5, "cursor-3"),
    createCommentPage(1, 5, "cursor-2", 24),
  ];
  let commentPageIndex = 0;
  const createCommentCalls: Array<{ body: string; journalId: string; userId: string }> = [];
  const actionCalls: Array<{ action: string; journalId: string; userId: string }> = [];
  const navigateCalls: Array<{ href: string; options?: Record<string, unknown> }> = [];
  const statuses: Array<{ message: string; tone: string }> = [];
  let views = 14;
  let ratings = [{ userId: "user-1", score: 4 }];

  function averageRating() {
    return ratings.reduce((total, entry) => total + entry.score, 0) / ratings.length;
  }

  const app = {
    state: {
      mapScenes: new Map(),
    },
    async createComment(journalId: string, userId: string, body: string) {
      createCommentCalls.push({ body, journalId, userId });
      return { available: true, item: { id: "comment-new" }, notice: "" };
    },
    buildMapHref(params: Record<string, string>) {
      return buildHref("/map", params);
    },
    buildPostHref(journalId: string, params: { actor?: string }) {
      return buildHref(`/posts/${journalId}`, params);
    },
    async ensureDestinationDetails() {
      return {
        graph: {
          nodes: [],
        },
      };
    },
    async fetchJournalComments(journalId: string, options: { cursor?: string; limit?: number }) {
      commentCalls.push({
        cursor: options.cursor ?? "",
        journalId,
        limit: Number(options.limit) || 0,
      });
      const page = commentPages[commentPageIndex];
      commentPageIndex += 1;
      if (!page) {
        throw new Error("Unexpected comment page request");
      }
      return page;
    },
    async fetchJournalDetail(journalId: string, options: { viewerUserId?: string }) {
      detailCalls.push({
        journalId,
        viewerUserId: options.viewerUserId ?? "",
      });
      return {
        averageRating: averageRating(),
        body: "Quiet bridge walk.\n\nSecond paragraph.",
        commentCount: commentPageIndex >= 3 ? 24 : 23,
        createdAt: "2026-03-01T10:00:00.000Z",
        destinationId: "dest-1",
        id: journalId,
        likeCount: 2,
        media: [],
        ratings,
        tags: ["bridge", "tea"],
        title: "Bridge Notes",
        updatedAt: "2026-03-02T11:00:00.000Z",
        userId: "user-1",
        viewerHasLiked: false,
        views,
      };
    },
    fillSelect() {
      return null;
    },
    getBootstrap() {
      return bootstrap;
    },
    getDestinationName(destinationId: string) {
      return destinationId === "dest-1" ? "Harbor Reach" : destinationId;
    },
    getUserName(userId: string) {
      return bootstrap.users.find((user) => user.id === userId)?.name ?? userId;
    },
    async loadBootstrap() {
      return bootstrap;
    },
    navigate(href: string, options?: Record<string, unknown>) {
      navigateCalls.push({ href, options });
    },
    async sendJournalAction(action: string, journalId: string, userId: string) {
      actionCalls.push({ action, journalId, userId });
      if (action === "view") {
        views += 1;
      }
      if (action === "rate") {
        ratings = ratings.concat({ userId, score: 5 });
      }
      return { available: true, notice: "", payload: null };
    },
    setDocumentTitle() {},
    setStatus(message: string, tone = "neutral") {
      statuses.push({ message, tone });
    },
    tagsMarkup(tags: string[]) {
      return tags.length ? `<div class="tag-row">${tags.join(",")}</div>` : "";
    },
  };

  return {
    app,
    actionCalls,
    createCommentCalls,
    detailCalls,
    commentCalls,
    navigateCalls,
    statuses,
  };
}

function createComposeFixture() {
  const bootstrap = {
    users: [
      { id: "user-1", name: "Avery Vale" },
      { id: "user-2", name: "Mina Hart" },
    ],
  };
  const destinationOptions = [
    { id: "dest-1", label: "Harbor Reach" },
    { id: "dest-2", label: "Amber Bay" },
  ];
  const navigateCalls: string[] = [];
  const requestJsonCalls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];

  const app = {
    applySelectorBindings(
      root: { querySelector(selector: string): { innerHTML: string } | null },
      bindings?: Array<{ config?: { label?: string }; items: Array<Record<string, string>>; selector: string }>,
    ) {
      (bindings ?? []).forEach(({ config, items, selector }) => {
        const element = root.querySelector(selector);
        if (!element) {
          return;
        }
        const labelKey = config?.label ?? "name";
        element.innerHTML = items
          .map((item) => `<option value="${item.id}">${item[labelKey] ?? item.name ?? item.id}</option>`)
          .join("");
      });
    },
    buildPostHref(journalId: string, params: { actor?: string }) {
      return params.actor ? `/posts/${journalId}?actor=${params.actor}` : `/posts/${journalId}`;
    },
    getDestinationName(destinationId: string) {
      return destinationOptions.find((destination) => destination.id === destinationId)?.label ?? destinationId;
    },
    getDestinationOptions() {
      return destinationOptions;
    },
    getJournalBindings() {
      return {
        selectorBindings: [
          {
            config: { label: "label" },
            items: destinationOptions,
            selector: "#compose-destination",
          },
        ],
      };
    },
    getUserName(userId: string) {
      return bootstrap.users.find((user) => user.id === userId)?.name ?? userId;
    },
    async loadBootstrap() {
      return bootstrap;
    },
    navigate(href: string) {
      navigateCalls.push(href);
    },
    async requestJson(endpoint: string, options: { body?: string }) {
      requestJsonCalls.push({
        endpoint,
        payload: JSON.parse(options.body ?? "{}"),
      });
      return {
        item: {
          id: "journal-9",
        },
      };
    },
    setDocumentTitle() {},
  };

  return {
    app,
    navigateCalls,
    requestJsonCalls,
  };
}

function createExploreFixture(overrides: {
  destinationOptions?: Array<{ id: string; label?: string; name: string }>;
  ensureDestinationDetailsImpl?: (destinationId: string) => Promise<Record<string, unknown>>;
  requestJsonImpl?: (endpoint: string) => Promise<Record<string, unknown>>;
} = {}) {
  const bootstrap = {
    users: [{ id: "user-1", name: "Avery Vale" }],
  };
  const destinationOptions = overrides.destinationOptions ?? [{ id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" }];
  const ensureDestinationDetailsCalls: string[] = [];
  const requestJsonCalls: string[] = [];
  const statuses: Array<{ message: string; tone: string }> = [];

  const app = {
    applySelectorBindings(
      root: { querySelector(selector: string): { innerHTML: string } | null },
      bindings?: Array<{ config?: { label?: string }; items: Array<Record<string, string>>; selector: string }>,
    ) {
      (bindings ?? []).forEach(({ config, items, selector }) => {
        const element = root.querySelector(selector);
        if (!element) {
          return;
        }
        const labelKey = config?.label ?? "name";
        element.innerHTML = items
          .map((item) => `<option value="${item.id}">${item[labelKey] ?? item.name ?? item.id}</option>`)
          .join("");
      });
    },
    buildMapHref(params: Record<string, string>) {
      return buildHref("/map", params);
    },
    debounce(callback: () => void) {
      const wrapped = () => callback();
      wrapped.cancel = () => {};
      return wrapped;
    },
    async ensureDestinationDetails(destinationId: string) {
      ensureDestinationDetailsCalls.push(destinationId);
      if (overrides.ensureDestinationDetailsImpl) {
        return overrides.ensureDestinationDetailsImpl(destinationId);
      }
      return {
        graph: {
          nodes: [
            { id: "dest-1-node-a", name: "Atrium" },
            { id: "dest-1-node-b", name: "Bridge" },
          ],
        },
      };
    },
    getCategories() {
      return ["museum"];
    },
    getCuisines() {
      return ["tea"];
    },
    getDestinationBindings() {
      return {
        selectorBindings: [
          {
            config: { label: "label" },
            items: destinationOptions,
            selector: "#explore-facility-destination",
          },
          {
            config: { label: "label" },
            items: destinationOptions,
            selector: "#explore-food-destination",
          },
        ],
      };
    },
    getDestinationOptions() {
      return destinationOptions;
    },
    getFeaturedDestinations() {
      return [
        {
          categories: ["museum"],
          description: "Dockside reading rooms.",
          heat: 88,
          id: "dest-1",
          name: "Harbor Reach",
          nodeCount: 12,
          rating: 4.8,
          region: "North Wharf",
          type: "campus",
        },
      ];
    },
    async loadBootstrap() {
      return bootstrap;
    },
    async requestJson(endpoint: string) {
      requestJsonCalls.push(endpoint);
      if (overrides.requestJsonImpl) {
        return overrides.requestJsonImpl(endpoint);
      }
      if (endpoint.startsWith("/api/foods/recommendations?")) {
        return { items: [] };
      }
      throw new Error(`Unexpected request: ${endpoint}`);
    },
    setDocumentTitle() {},
    setStatus(message: string, tone = "neutral") {
      statuses.push({ message, tone });
    },
    tagsMarkup(tags: string[]) {
      return tags.length ? `<div class="tag-row">${tags.join(",")}</div>` : "";
    },
  };

  return {
    app,
    ensureDestinationDetailsCalls,
    requestJsonCalls,
    statuses,
  };
}

function createMapFixture(overrides: {
  ensureDestinationDetailsImpl?: (destinationId: string) => Promise<Record<string, unknown>>;
  requestJsonImpl?: (endpoint: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
} = {}) {
  const destinationOptions = [
    { id: "dest-1", name: "Harbor Reach" },
    { id: "dest-2", name: "Lantern Point" },
  ];
  const detailsById = new Map([
    [
      "dest-1",
      {
        buildings: [],
        graph: {
          edges: [{ from: "dest-1-node-a", id: "edge-a-b", roadType: "walkway", to: "dest-1-node-b" }],
          nodes: [
            { floor: 0, id: "dest-1-node-a", kind: "gate", name: "Atrium", x: 0, y: 0 },
            { floor: 0, id: "dest-1-node-b", kind: "plaza", name: "Bridge", x: 40, y: 20 },
          ],
        },
        id: "dest-1",
        name: "Harbor Reach",
      },
    ],
    [
      "dest-2",
      {
        buildings: [],
        graph: {
          edges: [{ from: "dest-2-node-a", id: "edge-c-d", roadType: "walkway", to: "dest-2-node-b" }],
          nodes: [
            { floor: 0, id: "dest-2-node-a", kind: "gate", name: "Garden", x: 10, y: 10 },
            { floor: 0, id: "dest-2-node-b", kind: "plaza", name: "Lookout", x: 60, y: 30 },
          ],
        },
        id: "dest-2",
        name: "Lantern Point",
      },
    ],
  ]);
  const ensureDestinationDetailsCalls: string[] = [];
  const navigateCalls: Array<{ href: string; options: Record<string, unknown> }> = [];
  const requestJsonCalls: string[] = [];
  const statuses: Array<{ message: string; tone: string }> = [];

  const app = {
    applySelectorBindings(
      root: { querySelector(selector: string): { innerHTML: string } | null },
      bindings?: Array<{ items: Array<{ id: string; name: string }>; selector: string }>,
    ) {
      (bindings ?? []).forEach(({ items, selector }) => {
        const element = root.querySelector(selector);
        if (!element) {
          return;
        }
        element.innerHTML = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
      });
    },
    buildMapHref(params: Record<string, string>) {
      const url = new URL("/map", "http://localhost");
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
      return `${url.pathname}${url.search}`;
    },
    debounce(callback: () => void) {
      const wrapped = () => callback();
      wrapped.cancel = () => {};
      return wrapped;
    },
    async ensureDestinationDetails(destinationId: string) {
      ensureDestinationDetailsCalls.push(destinationId);
      if (overrides.ensureDestinationDetailsImpl) {
        return overrides.ensureDestinationDetailsImpl(destinationId);
      }
      const details = detailsById.get(destinationId);
      if (!details) {
        throw new Error(`Unknown destination: ${destinationId}`);
      }
      return details;
    },
    getDestinationBindings() {
      return {
        selectorBindings: [
          {
            items: destinationOptions,
            selector: "#map-destination",
          },
        ],
      };
    },
    getDestinationOptions() {
      return destinationOptions;
    },
    async loadBootstrap() {
      return {};
    },
    navigate(href: string, options: Record<string, unknown>) {
      navigateCalls.push({ href, options });
    },
    async requestJson(endpoint: string, options?: Record<string, unknown>) {
      requestJsonCalls.push(endpoint);
      if (overrides.requestJsonImpl) {
        return overrides.requestJsonImpl(endpoint, options);
      }
      return {
        item: {
          destinationId: "dest-1",
          destinationName: "Harbor Reach",
          mode: "walk",
          nodeNames: [
            { id: "dest-1-node-a", name: "Atrium" },
            { id: "dest-1-node-b", name: "Bridge" },
          ],
          nodeIds: ["dest-1-node-a", "dest-1-node-b"],
          reachable: true,
          steps: [{ from: "dest-1-node-a", mode: "walk", to: "dest-1-node-b" }],
          strategy: "distance",
          totalCost: 1,
          totalDistance: 40,
        },
      };
    },
    setDocumentTitle() {},
    setStatus(message: string, tone = "neutral") {
      statuses.push({ message, tone });
    },
    state: {
      mapScenes: new Map(),
    },
  };

  return {
    app,
    ensureDestinationDetailsCalls,
    navigateCalls,
    requestJsonCalls,
    statuses,
  };
}

function createHomeFixture() {
  const bootstrap = {
    destinations: [{ id: "dest-1" }],
    featured: [{ id: "dest-1" }],
    users: [{ id: "user-1", name: "Avery Vale" }],
  };
  const fetchFeedCalls: Array<Record<string, unknown>> = [];
  const featuredDestinations = [
    {
      description: "Dockside reading rooms.",
      heat: 88,
      id: "dest-1",
      name: "Harbor Reach",
      nodeCount: 12,
      rating: 4.8,
      region: "North Wharf",
      type: "campus",
    },
  ];
  const app = {
    createJournalCard(item: { id: string; title: string }) {
      return `
        <article class="result-card" data-journal-id="${item.id}">
          <h3>${item.title}</h3>
          <div class="actions">
            <button type="button" data-action="view">Add view</button>
            <button type="button" data-action="rate">Rate 5</button>
          </div>
        </article>
      `;
    },
    async fetchFeed(options: Record<string, unknown>) {
      fetchFeedCalls.push(options);
      return {
        items: [{ id: "journal-1", title: "Bridge Notes" }],
        notice: "",
      };
    },
    getFeaturedDestinations() {
      return featuredDestinations;
    },
    async loadBootstrap() {
      return bootstrap;
    },
    setDocumentTitle() {},
  };

  return {
    app,
    fetchFeedCalls,
  };
}

function createFeedFixture() {
  const bootstrap = {
    users: [
      { id: "user-1", name: "Avery Vale" },
      { id: "user-2", name: "Mina Hart" },
    ],
  };
  const destinationOptions = [{ id: "dest-1", name: "Harbor Reach", label: "Harbor Reach" }];
  const fetchFeedCalls: Array<Record<string, unknown>> = [];
  const fetchRecommendedCalls: Array<Record<string, unknown>> = [];
  const requestJsonCalls: string[] = [];
  const sendJournalActionCalls: Array<{ action: string; journalId: string; userId: string }> = [];
  const navigateCalls: Array<{ href: string; options?: Record<string, unknown> }> = [];
  const statuses: Array<{ message: string; tone: string }> = [];

  function cardMarkup(
    item: { id: string; title: string },
    actorId = "",
    options: { hideSocialAction?: boolean; hideSocialMeta?: boolean } = {},
  ) {
    const postHref = actorId ? `/posts/${item.id}?actor=${actorId}` : `/posts/${item.id}`;
    return `
      <article class="result-card" data-journal-id="${item.id}">
        <h3>${item.title}</h3>
        ${options.hideSocialMeta ? "" : `<div class="result-meta"><span>0 likes</span><span>0 comments</span></div>`}
        <a class="inline-link" href="${postHref}" data-nav="true">Open post</a>
        <div class="actions">
          <button type="button" data-action="view">Add view</button>
          <button type="button" data-action="rate">Rate 5</button>
          ${options.hideSocialAction ? "" : `<button type="button" data-action="like">Like</button>`}
        </div>
      </article>
    `;
  }

  const app = {
    applySelectorBindings(
      root: { querySelector(selector: string): { innerHTML: string } | null },
      bindings?: Array<{ config?: { label?: string }; items: Array<Record<string, string>>; selector: string }>,
    ) {
      (bindings ?? []).forEach(({ config, items, selector }) => {
        const element = root.querySelector(selector);
        if (!element) {
          return;
        }
        const labelKey = config?.label ?? "name";
        element.innerHTML = [`<option value=""></option>`]
          .concat(items.map((item) => `<option value="${item.id}">${item[labelKey] ?? item.name ?? item.id}</option>`))
          .join("");
      });
    },
    buildPostHref(journalId: string, params: { actor?: string }) {
      return params.actor ? `/posts/${journalId}?actor=${params.actor}` : `/posts/${journalId}`;
    },
    createJournalCard(
      item: { id: string; title: string },
      options?: { actorId?: string; hideSocialAction?: boolean; hideSocialMeta?: boolean },
    ) {
      return cardMarkup(item, options?.actorId ?? "", options);
    },
    async fetchFeed(options: Record<string, unknown>) {
      fetchFeedCalls.push(options);
      return {
        items: [{ id: "journal-feed-1", title: "Latest feed note" }],
        notice: "",
      };
    },
    async fetchRecommendedJournals(options: Record<string, unknown>) {
      fetchRecommendedCalls.push(options);
      return [
        { id: "journal-rec-1", title: "Recommended feed note", userId: "user-1" },
        { id: "journal-rec-2", title: "Other author note", userId: "user-2" },
      ];
    },
    getDestinationBindings() {
      return {
        selectorBindings: [
          {
            config: { label: "label" },
            items: destinationOptions,
            selector: "#feed-destination-filter",
          },
          {
            config: { label: "label" },
            items: destinationOptions,
            selector: "#feed-exchange-destination",
          },
        ],
      };
    },
    getDestinationOptions() {
      return destinationOptions;
    },
    async loadBootstrap() {
      return bootstrap;
    },
    navigate(href: string, options?: Record<string, unknown>) {
      navigateCalls.push({ href, options });
    },
    async requestJson(endpoint: string) {
      requestJsonCalls.push(endpoint);
      if (endpoint.startsWith("/api/journal-exchange/search?")) {
        return {
          items: [{ id: "journal-exchange-1", title: "Exchange note", userId: "user-1" }],
        };
      }
      throw new Error(`Unexpected request: ${endpoint}`);
    },
    async sendJournalAction(action: string, journalId: string, userId: string) {
      sendJournalActionCalls.push({ action, journalId, userId });
      return { notice: "" };
    },
    setDocumentTitle() {},
    setStatus(message: string, tone = "neutral") {
      statuses.push({ message, tone });
    },
    state: {},
  };

  return {
    app,
    fetchFeedCalls,
    fetchRecommendedCalls,
    navigateCalls,
    requestJsonCalls,
    sendJournalActionCalls,
    statuses,
  };
}

test("compose respects the actor route param and preserves it on publish", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ComposeModule>("views/compose.js");
    const fixture = createComposeFixture();

    await module.render(
      fixture.app,
      {
        name: "compose",
        params: {
          actor: "user-2",
          destinationId: "dest-2",
        },
      },
      root,
    );

    assert.equal(requireElement(root, "#compose-user").value, "user-2");
    assert.equal(requireElement(root, "#compose-destination").value, "dest-2");

    requireElement(root, "#compose-title").value = "Harbor dusk";
    requireElement(root, "#compose-body").value = "Watched the lights come on above the pier.";
    dispatchDomEvent(requireElement(root, "#compose-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journals",
        payload: {
          body: "Watched the lights come on above the pier.",
          destinationId: "dest-2",
          media: [],
          tags: [],
          title: "Harbor dusk",
          userId: "user-2",
        },
      },
    ]);
    assert.deepEqual(fixture.navigateCalls, ["/posts/journal-9?actor=user-2"]);
  } finally {
    restore();
  }
});

test("home preview strips dead journal action buttons", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<HomeModule>("views/home.js");
    const fixture = createHomeFixture();

    await module.render(fixture.app, { name: "home", params: {} }, root);

    assert.equal(root.querySelectorAll("[data-journal-id]").length, 1);
    assert.equal(root.querySelectorAll("button[data-action]").length, 0);
    assert.deepEqual(fixture.fetchFeedCalls, [{ limit: 3 }]);
  } finally {
    restore();
  }
});

test("feed actions handle exchange cards and preserve recommendation mode", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<FeedModule>("views/feed.js");
    const fixture = createFeedFixture();

    await module.render(
      fixture.app,
      {
        name: "feed",
        params: {
          actor: "user-2",
          author: "user-1",
          destinationId: "dest-1",
        },
      },
      root,
    );

    assert.equal(fixture.fetchFeedCalls.length, 1);
    assert.equal(requireElement(root, ".feed-stream-card a[data-compose-href='true']").getAttribute("href"), "/compose?actor=user-2");
    assert.equal(
      requireElement(root, "#feed-results [data-journal-id='journal-feed-1'] a").getAttribute("href"),
      "/posts/journal-feed-1?actor=user-2",
    );

    requireElement(root, "#feed-exchange-query").value = "indoor";
    dispatchDomEvent(requireElement(root, "#feed-exchange-search-form"), "submit");
    await settleAsync();

    assert.equal(
      requireElement(root, "#feed-exchange-results [data-journal-id='journal-exchange-1'] a").getAttribute("href"),
      "/posts/journal-exchange-1?actor=user-2",
    );
    assert.equal(root.querySelector("#feed-exchange-results button[data-action='like']"), null);
    assert.equal(requireElement(root, "#feed-exchange-results").textContent?.includes("0 likes"), false);
    assert.equal(requireElement(root, "#feed-exchange-results").textContent?.includes("0 comments"), false);

    const actorSelect = requireElement(root, "#feed-actor");
    actorSelect.value = "user-1";
    dispatchDomEvent(actorSelect, "change");
    await settleAsync();

    assert.equal(fixture.fetchFeedCalls.length, 2);
    assert.equal(fixture.fetchFeedCalls[1]?.viewerUserId, "user-1");
    assert.equal(requireElement(root, ".feed-stream-card a[data-compose-href='true']").getAttribute("href"), "/compose?actor=user-1");
    assert.equal(
      requireElement(root, "#feed-results [data-journal-id='journal-feed-1'] a").getAttribute("href"),
      "/posts/journal-feed-1?actor=user-1",
    );
    assert.equal(
      requireElement(root, "#feed-exchange-results [data-journal-id='journal-exchange-1'] a").getAttribute("href"),
      "/posts/journal-exchange-1?actor=user-1",
    );

    dispatchDomEvent(requireElement(root, "#feed-load-recommended"), "click");
    await settleAsync();

    assert.equal(fixture.fetchRecommendedCalls.length, 1);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 1);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").textContent?.includes("Other author note"), false);

    const exchangeButton = requireElement(root, "#feed-exchange-results button[data-action='view']");
    dispatchDomEvent(exchangeButton, "click");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/journal-exchange/search?query=indoor"]);
    assert.deepEqual(fixture.sendJournalActionCalls, [
      { action: "view", journalId: "journal-exchange-1", userId: "user-1" },
    ]);
    assert.equal(fixture.fetchRecommendedCalls.length, 2);
    assert.equal(fixture.fetchFeedCalls.length, 2);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 1);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").textContent?.includes("Other author note"), false);
  } finally {
    restore();
  }
});

test("post detail keeps the initial comments request bounded and appends older comments on load more", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 5);
    const mapContextEmptyState = requireElement(root, "#post-map-context .empty-state");
    assert.equal(root.innerHTML.includes("Map context is secondary"), true);
    assert.equal(
      root.innerHTML.includes("Open the supporting destination graph only when spatial detail is useful for this note."),
      true,
    );
    assert.equal(mapContextEmptyState.querySelector(".section-tag"), null);

    const loadMoreButton = requireElement(root, "#post-comments-more");
    dispatchDomEvent(loadMoreButton, "click");
    await settleAsync();

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
      { cursor: "cursor-2", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 10);

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.indexOf("Comment 1") < commentsContainer.innerHTML.indexOf("Comment 6"));
    assert.ok(commentsContainer.innerHTML.includes("Comment 10"));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("posting a comment resets post detail comments back to the first page", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    dispatchDomEvent(requireElement(root, "#post-comments-more"), "click");
    await settleAsync();
    assert.equal(root.querySelectorAll(".comment-card").length, 10);

    const commentBody = requireElement(root, "#post-comment-body");
    commentBody.value = "A fresh detail note";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.createCommentCalls, [
      { body: "A fresh detail note", journalId: "journal-1", userId: "user-2" },
    ]);
    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
      { cursor: "cursor-2", journalId: "journal-1", limit: 5 },
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 5);

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.includes("Comment 1"));
    assert.ok(!commentsContainer.innerHTML.includes("Comment 10"));
    assert.deepEqual(fixture.detailCalls, [
      { journalId: "journal-1", viewerUserId: "user-2" },
      { journalId: "journal-1", viewerUserId: "user-2" },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail refreshes visible state after view and rate actions", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const heroMeta = requireElement(root, "#post-hero-meta");
    assert.ok(heroMeta.innerHTML.includes("views 14"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("rating 4"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("1 scores"), heroMeta.innerHTML);

    dispatchDomEvent(requireElement(root, "#post-view"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[0], {
      action: "view",
      journalId: "journal-1",
      userId: "user-2",
    });
    assert.equal(fixture.detailCalls.length, 2);
    assert.ok(heroMeta.innerHTML.includes("views 15"), heroMeta.innerHTML);

    dispatchDomEvent(requireElement(root, "#post-rate"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[1], {
      action: "rate",
      journalId: "journal-1",
      userId: "user-2",
    });
    assert.equal(fixture.detailCalls.length, 3);
    assert.ok(heroMeta.innerHTML.includes("rating 4.5"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("2 scores"), heroMeta.innerHTML);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail preserves the current actor on compose links", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const composeLink = root.querySelector("[data-compose-href='true']");
    assert.ok(composeLink);
    assert.equal(composeLink?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-2");

    const actorSelect = requireElement(root, "#post-actor");
    actorSelect.value = "user-1";
    dispatchDomEvent(actorSelect, "change");
    await settleAsync();

    assert.equal(composeLink?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-1");
    assert.deepEqual(fixture.navigateCalls[0], {
      href: "/posts/journal-1?actor=user-1",
      options: {
        preserveScroll: true,
        render: false,
        replace: true,
      },
    });

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail preserves actor-aware map and feed hand-offs, including delete return", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const feedLink = requireElement(root, "[data-feed-href='true']");
    const mapLink = requireElement(root, "[data-map-href='true']");
    assert.equal(feedLink.getAttribute("href"), "/feed?actor=user-2");
    assert.equal(mapLink.getAttribute("href"), "/map?destinationId=dest-1&actor=user-2");

    const actorSelect = requireElement(root, "#post-actor");
    actorSelect.value = "user-1";
    dispatchDomEvent(actorSelect, "change");
    await settleAsync();

    assert.equal(feedLink.getAttribute("href"), "/feed?actor=user-1");
    assert.equal(mapLink.getAttribute("href"), "/map?destinationId=dest-1&actor=user-1");

    dispatchDomEvent(requireElement(root, "#post-delete"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[fixture.actionCalls.length - 1], {
      action: "delete",
      journalId: "journal-1",
      userId: "user-1",
    });
    assert.deepEqual(fixture.navigateCalls, [
      {
        href: "/posts/journal-1?actor=user-1",
        options: {
          preserveScroll: true,
          render: false,
          replace: true,
        },
      },
      {
        href: "/feed?actor=user-1",
        options: undefined,
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail keeps the journal surface mounted when the initial comments load fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    fixture.app.fetchJournalComments = async (journalId: string, options: { cursor?: string; limit?: number }) => {
      fixture.commentCalls.push({
        cursor: options.cursor ?? "",
        journalId,
        limit: Number(options.limit) || 0,
      });
      throw new Error("Comments service timed out.");
    };

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.ok(root.innerHTML.includes('id="post-hero-title"'));
    assert.ok(root.innerHTML.includes('id="post-story-title"'));
    assert.ok(root.innerHTML.includes("Bridge Notes"));
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("Comments failed to load"));
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("Comments service timed out."));

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.includes("Comments failed to load"));
    assert.ok(commentsContainer.innerHTML.includes("Comments service timed out."));
    assert.equal(commentsContainer.innerHTML.includes("Comments unavailable"), false);
    assert.equal(
      commentsContainer.innerHTML.includes("The backend comments endpoint is not available in this workspace yet."),
      false,
    );
    assert.equal(root.innerHTML.includes("This note could not be found."), false);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore defers destination details until the facility surface is first touched", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    assert.deepEqual(fixture.ensureDestinationDetailsCalls, []);
    assert.deepEqual(fixture.requestJsonCalls, ["/api/foods/recommendations?destinationId=dest-1"]);

    const facilityForm = requireElement(root, "#explore-facility-form");
    dispatchDomEvent(facilityForm, "focusin");
    dispatchDomEvent(facilityForm, "pointerdown");
    await settleAsync();

    assert.deepEqual(fixture.ensureDestinationDetailsCalls, ["dest-1"]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore destination cards preserve actor context across featured, search, and recommendation results", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (endpoint === "/api/destinations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Lantern decks and quiet overlooks.",
                heat: 76,
                id: "dest-2",
                name: "Lantern Point",
                nodeCount: 9,
                rating: 4.6,
                region: "East Bluffs",
                type: "campus",
              },
            ],
          };
        }
        if (endpoint === "/api/destinations/recommendations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Reeds, galleries, and late ferry light.",
                heat: 82,
                id: "dest-3",
                name: "Reed Market",
                nodeCount: 11,
                rating: 4.9,
                region: "South Basin",
                type: "district",
              },
            ],
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const featuredLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(featuredLinks[0]?.getAttribute("href"), "/map?destinationId=dest-1&actor=user-2");
    assert.equal(featuredLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-2");

    requireElement(root, "#explore-query").value = "harbor";
    dispatchDomEvent(requireElement(root, "#explore-destination-form"), "submit");
    await settleAsync();

    const searchLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(searchLinks[0]?.getAttribute("href"), "/map?destinationId=dest-2&actor=user-2");
    assert.equal(searchLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-2&actor=user-2");

    dispatchDomEvent(requireElement(root, "#explore-destination-recommend"), "click");
    await settleAsync();

    const recommendationLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(recommendationLinks[0]?.getAttribute("href"), "/map?destinationId=dest-3&actor=user-2");
    assert.equal(recommendationLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-3&actor=user-2");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore destination cards keep clean URLs when no actor is present", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (endpoint === "/api/destinations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Lantern decks and quiet overlooks.",
                heat: 76,
                id: "dest-2",
                name: "Lantern Point",
                nodeCount: 9,
                rating: 4.6,
                region: "East Bluffs",
                type: "campus",
              },
            ],
          };
        }
        if (endpoint === "/api/destinations/recommendations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Reeds, galleries, and late ferry light.",
                heat: 82,
                id: "dest-3",
                name: "Reed Market",
                nodeCount: 11,
                rating: 4.9,
                region: "South Basin",
                type: "district",
              },
            ],
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    const featuredLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(featuredLinks[0]?.getAttribute("href"), "/map?destinationId=dest-1");
    assert.equal(featuredLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-1");

    requireElement(root, "#explore-query").value = "harbor";
    dispatchDomEvent(requireElement(root, "#explore-destination-form"), "submit");
    await settleAsync();

    const searchLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(searchLinks[0]?.getAttribute("href"), "/map?destinationId=dest-2");
    assert.equal(searchLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-2");

    dispatchDomEvent(requireElement(root, "#explore-destination-recommend"), "click");
    await settleAsync();

    const recommendationLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(recommendationLinks[0]?.getAttribute("href"), "/map?destinationId=dest-3");
    assert.equal(recommendationLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-3");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore ignores stale facility node loads after destination changes", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const detailsById = new Map([
    [
      "dest-1",
      {
        graph: {
          nodes: [
            { id: "dest-1-node-a", name: "Atrium" },
            { id: "dest-1-node-b", name: "Bridge" },
          ],
        },
      },
    ],
    [
      "dest-2",
      {
        graph: {
          nodes: [
            { id: "dest-2-node-a", name: "Garden" },
            { id: "dest-2-node-b", name: "Lookout" },
          ],
        },
      },
    ],
  ]);
  const staleDest1Details = createDeferred<Record<string, unknown>>();
  let delayDest1 = false;

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      ensureDestinationDetailsImpl: async (destinationId: string) => {
        if (delayDest1 && destinationId === "dest-1") {
          return staleDest1Details.promise;
        }
        const details = detailsById.get(destinationId);
        if (!details) {
          throw new Error(`Unknown destination: ${destinationId}`);
        }
        return details;
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    delayDest1 = true;
    dispatchDomEvent(requireElement(root, "#explore-facility-form"), "focusin");
    const facilityDestinationSelect = requireElement(root, "#explore-facility-destination");
    facilityDestinationSelect.value = "dest-2";
    dispatchDomEvent(facilityDestinationSelect, "change");
    await settleAsync();

    const facilityNodeSelect = requireElement(root, "#explore-facility-node");
    assert.equal(facilityNodeSelect.value, "dest-2-node-a");

    staleDest1Details.resolve(detailsById.get("dest-1") as Record<string, unknown>);
    await settleAsync();

    assert.equal(facilityDestinationSelect.value, "dest-2");
    assert.equal(facilityNodeSelect.value, "dest-2-node-a");
    assert.equal(facilityNodeSelect.innerHTML.includes("dest-1-node-a"), false);
    assert.equal(facilityNodeSelect.innerHTML.includes("dest-2-node-a"), true);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore food recommendation and search map links preserve actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const searchResponse = createDeferred<Record<string, unknown>>();

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return {
            items: [
              {
                avgPrice: 3,
                cuisine: "tea",
                heat: 91,
                keywords: ["late", "quiet"],
                name: "Lantern Tea Room",
                rating: 4.8,
                venue: "Wharf Arcade",
              },
            ],
          };
        }
        if (endpoint === "/api/foods/search?destinationId=dest-1&query=noodles") {
          return searchResponse.promise;
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.equal(
      requireElement(root, "#explore-food-results a").getAttribute("href"),
      "/map?destinationId=dest-1&actor=user-2",
    );

    requireElement(root, "#explore-food-query").value = "noodles";
    dispatchDomEvent(requireElement(root, "#explore-food-form"), "submit");
    requireElement(root, "#explore-food-destination").value = "dest-2";

    searchResponse.resolve({
      items: [
        {
          avgPrice: 2,
          cuisine: "tea",
          heat: 88,
          keywords: ["quiet", "noodles"],
          name: "Noodle Stop",
          rating: 4.7,
          venue: "Atrium Hall",
        },
      ],
    });
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/foods/search?destinationId=dest-1&query=noodles",
    ]);
    assert.equal(
      requireElement(root, "#explore-food-results a").getAttribute("href"),
      "/map?destinationId=dest-1&actor=user-2",
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore food recommendation and search map links stay clean without actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const searchResponse = createDeferred<Record<string, unknown>>();

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return {
            items: [
              {
                avgPrice: 3,
                cuisine: "tea",
                heat: 91,
                keywords: ["late", "quiet"],
                name: "Lantern Tea Room",
                rating: 4.8,
                venue: "Wharf Arcade",
              },
            ],
          };
        }
        if (endpoint === "/api/foods/search?destinationId=dest-1&query=noodles") {
          return searchResponse.promise;
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    assert.equal(requireElement(root, "#explore-food-results a").getAttribute("href"), "/map?destinationId=dest-1");

    requireElement(root, "#explore-food-query").value = "noodles";
    dispatchDomEvent(requireElement(root, "#explore-food-form"), "submit");
    requireElement(root, "#explore-food-destination").value = "dest-2";

    searchResponse.resolve({
      items: [
        {
          avgPrice: 2,
          cuisine: "tea",
          heat: 88,
          keywords: ["quiet", "noodles"],
          name: "Noodle Stop",
          rating: 4.7,
          venue: "Atrium Hall",
        },
      ],
    });
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/foods/search?destinationId=dest-1&query=noodles",
    ]);
    assert.equal(requireElement(root, "#explore-food-results a").getAttribute("href"), "/map?destinationId=dest-1");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore facility result map links preserve actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (
          endpoint === "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900"
        ) {
          return {
            item: {
              destinationId: "dest-1",
              fromNodeId: "dest-1-node-a",
              items: [
                {
                  category: "museum",
                  distance: 140,
                  name: "North Gallery Desk",
                  nodeId: "dest-1-node-c",
                  nodePath: ["dest-1-node-a", "dest-1-node-c"],
                  openHours: "08:00-18:00",
                },
              ],
            },
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    dispatchDomEvent(requireElement(root, "#explore-facility-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900",
    ]);
    assert.equal(
      requireElement(root, "#explore-facility-results a").getAttribute("href"),
      "/map?destinationId=dest-1&from=dest-1-node-a&to=dest-1-node-c&actor=user-2",
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore facility result map links stay clean without actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (
          endpoint === "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900"
        ) {
          return {
            item: {
              destinationId: "dest-1",
              fromNodeId: "dest-1-node-a",
              items: [
                {
                  category: "museum",
                  distance: 140,
                  name: "North Gallery Desk",
                  nodeId: "dest-1-node-c",
                  nodePath: ["dest-1-node-a", "dest-1-node-c"],
                  openHours: "08:00-18:00",
                },
              ],
            },
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    dispatchDomEvent(requireElement(root, "#explore-facility-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900",
    ]);
    assert.equal(
      requireElement(root, "#explore-facility-results a").getAttribute("href"),
      "/map?destinationId=dest-1&from=dest-1-node-a&to=dest-1-node-c",
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("map falls back to a valid destination when the query points at a missing destination", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;

  try {
    globals.RouteVisualizationMarkers = require(path.join(
      process.cwd(),
      "public",
      "route-visualization-markers.js",
    ));

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          destinationId: "dest-missing",
          from: "ghost-start",
          mode: "walk",
          strategy: "distance",
          to: "ghost-end",
          waypoints: "ghost-waypoint",
        },
      },
      root,
    );

    assert.equal(requireElement(root, "#map-destination").value, "dest-1");
    assert.deepEqual(fixture.ensureDestinationDetailsCalls, ["dest-1", "dest-1"]);
    assert.deepEqual(fixture.requestJsonCalls, []);
    assert.deepEqual(fixture.navigateCalls, [
      {
        href: "/map?destinationId=dest-1",
        options: {
          preserveScroll: true,
          render: false,
          replace: true,
        },
      },
    ]);
    assert.ok(requireElement(root, "#map-visualization").innerHTML.includes("Harbor Reach"));
    assert.ok(requireElement(root, "#map-route-result").innerHTML.includes("Route summary appears after planning"));
    assert.deepEqual(fixture.statuses, [
      {
        message: "Requested destination was unavailable. Showing the first available map instead.",
        tone: "neutral",
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

test("map preserves actor context on fallback, return links, and renderless URL rewrites", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;

  try {
    globals.RouteVisualizationMarkers = require(path.join(
      process.cwd(),
      "public",
      "route-visualization-markers.js",
    ));

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          actor: "user-2",
          destinationId: "dest-missing",
          from: "ghost-start",
          mode: "walk",
          strategy: "distance",
          to: "ghost-end",
          waypoints: "ghost-waypoint",
        },
      },
      root,
    );

    assert.equal(requireElement(root, "a[data-nav='true']").getAttribute("href"), "/explore?actor=user-2");
    assert.deepEqual(fixture.navigateCalls[0], {
      href: "/map?destinationId=dest-1&actor=user-2",
      options: {
        preserveScroll: true,
        render: false,
        replace: true,
      },
    });

    const destinationSelect = requireElement(root, "#map-destination");
    destinationSelect.value = "dest-2";
    dispatchDomEvent(destinationSelect, "change");
    await settleAsync();

    assert.deepEqual(fixture.navigateCalls[1], {
      href: "/map?destinationId=dest-2&from=dest-2-node-a&to=dest-2-node-b&strategy=distance&mode=walk&actor=user-2",
      options: {
        preserveScroll: true,
        render: false,
        replace: true,
      },
    });

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

test("map keeps clean URLs when no actor is present during renderless rewrites", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;

  try {
    globals.RouteVisualizationMarkers = require(path.join(
      process.cwd(),
      "public",
      "route-visualization-markers.js",
    ));

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          actor: "",
          destinationId: "",
          from: "",
          mode: "",
          strategy: "",
          to: "",
          waypoints: "",
        },
      },
      root,
    );

    assert.equal(requireElement(root, "a[data-nav='true']").getAttribute("href"), "/explore");

    const destinationSelect = requireElement(root, "#map-destination");
    destinationSelect.value = "dest-2";
    dispatchDomEvent(destinationSelect, "change");
    await settleAsync();

    assert.deepEqual(fixture.navigateCalls, [
      {
        href: "/map?destinationId=dest-2&from=dest-2-node-a&to=dest-2-node-b&strategy=distance&mode=walk",
        options: {
          preserveScroll: true,
          render: false,
          replace: true,
        },
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

test("map renders planning controls and switches legend hooks from preview to active route", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;

  try {
    globals.RouteVisualizationMarkers = require(path.join(
      process.cwd(),
      "public",
      "route-visualization-markers.js",
    ));

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    requireElement(root, ".map-controls-copy");
    assert.equal(root.innerHTML.includes("<div class=\"map-controls-copy\">"), true);
    assert.equal(root.innerHTML.includes("<h2>Route Planning</h2>"), true);
    assert.equal(root.innerHTML.includes("Choose the spatial context first, then set the route start and end nodes."), true);
    assert.equal(root.querySelectorAll(".map-control-group").length, 2);

    const routeForm = requireElement(root, "#map-route-form");
    const destinationGroup = requireElement(root, "#map-destination").closest(".map-control-group");
    assert.ok(destinationGroup !== null);

    const nodePair = requireElement(root, ".map-node-pair");
    assert.equal(nodePair.classList.contains("map-control-group"), true);
    assert.ok(nodePair.querySelector("#map-start") !== null);
    assert.ok(nodePair.querySelector("#map-end") !== null);
    assert.equal(nodePair.querySelector("#map-destination"), null);
    assert.ok(
      Array.from(routeForm.children).indexOf(destinationGroup as (typeof routeForm.children)[number]) <
        Array.from(routeForm.children).indexOf(nodePair),
    );

    const advancedPanel = requireElement(root, "#map-advanced");
    assert.equal(advancedPanel.tagName, "details");
    requireElement(advancedPanel, "summary");

    const returnLink = requireElement(root, ".section-head a[data-nav='true']");
    assert.equal(returnLink.getAttribute("href"), "/explore?actor=user-2");
    assert.equal(root.innerHTML.includes("Return to Explore"), true);
    assert.equal(returnLink.closest(".button-row"), null);

    const buttonRow = requireElement(root, ".button-row");
    assert.equal(root.innerHTML.includes("Plan route"), true);
    const resetRouteButton = requireElement(buttonRow, "#map-reset-route");
    assert.equal(resetRouteButton.getAttribute("type"), "button");
    assert.equal(resetRouteButton.classList.contains("ghost"), true);
    assert.equal(buttonRow.querySelector("a[data-nav='true']"), null);

    const viewText = compactText(root).toLowerCase();
    assert.equal(viewText.includes("deep link"), false);
    assert.equal(viewText.includes("deep-link"), false);
    assert.equal(viewText.includes("query parameter"), false);
    assert.equal(root.innerHTML.includes("/map?destinationId="), false);
    assert.equal(root.innerHTML.includes("&from="), false);
    assert.equal(root.innerHTML.includes("&to="), false);

    const routeResult = requireElement(root, "#map-route-result");
    const routeResultEmptyShell = requireElement(routeResult, ".map-stage-empty-shell");
    assert.equal(routeResultEmptyShell.classList.contains("surface-card"), true);
    assert.equal(routeResultEmptyShell.classList.contains("route-stage-shell"), true);
    assert.ok(routeResultEmptyShell.querySelector(".empty-state") !== null);
    assert.equal(compactText(routeResult).includes("Route summary appears after planning"), true);
    assert.equal(compactText(routeResult).includes("Calm Empty State"), false);
    assert.equal(routeResult.querySelector(".section-tag"), null);

    const visualization = requireElement(root, "#map-visualization");
    const mapStageCard = requireElement(visualization, ".map-stage-card");
    assert.equal(mapStageCard.classList.contains("route-stage-shell"), true);
    const previewMarkerSemantics = Array.from(new Set(
      visualization
        .querySelectorAll("[data-route-marker-state='preview']")
        .map((element) => element.getAttribute("data-route-marker-semantic")),
    )).sort();
    assert.deepEqual(previewMarkerSemantics, ["preview-end", "preview-start"]);

    const previewLegendKeys = visualization
      .querySelectorAll("[data-route-legend-state='preview']")
      .map((element) => element.getAttribute("data-route-legend-key"))
      .sort();
    assert.deepEqual(previewLegendKeys, ["preview-end", "preview-start"]);
    assert.equal(visualization.querySelector("[data-route-legend-type='path']"), null);

    dispatchDomEvent(requireElement(root, "#map-route-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/routes/plan"]);
    assert.equal(compactText(routeResult).includes("Route summary appears after planning"), false);
    assert.equal(compactText(routeResult).includes("Route ready to follow."), true);
    assert.equal(routeResult.innerHTML.includes("Route details"), true);
    const routeSummaryCards = Array.from(routeResult.querySelectorAll(".route-summary-card"));
    assert.equal(routeSummaryCards.length, 2);
    assert.equal(routeSummaryCards.every((card) => card.classList.contains("route-stage-shell")), true);

    const activeLegendKeys = visualization
      .querySelectorAll("[data-route-legend-state='active-route']")
      .map((element) => element.getAttribute("data-route-legend-key"))
      .sort();
    assert.deepEqual(activeLegendKeys, ["end", "outdoor-route", "start"]);
    assert.ok(visualization.querySelector("[data-route-path-type='walkway']") !== null);
    assert.deepEqual(
      Array.from(new Set(
        visualization
          .querySelectorAll("[data-route-marker-state='active-route']")
          .map((element) => element.getAttribute("data-route-marker-semantic")),
      )).sort(),
      ["end", "start"],
    );
    assert.equal(visualization.querySelector("[data-route-marker-state='preview']"), null);
    assert.equal(visualization.querySelector("[data-route-legend-state='preview']"), null);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

test("map ignores stale node loads after destination changes", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;
  const detailsById = new Map([
    [
      "dest-1",
      {
        buildings: [],
        graph: {
          edges: [{ from: "dest-1-node-a", id: "edge-a-b", roadType: "walkway", to: "dest-1-node-b" }],
          nodes: [
            { floor: 0, id: "dest-1-node-a", kind: "gate", name: "Atrium", x: 0, y: 0 },
            { floor: 0, id: "dest-1-node-b", kind: "plaza", name: "Bridge", x: 40, y: 20 },
          ],
        },
        id: "dest-1",
        name: "Harbor Reach",
      },
    ],
    [
      "dest-2",
      {
        buildings: [],
        graph: {
          edges: [{ from: "dest-2-node-a", id: "edge-c-d", roadType: "walkway", to: "dest-2-node-b" }],
          nodes: [
            { floor: 0, id: "dest-2-node-a", kind: "gate", name: "Garden", x: 10, y: 10 },
            { floor: 0, id: "dest-2-node-b", kind: "plaza", name: "Lookout", x: 60, y: 30 },
          ],
        },
        id: "dest-2",
        name: "Lantern Point",
      },
    ],
  ]);
  const staleDest2Details = createDeferred<Record<string, unknown>>();
  let delayDest2 = false;

  try {
    globals.RouteVisualizationMarkers = require(path.join(
      process.cwd(),
      "public",
      "route-visualization-markers.js",
    ));

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture({
      ensureDestinationDetailsImpl: async (destinationId: string) => {
        if (delayDest2 && destinationId === "dest-2") {
          return staleDest2Details.promise;
        }
        const details = detailsById.get(destinationId);
        if (!details) {
          throw new Error(`Unknown destination: ${destinationId}`);
        }
        return details;
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {},
      },
      root,
    );

    delayDest2 = true;
    const destinationSelect = requireElement(root, "#map-destination");
    destinationSelect.value = "dest-2";
    dispatchDomEvent(destinationSelect, "change");
    destinationSelect.value = "dest-1";
    dispatchDomEvent(destinationSelect, "change");
    await settleAsync();

    assert.equal(requireElement(root, "#map-start").value, "dest-1-node-a");
    assert.equal(requireElement(root, "#map-end").value, "dest-1-node-b");

    staleDest2Details.resolve(detailsById.get("dest-2") as Record<string, unknown>);
    await settleAsync();

    assert.equal(destinationSelect.value, "dest-1");
    assert.equal(requireElement(root, "#map-start").value, "dest-1-node-a");
    assert.equal(requireElement(root, "#map-end").value, "dest-1-node-b");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

test("feed fallback preserves viewer context when the social feed endpoint is unavailable", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("/api/feed")) {
        return createJsonResponse(404, { error: "Unknown API endpoint" });
      }
      if (url.startsWith("/api/journals")) {
        return createJsonResponse(200, { items: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    await app.fetchFeed({
      cursor: "cursor-1",
      destinationId: "dest-1",
      limit: 3,
      viewerUserId: "user-2",
    });

    assert.equal(requests[0], "/api/feed?destinationId=dest-1&viewerUserId=user-2&limit=3&cursor=cursor-1");
    assert.equal(
      requests[1],
      "/api/journals?destinationId=dest-1&viewerUserId=user-2&limit=3&cursor=cursor-1",
    );
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("feed fallback surfaces social feed errors instead of swapping to the journal list", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("/api/feed")) {
        return createJsonResponse(400, { error: "Invalid cursor." });
      }
      if (url.startsWith("/api/journals")) {
        return createJsonResponse(200, { items: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    await expectRejects(
      () =>
        app.fetchFeed({
          cursor: "bogus",
          viewerUserId: "user-2",
        }),
      /Invalid cursor\./,
    );

    assert.deepEqual(requests, ["/api/feed?viewerUserId=user-2&cursor=bogus"]);
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("comments fallback returns an unavailable response when the endpoint is missing", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/journals/journal-1/comments?cursor=cursor-1&limit=5") {
        return createJsonResponse(404, { error: "Unknown API endpoint" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    const response = await app.fetchJournalComments("journal-1", {
      cursor: "cursor-1",
      limit: 5,
    });

    assert.deepEqual(requests, ["/api/journals/journal-1/comments?cursor=cursor-1&limit=5"]);
    assert.deepEqual(response, {
      available: false,
      items: [],
      nextCursor: "",
      notice: "Comments have not been wired in this workspace yet.",
      totalCount: 0,
    });
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("comments failures reject when the endpoint exists but returns an error", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/journals/journal-1/comments?limit=5") {
        return createJsonResponse(500, { error: "Comment store offline." });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    await expectRejects(
      () =>
        app.fetchJournalComments("journal-1", {
          limit: 5,
        }),
      /Comment store offline\./,
    );

    assert.deepEqual(requests, ["/api/journals/journal-1/comments?limit=5"]);
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("shell nav links preserve actor context after non-rendering navigation", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    env.window.history.replaceState({}, "", "/feed?actor=user-1");

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url === "/api/bootstrap") {
        return createJsonResponse(200, {
          categories: [],
          cuisines: [],
          destinations: [
            {
              id: "dest-1",
              name: "Harbor Reach",
              region: "North Wharf",
              type: "campus",
            },
          ],
          featured: [],
          source: {
            algorithms: "fallback",
            data: "seeded",
          },
          users: [
            { id: "user-1", name: "Avery Vale" },
            { id: "user-2", name: "Mina Hart" },
          ],
        });
      }
      if (url.startsWith("/api/feed")) {
        return createJsonResponse(200, {
          items: [
            {
              destinationId: "dest-1",
              id: "journal-1",
              summaryBody: "Quiet route note.",
              tags: [],
              title: "Bridge Notes",
              userId: "user-1",
            },
          ],
          nextCursor: null,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    await app.start();
    const mapLink = Array.from(root.querySelectorAll("#feed-results a")).find((link) =>
      (link.getAttribute("href") || "").startsWith("/map?"),
    );
    assert.equal((mapLink?.getAttribute("href") || "").includes("destinationId=dest-1"), true);
    assert.equal((mapLink?.getAttribute("href") || "").includes("actor=user-1"), true);
    app.navigate("/feed?actor=user-2", { replace: true, render: false });
    await settleAsync();

    assert.equal(requireElement(root, ".site-brand").getAttribute("href"), "/?actor=user-2");
    assert.equal(requireElement(root, "a[data-route-name='explore']").getAttribute("href"), "/explore?actor=user-2");
    assert.equal(requireElement(root, "a[data-route-name='map']").getAttribute("href"), "/map?actor=user-2");
    assert.equal(requireElement(root, "a[data-route-name='feed']").getAttribute("href"), "/feed?actor=user-2");
    assert.equal(requireElement(root, "a[data-route-name='compose']").getAttribute("href"), "/compose?actor=user-2");
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("shell navigation surfaces route-load failures instead of leaving the loading notice behind", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globals.JournalPresentation = require(path.join(process.cwd(), "public", "journal-presentation.js"));
    globals.JournalConsumers = require(path.join(process.cwd(), "public", "journal-consumers.js"));

    env.window.history.replaceState({}, "", "/compose");

    let bootstrapCalls = 0;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url === "/api/bootstrap") {
        bootstrapCalls += 1;
        if (bootstrapCalls === 1) {
          return createJsonResponse(200, {
            categories: [],
            cuisines: [],
            destinations: [
              {
                id: "dest-1",
                name: "Harbor Reach",
                region: "North Wharf",
                type: "campus",
              },
            ],
            featured: [],
            source: {
              algorithms: "fallback",
              data: "seeded",
            },
            users: [{ id: "user-1", name: "Avery Vale" }],
          });
        }
        return createJsonResponse(500, { error: "bootstrap reload failed" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);

    await app.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 60);
    });

    app.state.bootstrap = null;
    app.state.bootstrapPromise = null;
    app.navigate("/map");
    await settleAsync();

    const viewRoot = requireElement(root, "#view-root");
    assert.ok(viewRoot.innerHTML.includes("Map failed to load"), viewRoot.innerHTML);
    assert.ok(viewRoot.innerHTML.includes("bootstrap reload failed"), viewRoot.innerHTML);
    assert.ok(!viewRoot.innerHTML.includes("Opening Map"), viewRoot.innerHTML);
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});
