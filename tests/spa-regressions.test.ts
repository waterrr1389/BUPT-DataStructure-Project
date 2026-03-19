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

type AppShellModule = {
  createAppShell(root: unknown): {
    fetchFeed(filters?: Record<string, unknown>): Promise<unknown>;
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
      return `/map?destinationId=${params.destinationId}`;
    },
    buildPostHref(journalId: string, params: { actor?: string }) {
      return params.actor ? `/posts/${journalId}?actor=${params.actor}` : `/posts/${journalId}`;
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
    navigate() {},
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
    statuses,
  };
}

function createExploreFixture() {
  const bootstrap = {
    users: [{ id: "user-1", name: "Avery Vale" }],
  };
  const destinationOptions = [{ id: "dest-1", name: "Harbor Reach" }];
  const ensureDestinationDetailsCalls: string[] = [];
  const requestJsonCalls: string[] = [];
  const statuses: Array<{ message: string; tone: string }> = [];

  const app = {
    applySelectorBindings() {},
    buildMapHref(params: Record<string, string>) {
      return `/map?destinationId=${params.destinationId}`;
    },
    debounce(callback: () => void) {
      const wrapped = () => callback();
      wrapped.cancel = () => {};
      return wrapped;
    },
    async ensureDestinationDetails(destinationId: string) {
      ensureDestinationDetailsCalls.push(destinationId);
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
        selectorBindings: [],
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
