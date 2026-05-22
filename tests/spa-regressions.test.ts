import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
    parseRoute(url?: URL): {
      params: {
        actor: string;
        author: string;
        destinationId: string;
        from: string;
        mode: string;
        strategy: string;
        to: string;
        view: string;
        waypoints: string;
      };
    };
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
  media?: Array<Record<string, unknown>>;
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

function createCommentImageFile(overrides: Partial<{ name: string; size: number; type: string }> = {}) {
  return {
    name: overrides.name ?? "trail-photo.png",
    size: overrides.size ?? 2048,
    type: overrides.type ?? "image/png",
  };
}

function createImportFile(content: string, name = "journal-compressed.json", type = "application/json") {
  return {
    name,
    size: content.length,
    type,
    async text() {
      return content;
    },
  };
}

function setElementFiles(element: unknown, files: unknown[]): void {
  Object.defineProperty(element, "files", {
    configurable: true,
    value: files,
  });
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

function createLeafletStub() {
  const imageOverlays: Array<{ bounds: unknown; options: Record<string, unknown>; url: string }> = [];
  const maps: Array<{
    boundsCalls: Array<{ bounds: unknown; options?: Record<string, unknown> }>;
    container: unknown;
    layers: unknown[];
    maxBoundsCalls: unknown[];
    options: Record<string, unknown>;
    removeCallCount: number;
    removeLayerCalls: unknown[];
  }> = [];
  const markers: Array<{
    events: Record<string, () => void>;
    latlng: unknown;
    options: Record<string, unknown>;
    tooltip: string;
  }> = [];
  const polygons: Array<{
    latlngs: unknown;
    options: Record<string, unknown>;
    tooltip: string;
  }> = [];
  const polylines: Array<{
    bringToFrontCallCount: number;
    latlngs: unknown;
    options: Record<string, unknown>;
    removeCallCount: number;
  }> = [];

  function attachLayer<TLayer extends { tooltip: string }>(layer: TLayer): TLayer & {
    addTo(map: { layers: unknown[] }): TLayer;
    bindTooltip(label: string): TLayer;
  } {
    const attached = layer as TLayer & {
      addTo(map: { layers: unknown[] }): TLayer;
      bindTooltip(label: string): TLayer;
    };
    attached.addTo = (map) => {
      map.layers.push(attached);
      return attached;
    };
    attached.bindTooltip = (label) => {
      attached.tooltip = label;
      return attached;
    };
    return attached;
  }

  return {
    L: {
      CRS: {
        Simple: { name: "simple" },
      },
      circleMarker(latlng: unknown, options: Record<string, unknown>) {
        const marker = attachLayer({
          events: {} as Record<string, () => void>,
          latlng,
          options,
          tooltip: "",
          on(event: string, handler: () => void) {
            this.events[event] = handler;
            return this;
          },
        });
        markers.push(marker);
        return marker;
      },
      imageOverlay(url: string, bounds: unknown, options: Record<string, unknown>) {
        const overlay = attachLayer({ bounds, options, url, tooltip: "" });
        imageOverlays.push({ bounds, options, url });
        return overlay;
      },
      map(container: unknown, options: Record<string, unknown>) {
        const map = {
          boundsCalls: [] as Array<{ bounds: unknown; options?: Record<string, unknown> }>,
          container,
          layers: [] as unknown[],
          maxBoundsCalls: [] as unknown[],
          options,
          removeCallCount: 0,
          removeLayerCalls: [] as unknown[],
          fitBounds(bounds: unknown, fitOptions?: Record<string, unknown>) {
            this.boundsCalls.push({ bounds, options: fitOptions });
            return this;
          },
          remove() {
            this.removeCallCount += 1;
          },
          setMaxBounds(bounds: unknown) {
            this.maxBoundsCalls.push(bounds);
            return this;
          },
          removeLayer(layer: unknown) {
            this.removeLayerCalls.push(layer);
            this.layers = this.layers.filter((existing) => existing !== layer);
            if (
              layer &&
              typeof layer === "object" &&
              "remove" in layer &&
              typeof (layer as { remove?: unknown }).remove === "function"
            ) {
              (layer as { remove: () => void }).remove();
            }
            return this;
          },
        };
        maps.push(map);
        return map;
      },
      polygon(latlngs: unknown, options: Record<string, unknown>) {
        const polygon = attachLayer({ latlngs, options, tooltip: "" });
        polygons.push(polygon);
        return polygon;
      },
      polyline(latlngs: unknown, options: Record<string, unknown>) {
        const polyline = attachLayer({
          bringToFrontCallCount: 0,
          latlngs,
          options,
          removeCallCount: 0,
          tooltip: "",
          bringToFront() {
            this.bringToFrontCallCount += 1;
            return this;
          },
          remove() {
            this.removeCallCount += 1;
          },
        });
        polylines.push(polyline);
        return polyline;
      },
    } as unknown,
    records: {
      imageOverlays,
      maps,
      markers,
      polygons,
      polylines,
    },
  };
}

function compactText(node: string | { innerHTML?: string; textContent?: string | null }) {
  const source =
    typeof node === "string" ? node : (node.textContent ?? "") || node.innerHTML || "";
  return source
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createPostDetailFixture(overrides: {
  commentPages?: CommentResponse[];
  createCommentImpl?: (
    journalId: string,
    userId: string,
    body: string,
    media?: Array<Record<string, unknown>>,
  ) => Promise<Record<string, unknown>>;
  journalBody?: string;
  journalMedia?: Array<Record<string, unknown>>;
  requestJsonImpl?: (endpoint: string, options?: { body?: string; method?: string }) => Promise<Record<string, unknown>>;
  uploadImageImpl?: (file: Record<string, unknown>) => Promise<Record<string, unknown>>;
} = {}) {
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
  const createCommentCalls: Array<{
    body: string;
    journalId: string;
    media?: Array<Record<string, unknown>>;
    userId: string;
  }> = [];
  const actionCalls: Array<{ action: string; journalId: string; userId: string }> = [];
  const navigateCalls: Array<{ href: string; options?: Record<string, unknown> }> = [];
  const requestJsonCalls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const statuses: Array<{ message: string; tone: string }> = [];
  const uploadImageCalls: Array<Record<string, unknown>> = [];
  let views = 14;
  let ratings = [{ userId: "user-1", score: 4 }];

  function averageRating() {
    return ratings.reduce((total, entry) => total + entry.score, 0) / ratings.length;
  }

  const app = {
    state: {
      mapScenes: new Map(),
    },
    async createComment(
      journalId: string,
      userId: string,
      body: string,
      media?: Array<Record<string, unknown>>,
    ) {
      const call = media && media.length ? { body, journalId, media, userId } : { body, journalId, userId };
      createCommentCalls.push(call);
      if (overrides.createCommentImpl) {
        return overrides.createCommentImpl(journalId, userId, body, media);
      }
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
        body: overrides.journalBody ?? "Quiet bridge walk.\n\nSecond paragraph.",
        commentCount: commentPageIndex >= 3 ? 24 : 23,
        createdAt: "2026-03-01T10:00:00.000Z",
        destinationId: "dest-1",
        id: journalId,
        likeCount: 2,
        media: overrides.journalMedia ?? [],
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
    async requestJson(endpoint: string, options?: { body?: string; method?: string }) {
      requestJsonCalls.push({
        endpoint,
        payload: JSON.parse(options?.body ?? "{}"),
      });
      if (overrides.requestJsonImpl) {
        return overrides.requestJsonImpl(endpoint, options);
      }
      throw new Error(`Unexpected request: ${endpoint}`);
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
    async uploadImage(file: Record<string, unknown>) {
      uploadImageCalls.push(file);
      if (overrides.uploadImageImpl) {
        return overrides.uploadImageImpl(file);
      }
      return {
        mimeType: file.type,
        originalName: file.name,
        size: file.size,
        url: "/uploads/images/image-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png",
      };
    },
  };

  return {
    app,
    actionCalls,
    createCommentCalls,
    detailCalls,
    commentCalls,
    navigateCalls,
    requestJsonCalls,
    statuses,
    uploadImageCalls,
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
  const navigateCalls: Array<{ href: string; options?: Record<string, unknown> }> = [];
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
    navigate(href: string, options?: Record<string, unknown>) {
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
      renderToken: 0,
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
      if (endpoint === "/api/journal-exchange/compress") {
        return {
          item: {
            compressed: "10,20,30",
            ratio: 0.5,
          },
        };
      }
      if (endpoint === "/api/journal-exchange/decompress") {
        return {
          item: {
            text: "Restored feed exchange note.",
          },
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

test("post detail previews and removes a selected comment image", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

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

    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [createCommentImageFile({ name: "quiet-bridge.webp", type: "image/webp" })]);
    dispatchDomEvent(imageInput, "change");
    await settleAsync();

    const preview = requireElement(root, "#post-comment-image-preview");
    assert.equal(preview.hasAttribute("hidden"), false);
    assert.ok(preview.innerHTML.includes("quiet-bridge.webp"));
    assert.ok(preview.innerHTML.includes("image/webp"));
    assert.ok(preview.innerHTML.includes("blob:comment-preview"));

    dispatchDomEvent(requireElement(root, "#post-comment-image-remove"), "click");
    await settleAsync();

    assert.equal(preview.hasAttribute("hidden"), true);
    assert.equal(preview.innerHTML, "");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail submits no media after a selected comment image is removed", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

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

    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [createCommentImageFile({ name: "quiet-bridge.webp", type: "image/webp" })]);
    dispatchDomEvent(imageInput, "change");
    await settleAsync();

    dispatchDomEvent(requireElement(root, "#post-comment-image-remove"), "click");
    requireElement(root, "#post-comment-body").value = "Plain after removal";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.uploadImageCalls, []);
    assert.deepEqual(fixture.createCommentCalls, [
      {
        body: "Plain after removal",
        journalId: "journal-1",
        userId: "user-2",
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail releases selected comment image previews on cleanup", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const revokedUrls: string[] = [];
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL(url: string) {
        revokedUrls.push(url);
      }
    };
    globalThis.URL = urlStub as typeof URL;

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

    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [createCommentImageFile({ name: "quiet-bridge.webp", type: "image/webp" })]);
    dispatchDomEvent(imageInput, "change");
    await settleAsync();

    assert.equal(requireElement(root, "#post-comment-image-preview").hasAttribute("hidden"), false);
    assert.deepEqual(revokedUrls, []);
    if (typeof cleanup === "function") {
      cleanup();
    }
    assert.deepEqual(revokedUrls, ["blob:comment-preview"]);
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail blocks invalid comment images before upload", async () => {
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

    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [createCommentImageFile({ name: "notes.txt", type: "text/plain" })]);
    dispatchDomEvent(imageInput, "change");
    await settleAsync();

    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("请选择 PNG、JPEG、WEBP 或 GIF 图片。"));
    assert.deepEqual(fixture.uploadImageCalls, []);

    setElementFiles(imageInput, [createCommentImageFile({ size: 5 * 1024 * 1024 + 1 })]);
    dispatchDomEvent(imageInput, "change");
    await settleAsync();

    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("图片不能超过 5 MB。"));
    assert.deepEqual(fixture.uploadImageCalls, []);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail uploads a selected image before creating a media comment and renders media", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const uploadedUrl = "/uploads/images/image-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg";
    const mediaCommentPage = {
      available: true,
      items: [
        {
          body: "A fresh detail note",
          createdAt: "2026-03-12T08:00:00.000Z",
          id: "comment-image",
          media: [
            {
              type: "image",
              title: "quiet-bridge.jpg",
              source: uploadedUrl,
            },
          ],
          userId: "user-2",
        },
      ],
      nextCursor: "",
      notice: "",
      totalCount: 1,
    };
    const sequence: string[] = [];
    const fixture = createPostDetailFixture({
      commentPages: [
        createCommentPage(1, 5, ""),
        mediaCommentPage,
      ],
      createCommentImpl: async () => {
        sequence.push("create-comment");
        return { available: true, item: { id: "comment-image" }, notice: "" };
      },
      uploadImageImpl: async (file) => {
        sequence.push("upload-start");
        await Promise.resolve();
        sequence.push("upload-finish");
        return {
          mimeType: file.type,
          originalName: file.name,
          size: file.size,
          url: uploadedUrl,
        };
      },
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

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

    const selectedFile = createCommentImageFile({ name: "quiet-bridge.jpg", type: "image/jpeg" });
    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [selectedFile]);
    dispatchDomEvent(imageInput, "change");
    requireElement(root, "#post-comment-body").value = "A fresh detail note";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(sequence, ["upload-start", "upload-finish", "create-comment"]);
    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.deepEqual(fixture.createCommentCalls, [
      {
        body: "A fresh detail note",
        journalId: "journal-1",
        media: [
          {
            type: "image",
            title: "quiet-bridge.jpg",
            source: uploadedUrl,
            note: "image/jpeg · 2 KB",
          },
        ],
        userId: "user-2",
      },
    ]);
    assert.ok(requireElement(root, "#post-comments").innerHTML.includes(uploadedUrl));
    assert.equal(root.querySelectorAll(".comment-media-image").length, 1);
    assert.equal(requireElement(root, "#post-comment-body").value, "");
    assert.equal(requireElement(root, "#post-comment-image-preview").hasAttribute("hidden"), true);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail keeps comment text and image when upload fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture({
      uploadImageImpl: async () => {
        throw new Error("Upload failed.");
      },
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

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

    const selectedFile = createCommentImageFile();
    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [selectedFile]);
    dispatchDomEvent(imageInput, "change");
    const commentBody = requireElement(root, "#post-comment-body");
    commentBody.value = "Keep this text";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.deepEqual(fixture.createCommentCalls, []);
    assert.equal(commentBody.value, "Keep this text");
    assert.equal(requireElement(root, "#post-comment-image-preview").hasAttribute("hidden"), false);
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("图片上传失败"));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail keeps comment text and image when media comment creation fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const uploadedUrl = "/uploads/images/image-cccccccc-cccc-cccc-cccc-cccccccccccc.png";
    const fixture = createPostDetailFixture({
      createCommentImpl: async () => {
        throw new Error("Comment failed.");
      },
      uploadImageImpl: async (file) => ({
        mimeType: file.type,
        originalName: file.name,
        size: file.size,
        url: uploadedUrl,
      }),
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:comment-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

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

    const selectedFile = createCommentImageFile({ name: "quiet-bridge.png", type: "image/png" });
    const imageInput = requireElement(root, "#post-comment-image");
    setElementFiles(imageInput, [selectedFile]);
    dispatchDomEvent(imageInput, "change");
    const commentBody = requireElement(root, "#post-comment-body");
    commentBody.value = "Keep this failed comment";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.equal(fixture.createCommentCalls.length, 1);
    assert.equal(commentBody.value, "Keep this failed comment");
    assert.equal(requireElement(root, "#post-comment-image-preview").hasAttribute("hidden"), false);
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("评论发布失败"));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("post detail marks broken comment images without changing the card bounds", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture({
      commentPages: [
        {
          available: true,
          items: [
            {
              body: "Image source may fail in a classroom demo.",
              createdAt: "2026-03-12T08:00:00.000Z",
              id: "comment-broken-image",
              media: [
                {
                  type: "image",
                  title: "Missing route image",
                  source: "/uploads/images/image-missing.png",
                },
              ],
              userId: "user-2",
            },
          ],
          nextCursor: "",
          notice: "",
          totalCount: 1,
        },
      ],
    });

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

    const image = requireElement(root, ".comment-media-image");
    dispatchDomEvent(image, "error");
    await settleAsync();
    const frame = requireElement(root, ".comment-media-frame");

    assert.equal(image.classList.contains("is-load-failed"), true);
    assert.equal(image.getAttribute("alt"), "图片加载失败");
    assert.equal(frame.classList.contains("is-image-load-failed"), true);
    assert.equal(frame.getAttribute("data-image-state"), "failed");
    assert.equal(frame.getAttribute("data-image-error"), "图片加载失败");
    assert.equal(image.hasAttribute("hidden"), true);
    assert.equal(image.getAttribute("aria-hidden"), "true");
    const fallback = requireElement(root, "[data-comment-media-fallback='true']");
    assert.equal(fallback.hasAttribute("hidden"), false);
    assert.ok(requireElement(root, "#post-comments").innerHTML.includes("Image source may fail in a classroom demo."));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail comment media CSS keeps broken and narrow images bounded", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public", "styles.css"), "utf8");

  assert.match(css, /\.comment-media-frame\s*\{[\s\S]*?width:\s*min\(100%,\s*520px\)/);
  assert.match(css, /\.comment-media-image\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.comment-media-image\s*\{[\s\S]*?max-height:\s*320px/);
  assert.match(css, /\.comment-media-image\[hidden\],[\s\S]*?\.comment-media-image\.is-load-failed\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /\.comment-media-fallback\s*\{[\s\S]*?min-height:\s*clamp/);
  assert.match(css, /\.comment-media-fallback\[hidden\]\s*\{[\s\S]*?display:\s*none/);
  assert.doesNotMatch(css, /visibility:\s*hidden/);
  assert.match(css, /\.comment-media-frame figcaption\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
});

test("post detail exports compressed journal JSON without media payloads", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  const previousBlob = globalThis.Blob;
  try {
    const downloads: Array<{ download: string; href: string; payload: Record<string, unknown> }> = [];
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const journalBody = "  Quiet bridge walk with image source /uploads/images/image-demo.png\n";
    const fixture = createPostDetailFixture({
      journalBody,
      journalMedia: [{ source: "data:image/png;base64,AAAA", title: "Should not export", type: "image" }],
      requestJsonImpl: async (endpoint, options) => {
        if (endpoint === "/api/journal-exchange/compress") {
          assert.deepEqual(JSON.parse(options?.body ?? "{}"), {
            body: journalBody,
          });
          return {
            item: {
              compressed: "10,20,30",
              originalLength: 64,
              payloadLength: 8,
              ratio: 0.5,
              savingsRatio: 0.5,
            },
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });
    class BlobStub {
      parts: unknown[];
      type: string;
      constructor(parts: unknown[], options: { type?: string } = {}) {
        this.parts = parts;
        this.type = options.type ?? "";
      }
    }
    const urlStub = class extends previousUrl {
      static override createObjectURL(blob: Blob | MediaSource) {
        const blobStub = blob as unknown as BlobStub;
        const href = `blob:download-${downloads.length + 1}`;
        downloads.push({
          download: "",
          href,
          payload: JSON.parse(String(blobStub.parts[0])),
        });
        return href;
      }
      static override revokeObjectURL() {}
    };
    globalThis.Blob = BlobStub as unknown as typeof Blob;
    globalThis.URL = urlStub as unknown as typeof URL;

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
    const originalCommentsHtml = requireElement(root, "#post-comments").innerHTML;
    const originalHeroMeta = requireElement(root, "#post-hero-meta").innerHTML;
    const originalStoryHtml = requireElement(root, ".detail-story-card").innerHTML;

    const originalCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = ((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") {
        const anchor = element as unknown as { click: () => void; download: string; remove: () => void };
        anchor.click = () => {
          downloads[downloads.length - 1].download = anchor.download;
        };
        anchor.remove = () => {};
      }
      return element;
    }) as typeof globalThis.document.createElement;

    dispatchDomEvent(requireElement(root, "#post-export-compressed"), "click");
    await settleAsync();

    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].download, "bridge-notes-compressed.json");
    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journal-exchange/compress",
        payload: {
          body: journalBody,
        },
      },
    ]);
    assert.equal(downloads[0].payload.format, "trail-atlas-journal-lzw-v1");
    assert.equal(downloads[0].payload.algorithm, "lzw");
    assert.equal(downloads[0].payload.title, "Bridge Notes");
    assert.equal(downloads[0].payload.compressedBody, "10,20,30");
    assert.deepEqual(downloads[0].payload.stats, {
      inputLength: 64,
      payloadLength: 8,
      compressionRatio: 0.5,
      spaceSavings: 0.5,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(downloads[0].payload.stats, "originalLength"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(downloads[0].payload.stats, "savingsRatio"), false);
    assert.equal(typeof downloads[0].payload.exportedAt, "string");
    assert.equal(JSON.stringify(downloads[0].payload).includes("data:image"), false);
    assert.equal(JSON.stringify(downloads[0].payload).includes("base64"), false);
    assert.deepEqual(fixture.createCommentCalls, []);
    assert.deepEqual(fixture.actionCalls, []);
    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.deepEqual(fixture.detailCalls, [
      { journalId: "journal-1", viewerUserId: "user-2" },
    ]);
    assert.equal(requireElement(root, "#post-comments").innerHTML, originalCommentsHtml);
    assert.equal(requireElement(root, "#post-hero-meta").innerHTML, originalHeroMeta);
    assert.equal(requireElement(root, ".detail-story-card").innerHTML, originalStoryHtml);
    assert.equal(root.querySelectorAll(".media-strip .media-card").length, 1);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globalThis.URL = previousUrl;
    globalThis.Blob = previousBlob;
    restore();
  }
});

test("post detail imports compressed journal JSON as a non-mutating preview", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const compressedBody = " \u8000,20,30\n";
    const fixture = createPostDetailFixture({
      requestJsonImpl: async (endpoint, options) => {
        if (endpoint === "/api/journal-exchange/decompress") {
          assert.deepEqual(JSON.parse(options?.body ?? "{}"), {
            body: compressedBody,
          });
          return {
            item: {
              text: "  Restored bridge note.\n\nSecond restored line.\n  ",
            },
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

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

    const importPayload = {
      format: "trail-atlas-journal-lzw-v1",
      algorithm: "lzw",
      title: "Imported Bridge",
      compressedBody,
      stats: {
        inputLength: 42,
        payloadLength: 8,
        compressionRatio: 0.19,
        spaceSavings: 0.81,
      },
      exportedAt: "2026-05-23T00:00:00.000Z",
    };
    const importInput = requireElement(root, "#post-import-compressed");
    setElementFiles(importInput, [createImportFile(JSON.stringify(importPayload))]);
    dispatchDomEvent(importInput, "change");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journal-exchange/decompress",
        payload: {
          body: compressedBody,
        },
      },
    ]);
    const preview = requireElement(root, "#post-compression-preview");
    assert.ok(preview.innerHTML.includes("Imported Bridge"));
    assert.ok(preview.innerHTML.includes("<pre class=\"compression-restored-body\">  Restored bridge note.\n\nSecond restored line.\n  </pre>"));
    assert.equal(preview.innerHTML.includes("<p>Restored bridge note.</p>"), false);
    assert.ok(preview.innerHTML.includes("原文 42 字符"));
    assert.ok(preview.innerHTML.includes("压缩载荷 8 字符"));
    assert.ok(preview.innerHTML.includes("压缩比 0.19"));
    assert.ok(preview.innerHTML.includes("节省比例 0.81"));
    assert.deepEqual(fixture.createCommentCalls, []);
    assert.deepEqual(fixture.actionCalls, []);
    assert.ok(root.innerHTML.includes("Quiet bridge walk."));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail shows a recoverable error for invalid compressed imports", async () => {
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

    const importInput = requireElement(root, "#post-import-compressed");
    setElementFiles(importInput, [createImportFile(JSON.stringify({
      algorithm: "lzw",
      compressedBody: "10,20,30",
      format: "wrong-format",
    }))]);
    dispatchDomEvent(importInput, "change");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, []);
    assert.ok(requireElement(root, "#post-compression-notice").innerHTML.includes("无法读取这个压缩文件。"));
    assert.ok(root.innerHTML.includes("Quiet bridge walk."));
    assert.equal(root.querySelectorAll(".comment-card").length, 5);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail rejects compressed import variants without mutating the page", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture({
      requestJsonImpl: async (endpoint) => {
        if (endpoint === "/api/journal-exchange/decompress") {
          throw new Error("Decompression failed.");
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

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

    const validShape = {
      format: "trail-atlas-journal-lzw-v1",
      algorithm: "lzw",
      title: "Imported Bridge",
      compressedBody: "10,20,30",
      stats: {
        inputLength: 42,
        payloadLength: 8,
        compressionRatio: 0.19,
        spaceSavings: 0.81,
      },
    };
    const importInput = requireElement(root, "#post-import-compressed");
    const cases = [
      createImportFile(JSON.stringify(validShape), "journal-compressed.txt", "text/plain"),
      createImportFile("{", "journal-compressed.json"),
      createImportFile(JSON.stringify({ ...validShape, algorithm: "brotli" })),
      createImportFile(JSON.stringify({
        algorithm: validShape.algorithm,
        format: validShape.format,
        title: validShape.title,
      })),
      createImportFile(JSON.stringify({ ...validShape, compressedBody: "" })),
      createImportFile(JSON.stringify({
        algorithm: validShape.algorithm,
        compressedBody: validShape.compressedBody,
        format: validShape.format,
        title: validShape.title,
      })),
      createImportFile(JSON.stringify({
        ...validShape,
        stats: {
          compressionRatio: validShape.stats.compressionRatio,
          inputLength: validShape.stats.inputLength,
          spaceSavings: validShape.stats.spaceSavings,
        },
      })),
      createImportFile(JSON.stringify({
        ...validShape,
        stats: {
          ...validShape.stats,
          payloadLength: "not-a-number",
        },
      })),
      createImportFile(JSON.stringify(validShape)),
    ];

    for (const file of cases) {
      setElementFiles(importInput, [file]);
      dispatchDomEvent(importInput, "change");
      await settleAsync();

      assert.ok(requireElement(root, "#post-compression-notice").innerHTML.includes("无法读取这个压缩文件。"));
      assert.ok(root.innerHTML.includes("Quiet bridge walk."));
      assert.equal(root.querySelectorAll(".comment-card").length, 5);
      assert.deepEqual(fixture.createCommentCalls, []);
      assert.deepEqual(fixture.actionCalls, []);
    }

    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journal-exchange/decompress",
        payload: {
          body: "10,20,30",
        },
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

export type { AppShellModule, ComposeModule, ExploreModule, FeedModule, HomeModule, MapModule, PostDetailModule };
export {
  compactText,
  createComposeFixture,
  createDeferred,
  createExploreFixture,
  createFeedFixture,
  createHomeFixture,
  createLeafletStub,
  createMapFixture,
  createPostDetailFixture,
  expectRejects,
};
