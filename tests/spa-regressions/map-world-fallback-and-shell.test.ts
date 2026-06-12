import assert from "node:assert/strict";
import test from "node:test";

import {
  createClassicScriptEvaluator,
  createJsonResponse,
  createSpaDomEnvironment,
  importSpaModule,
  loadPublicPageFromIndexHtml,
  requireElement,
  settleAsync,
} from "../support/spa-harness";
import { getRuntimePublicAssetPath } from "../support/runtime-public";
import {
  type AppShellModule,
  compactText,
  createDeferred,
  createLeafletStub,
  createMapFixture,
  expectRejects,
  type MapModule,
} from "../spa-regressions.test";

const PUBLIC_PAGE_BOOTSTRAP_SCRIPTS = [
  { src: "/route-visualization-markers.js", type: "classic" },
  { src: "/journal-presentation.js", type: "classic" },
  { src: "/journal-consumers.js", type: "classic" },
  { src: "/app.js", type: "module" },
] as const;

function normalizeVmSnapshot<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

function requireRuntimePublicModule<TModule>(relativePath: string): TModule {
  return require(getRuntimePublicAssetPath(relativePath)) as TModule;
}

function installJournalHelperGlobals(globals: {
  JournalConsumers?: unknown;
  JournalPresentation?: unknown;
}): void {
  globals.JournalPresentation = requireRuntimePublicModule("journal-presentation.js");
  globals.JournalConsumers = requireRuntimePublicModule("journal-consumers.js");
}

test("map world view renders an unavailable state when the backend disables world mode", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const runtimeGlobals = globalThis as Record<string, unknown>;
  const previousLeaflet = runtimeGlobals.L;

  try {
    const leaflet = createLeafletStub();
    runtimeGlobals.L = leaflet.L;

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/world") {
          return {
            capabilities: {
              crossMapRouting: false,
              destinationRouting: false,
              worldView: false,
            },
            destinations: [],
            enabled: false,
            regions: [],
          };
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          view: "world",
        },
      },
      root,
    );

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world"]);
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("世界地图不可用"), true);
    assert.equal(leaflet.records.maps.length, 0);
    assert.deepEqual(fixture.statuses, [
      {
        message: "世界模式不可用。",
        tone: "neutral",
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view falls back to an unavailable state when world details fail", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const runtimeGlobals = globalThis as Record<string, unknown>;
  const previousLeaflet = runtimeGlobals.L;

  try {
    const leaflet = createLeafletStub();
    runtimeGlobals.L = leaflet.L;

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/world") {
          return {
            capabilities: {
              crossMapRouting: false,
              destinationRouting: false,
              worldView: true,
            },
            destinations: [],
            enabled: true,
            regions: [],
            world: {
              backgroundImage: "/assets/world-map/atlas-placeholder.svg",
              height: 768,
              id: "world-1",
              name: "Atlas Overworld",
              width: 1024,
            },
          };
        }
        if (endpoint === "/api/world/details") {
          throw new Error("World details worker offline.");
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "map",
        params: {
          view: "world",
        },
      },
      root,
    );

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details"]);
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("世界详情不可用"), true);
    assert.equal(leaflet.records.maps.length, 0);
    assert.deepEqual(fixture.statuses, [
      {
        message: "世界地图加载失败。",
        tone: "error",
      },
    ]);
    assert.equal(root.innerHTML.includes("World details worker offline."), false);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view ignores stale async detail loads after the render token changes", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const runtimeGlobals = globalThis as Record<string, unknown>;
  const previousLeaflet = runtimeGlobals.L;
  const deferredWorldDetails = createDeferred<Record<string, unknown>>();

  try {
    const leaflet = createLeafletStub();
    runtimeGlobals.L = leaflet.L;

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/world") {
          return {
            capabilities: {
              crossMapRouting: true,
              destinationRouting: true,
              worldView: true,
            },
            destinations: [
              {
                destinationId: "dest-1",
                iconType: "campus-waterfront",
                label: "Harbor Reach",
                regionId: "region-river",
                x: 180,
                y: 240,
              },
            ],
            enabled: true,
            regions: [{ id: "region-river", name: "River Arc" }],
            world: {
              backgroundImage: "/assets/world-map/atlas-placeholder.svg",
              height: 768,
              id: "world-1",
              name: "Atlas Overworld",
              width: 1024,
            },
          };
        }

        if (endpoint === "/api/world/details") {
          return deferredWorldDetails.promise;
        }

        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const renderPromise = module.render(
      fixture.app,
      {
        name: "map",
        params: {
          view: "world",
        },
      },
      root,
    );

    await settleAsync();
    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details"]);

    fixture.app.state.renderToken = 1;
    deferredWorldDetails.resolve({
      world: {
        backgroundImage: "/assets/world-map/atlas-placeholder.svg",
        destinations: [
          {
            destinationId: "dest-1",
            iconType: "campus-waterfront",
            label: "Harbor Reach",
            portalIds: ["portal-1"],
            radius: 18,
            regionId: "region-river",
            x: 180,
            y: 240,
          },
        ],
        graph: {
          edges: [],
          nodes: [
            {
              destinationId: "dest-1",
              id: "world-node-1",
              kind: "portal",
              label: "Harbor Gate",
              tags: ["portal"],
              x: 180,
              y: 240,
            },
          ],
        },
        height: 768,
        id: "world-1",
        name: "Atlas Overworld",
        portals: [
          {
            allowedModes: ["walk"],
            destinationId: "dest-1",
            direction: "bidirectional",
            id: "portal-1",
            label: "Harbor Gate Lift",
            localNodeId: "dest-1-node-b",
            portalType: "gate",
            priority: 1,
            transferCost: 8,
            transferDistance: 12,
            worldNodeId: "world-node-1",
          },
        ],
        regions: [
          {
            id: "region-river",
            name: "River Arc",
            polygon: [
              [80, 120],
              [320, 140],
              [300, 340],
            ],
            tags: [],
          },
        ],
        width: 1024,
      },
    });

    const cleanup = await renderPromise;
    await settleAsync();

    assert.equal(leaflet.records.maps.length, 0);
    assert.deepEqual(fixture.statuses, []);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
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
    installJournalHelperGlobals(globals);

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
    installJournalHelperGlobals(globals);

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
      /请求内容不完整或格式不正确。/,
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
    installJournalHelperGlobals(globals);

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
      notice: "当前工作区尚未接入评论接口。",
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
    installJournalHelperGlobals(globals);

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
      /服务暂时不可用，请稍后重试。/,
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
    installJournalHelperGlobals(globals);

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
    assert.equal((mapLink?.getAttribute("href") || "").includes("actor=user-1"), false);
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

test("app shell parseRoute preserves the world view param alongside actor and destination context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    installJournalHelperGlobals(globals);

    const root = env.createRoot();
    const module = await importSpaModule<AppShellModule>("app-shell.js");
    const app = module.createAppShell(root);
    const route = app.parseRoute(new URL("/map?view=world&destinationId=dest-2&actor=user-2", "http://localhost"));

    assert.deepEqual(route.params, {
      actor: "user-2",
      author: "",
      destinationId: "dest-2",
      from: "",
      mode: "",
      strategy: "",
      to: "",
      view: "world",
      waypoints: "",
    });
  } finally {
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("public app entry keeps the bootstrap failure fallback behavior", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url === "/api/bootstrap") {
        throw new Error("Bootstrap exploded.");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const scripts = await loadPublicPageFromIndexHtml();
    await settleAsync();
    const root = requireElement(env.document.body, "#app-root");

    assert.deepEqual(scripts, PUBLIC_PAGE_BOOTSTRAP_SCRIPTS);
    assert.ok(globals.RouteVisualizationMarkers);
    assert.ok(globals.JournalPresentation);
    assert.ok(globals.JournalConsumers);
    assert.equal(compactText(root.innerHTML).includes("浏览器界面暂时不可用"), true);
    assert.equal(compactText(root.innerHTML).includes("单页应用启动失败。"), true);
    assert.equal(compactText(root.innerHTML).includes("Bootstrap exploded."), false);
    assert.equal(compactText(root.innerHTML).includes("重新加载"), true);
  } finally {
    globalThis.fetch = previousFetch;
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});

test("classic helper evaluation hides CommonJS bindings and keeps browser globals available", () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();

  try {
    const evaluator = createClassicScriptEvaluator();
    const snapshot = normalizeVmSnapshot(evaluator.evaluate(
      `({
        requireType: typeof require,
        moduleType: typeof module,
        exportsType: typeof exports,
        windowType: typeof window,
        documentType: typeof document,
        thisMatchesGlobalThis: globalThis === this,
        windowMatchesGlobalThis: window === globalThis,
        documentMatchesWindow: document === window.document
      })`,
      getRuntimePublicAssetPath("__classic-helper-contract-a__.js"),
    ) as Record<string, unknown>);

    assert.deepEqual(snapshot, {
      requireType: "undefined",
      moduleType: "undefined",
      exportsType: "undefined",
      windowType: "object",
      documentType: "object",
      thisMatchesGlobalThis: true,
      windowMatchesGlobalThis: true,
      documentMatchesWindow: true,
    });
  } finally {
    restore();
  }
});

test("classic helper evaluation preserves cross-script globals between helper files", () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();

  try {
    const evaluator = createClassicScriptEvaluator();
    evaluator.evaluate(
      "var sharedClassicBinding = 'kept';",
      getRuntimePublicAssetPath("__classic-helper-contract-b__.js"),
    );
    const snapshot = normalizeVmSnapshot(evaluator.evaluate(
      `({
        sharedType: typeof sharedClassicBinding,
        sharedValue: sharedClassicBinding,
        sharedOnWindow: window.sharedClassicBinding,
        thisMatchesGlobalThis: globalThis === this
      })`,
      getRuntimePublicAssetPath("__classic-helper-contract-c__.js"),
    ) as Record<string, unknown>);

    assert.deepEqual(snapshot, {
      sharedType: "string",
      sharedValue: "kept",
      sharedOnWindow: "kept",
      thisMatchesGlobalThis: true,
    });
  } finally {
    delete (env.window as typeof env.window & Record<string, unknown>).sharedClassicBinding;
    restore();
  }
});

test("public page contract boots the shell without direct helper injection", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
    JournalConsumers?: unknown;
    JournalPresentation?: unknown;
  };
  const previousFetch = globalThis.fetch;
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;
  const previousJournalConsumers = globals.JournalConsumers;
  const previousJournalPresentation = globals.JournalPresentation;

  try {
    const requests: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/bootstrap") {
        return createJsonResponse(200, {
          categories: [],
          cuisines: [],
          destinations: [
            {
              id: "dest-1",
              name: "Harbor Reach",
              region: "North Wharf",
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
      if (url === "/api/feed?limit=3") {
        return createJsonResponse(200, {
          items: [],
          nextCursor: null,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const scripts = await loadPublicPageFromIndexHtml();
    await settleAsync();
    const root = requireElement(env.document.body, "#app-root");

    assert.deepEqual(scripts, PUBLIC_PAGE_BOOTSTRAP_SCRIPTS);
    assert.ok(globals.RouteVisualizationMarkers);
    assert.ok(globals.JournalPresentation);
    assert.ok(globals.JournalConsumers);
    assert.deepEqual(requests, ["/api/auth/me", "/api/bootstrap", "/api/feed?limit=3"]);
    assert.equal(requireElement(root, ".site-brand").getAttribute("href"), "/");
    assert.equal(requireElement(root, "#status-pill").textContent, "运行时数据：种子数据。算法：备用实现。");
    assert.equal(requireElement(root, "#status-pill").dataset.tone, "success");
    assert.equal(requireElement(root, "#view-root").innerHTML.includes("精选目的地"), true);
    assert.equal(env.document.title, "Trail Atlas • Trail Atlas");
  } finally {
    globalThis.fetch = previousFetch;
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
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
    installJournalHelperGlobals(globals);

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
    assert.ok(viewRoot.innerHTML.includes("地图加载失败"), viewRoot.innerHTML);
    assert.ok(viewRoot.innerHTML.includes("请求的页面无法加载。"), viewRoot.innerHTML);
    assert.ok(!viewRoot.innerHTML.includes("基础数据加载失败，请刷新后重试。"), viewRoot.innerHTML);
    assert.ok(!viewRoot.innerHTML.includes("正在打开地图"), viewRoot.innerHTML);
  } finally {
    globalThis.fetch = previousFetch;
    globals.JournalConsumers = previousJournalConsumers;
    globals.JournalPresentation = previousJournalPresentation;
    restore();
  }
});
