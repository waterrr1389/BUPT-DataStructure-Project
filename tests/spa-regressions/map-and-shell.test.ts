import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createClassicScriptEvaluator,
  createJsonResponse,
  createSpaDomEnvironment,
  dispatchDomEvent,
  loadPublicPageFromIndexHtml,
  importSpaModule,
  requireElement,
  settleAsync,
} from "../support/spa-harness";
import { getRuntimePublicAssetPath } from "../support/runtime-public";
import {
  type AppShellModule,
  compactText,
  createDeferred,
  createExploreFixture,
  createLeafletStub,
  createMapFixture,
  expectRejects,
  type ExploreModule,
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
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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

    assert.equal(requireElement(root, "[data-map-world-link='true']").getAttribute("href"), "/map?view=world&actor=user-2");
    assert.equal(requireElement(root, ".section-head a[data-nav='true']").getAttribute("href"), "/explore?actor=user-2");
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
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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

    assert.equal(requireElement(root, "[data-map-world-link='true']").getAttribute("href"), "/map?view=world");
    assert.equal(requireElement(root, ".section-head a[data-nav='true']").getAttribute("href"), "/explore");

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
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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
    assert.equal(
      requireElement(root, "#map-waypoints").getAttribute("placeholder"),
      "Waypoint node IDs, comma-separated",
    );

    const returnLink = requireElement(root, ".section-head a[data-nav='true']");
    const worldLink = requireElement(root, "[data-map-world-link='true']");
    assert.equal(worldLink.getAttribute("href"), "/map?view=world&actor=user-2");
    assert.equal(root.innerHTML.includes(">Open World View</a>"), true);
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
    const mapControlsCard = requireElement(root, ".map-controls-card");
    assert.equal(mapControlsCard.classList.contains("route-stage-shell"), true);
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
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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

test("map world view plans cross-map itineraries, renders polyline and handoff links, and preserves marker click-through", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const runtimeGlobals = globalThis as Record<string, unknown>;
  const previousLeaflet = runtimeGlobals.L;

  try {
    const leaflet = createLeafletStub();
    runtimeGlobals.L = leaflet.L;
    const worldRoutePlanPayloads: Array<Record<string, unknown>> = [];

    const root = env.createRoot();
    const module = await importSpaModule<MapModule>("views/map.js");
    const fixture = createMapFixture({
      requestJsonImpl: async (endpoint: string, options?: Record<string, unknown>) => {
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
              {
                destinationId: "dest-2",
                iconType: "scenic-harbor",
                label: "Lantern Point",
                regionId: "region-harbor",
                x: 620,
                y: 430,
              },
            ],
            enabled: true,
            regions: [
              { id: "region-river", name: "River Arc" },
              { id: "region-harbor", name: "Harbor Line" },
            ],
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
          return {
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
                {
                  destinationId: "dest-2",
                  iconType: "scenic-harbor",
                  label: "Lantern Point",
                  portalIds: ["portal-2"],
                  radius: 22,
                  regionId: "region-harbor",
                  x: 620,
                  y: 430,
                },
              ],
              graph: {
                edges: [
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.2,
                    distance: 220,
                    from: "world-node-1",
                    id: "world-edge-1",
                    roadType: "road",
                    to: "world-node-2",
                  },
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.1,
                    distance: 180,
                    from: "world-node-2",
                    id: "world-edge-2",
                    roadType: "bridge",
                    to: "world-node-3",
                  },
                ],
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
                  {
                    id: "world-node-2",
                    kind: "hub",
                    label: "Axis Hub",
                    tags: ["hub"],
                    x: 420,
                    y: 320,
                  },
                  {
                    destinationId: "dest-2",
                    id: "world-node-3",
                    kind: "portal",
                    label: "Lantern Bridge",
                    tags: ["portal"],
                    x: 620,
                    y: 430,
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
                {
                  allowedModes: ["walk"],
                  destinationId: "dest-2",
                  direction: "bidirectional",
                  id: "portal-2",
                  label: "Lantern Lift",
                  localNodeId: "dest-2-node-a",
                  portalType: "gate",
                  priority: 1,
                  transferCost: 6,
                  transferDistance: 10,
                  worldNodeId: "world-node-3",
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
                    [120, 320],
                  ],
                  tags: [],
                },
                {
                  id: "region-harbor",
                  name: "Harbor Line",
                  polygon: [
                    [500, 240],
                    [900, 260],
                    [860, 520],
                    [560, 540],
                  ],
                  tags: ["harbor"],
                },
              ],
              width: 1024,
            },
          };
        }
        if (endpoint === "/api/world/routes/plan") {
          worldRoutePlanPayloads.push(
            JSON.parse(String((options as { body?: string } | undefined)?.body ?? "{}")) as Record<string, unknown>,
          );
          return {
            item: {
              legs: [
                {
                  cost: 18,
                  destinationId: "dest-1",
                  distance: 70,
                  localNodeIds: ["dest-1-node-a", "dest-1-node-b"],
                  scope: "destination",
                  steps: [
                    {
                      cost: 18,
                      destinationId: "dest-1",
                      distance: 70,
                      edgeId: "edge-local-a",
                      fromLocalNodeId: "dest-1-node-a",
                      kind: "local-edge",
                      mode: "walk",
                      toLocalNodeId: "dest-1-node-b",
                    },
                  ],
                },
                {
                  cost: 436,
                  distance: 422,
                  entryPortalId: "portal-1",
                  exitPortalId: "portal-2",
                  scope: "world",
                  steps: [
                    {
                      cost: 8,
                      destinationId: "dest-1",
                      distance: 12,
                      kind: "portal-transfer",
                      localNodeId: "dest-1-node-b",
                      mode: "walk",
                      portalId: "portal-1",
                      transferCost: 8,
                      transferDirection: "local-to-world",
                      transferDistance: 12,
                      worldNodeId: "world-node-1",
                    },
                    {
                      congestion: 0.2,
                      cost: 264,
                      distance: 220,
                      edgeId: "world-edge-1",
                      fromWorldNodeId: "world-node-1",
                      kind: "world-edge",
                      mode: "walk",
                      roadType: "road",
                      toWorldNodeId: "world-node-2",
                    },
                    {
                      congestion: 0.1,
                      cost: 198,
                      distance: 180,
                      edgeId: "world-edge-2",
                      fromWorldNodeId: "world-node-2",
                      kind: "world-edge",
                      mode: "walk",
                      roadType: "bridge",
                      toWorldNodeId: "world-node-3",
                    },
                    {
                      cost: 6,
                      destinationId: "dest-2",
                      distance: 10,
                      kind: "portal-transfer",
                      localNodeId: "dest-2-node-a",
                      mode: "walk",
                      portalId: "portal-2",
                      transferCost: 6,
                      transferDirection: "world-to-local",
                      transferDistance: 10,
                      worldNodeId: "world-node-3",
                    },
                  ],
                  worldNodeIds: ["world-node-1", "world-node-2", "world-node-3"],
                },
                {
                  cost: 22,
                  destinationId: "dest-2",
                  distance: 65,
                  localNodeIds: ["dest-2-node-a", "dest-2-node-b"],
                  scope: "destination",
                  steps: [
                    {
                      cost: 22,
                      destinationId: "dest-2",
                      distance: 65,
                      edgeId: "edge-local-b",
                      fromLocalNodeId: "dest-2-node-a",
                      kind: "local-edge",
                      mode: "walk",
                      toLocalNodeId: "dest-2-node-b",
                    },
                  ],
                },
              ],
              mode: "walk",
              portalSelection: {
                candidatePairCount: 3,
                entryPortalId: "portal-1",
                exitPortalId: "portal-2",
                ruleVersion: "v1",
                tieBreakOrder: ["total-cost-asc"],
              },
              reachable: true,
              scope: "cross-map",
              strategy: "distance",
              summary: {
                destinationCost: 40,
                destinationDistance: 135,
                transferCost: 14,
                transferDistance: 22,
                worldCost: 462,
                worldDistance: 400,
              },
              totalCost: 516,
              totalDistance: 557,
              usedModes: ["walk"],
            },
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
          actor: "user-2",
          mode: "walk",
          strategy: "distance",
          view: "world",
        },
      },
      root,
    );

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details"]);
    assert.equal(root.innerHTML.includes("World routing surface"), true);
    assert.equal(root.innerHTML.includes("Plan world route"), true);
    assert.equal(leaflet.records.maps.length, 1);
    assert.equal(leaflet.records.imageOverlays.length, 1);
    assert.deepEqual(leaflet.records.imageOverlays[0], {
      bounds: [
        [0, 0],
        [768, 1024],
      ],
      options: {
        interactive: false,
      },
      url: "/assets/world-map/atlas-placeholder.svg",
    });
    assert.equal(leaflet.records.polygons.length, 2);
    assert.equal(leaflet.records.markers.length, 2);
    assert.equal(leaflet.records.polylines.length, 0);
    assert.deepEqual(leaflet.records.markers[0]?.latlng, [240, 180]);
    assert.deepEqual(leaflet.records.markers[1]?.latlng, [430, 620]);

    const scopeSelect = requireElement(root, "#world-route-scope");
    scopeSelect.value = "cross-map";
    dispatchDomEvent(scopeSelect, "change");
    dispatchDomEvent(requireElement(root, "#world-route-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details", "/api/world/routes/plan"]);
    assert.deepEqual(worldRoutePlanPayloads, [
      {
        fromDestinationId: "dest-1",
        mode: "walk",
        scope: "cross-map",
        strategy: "distance",
        toDestinationId: "dest-2",
      },
    ]);
    assert.equal(leaflet.records.polylines.length, 1);
    assert.deepEqual(leaflet.records.polylines[0]?.latlngs, [
      [240, 180],
      [320, 420],
      [430, 620],
    ]);
    assert.equal(leaflet.records.polylines[0]?.bringToFrontCallCount, 1);
    const worldRouteResult = requireElement(root, "#world-route-result");
    assert.equal(compactText(worldRouteResult).includes("Cross-map itinerary"), true);
    assert.equal(compactText(worldRouteResult).includes("Route ready to follow."), true);
    assert.equal(compactText(worldRouteResult).includes("Ordered itinerary segments"), true);
    const explanationSegments = Array.from(
      worldRouteResult.querySelectorAll("[data-route-world-explanation-segment]"),
    );
    assert.equal(explanationSegments.length, 4);
    assert.deepEqual(
      explanationSegments.map((segment) => segment.getAttribute("data-route-world-explanation-order")),
      ["1", "2", "3", "4"],
    );
    assert.equal(worldRouteResult.innerHTML.includes("portal transfer portal-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("dest-1-node-b"), true);
    assert.equal(worldRouteResult.innerHTML.includes("world-node-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("direction local-to-world"), true);
    assert.equal(worldRouteResult.innerHTML.includes("world edge world-edge-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("roadType road"), true);
    assert.equal(worldRouteResult.innerHTML.includes("roadType bridge"), true);
    assert.equal(worldRouteResult.innerHTML.includes("portal transfer portal-2"), true);
    assert.equal(worldRouteResult.innerHTML.includes("world-node-3"), true);
    assert.equal(worldRouteResult.innerHTML.includes("dest-2-node-a"), true);
    assert.equal(worldRouteResult.innerHTML.includes("direction world-to-local"), true);
    assert.equal(
      requireElement(root, "[data-route-handoff='local-origin']").getAttribute("href"),
      "/map?destinationId=dest-1&from=dest-1-node-a&to=dest-1-node-b&strategy=distance&mode=walk&actor=user-2",
    );
    assert.equal(
      requireElement(root, "[data-route-handoff='world']").getAttribute("href"),
      "/map?view=world&actor=user-2",
    );
    assert.equal(
      requireElement(root, "[data-route-handoff='local-destination']").getAttribute("href"),
      "/map?destinationId=dest-2&from=dest-2-node-a&to=dest-2-node-b&strategy=distance&mode=walk&actor=user-2",
    );

    leaflet.records.markers[1]?.events.click?.();
    assert.deepEqual(fixture.navigateCalls, [
      {
        href: "/map?actor=user-2&destinationId=dest-2",
        options: undefined,
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }

    assert.equal(leaflet.records.maps[0]?.removeCallCount, 1);
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view explains unreachable cross-map prefix itineraries without requiring a full local-world-local chain", async () => {
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
      requestJsonImpl: async (endpoint: string, options?: Record<string, unknown>) => {
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
              {
                destinationId: "dest-2",
                iconType: "scenic-harbor",
                label: "Lantern Point",
                regionId: "region-harbor",
                x: 620,
                y: 430,
              },
            ],
            enabled: true,
            regions: [
              { id: "region-river", name: "River Arc" },
              { id: "region-harbor", name: "Harbor Line" },
            ],
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
          return {
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
                {
                  destinationId: "dest-2",
                  iconType: "scenic-harbor",
                  label: "Lantern Point",
                  portalIds: ["portal-2"],
                  radius: 22,
                  regionId: "region-harbor",
                  x: 620,
                  y: 430,
                },
              ],
              graph: {
                edges: [
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.2,
                    distance: 220,
                    from: "world-node-1",
                    id: "world-edge-1",
                    roadType: "tunnel",
                    to: "world-node-2",
                  },
                ],
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
                  {
                    id: "world-node-2",
                    kind: "hub",
                    label: "Axis Hub",
                    tags: ["hub"],
                    x: 420,
                    y: 320,
                  },
                  {
                    destinationId: "dest-2",
                    id: "world-node-3",
                    kind: "portal",
                    label: "Lantern Bridge",
                    tags: ["portal"],
                    x: 620,
                    y: 430,
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
                {
                  allowedModes: ["walk"],
                  destinationId: "dest-2",
                  direction: "bidirectional",
                  id: "portal-2",
                  label: "Lantern Lift",
                  localNodeId: "dest-2-node-a",
                  portalType: "gate",
                  priority: 1,
                  transferCost: 6,
                  transferDistance: 10,
                  worldNodeId: "world-node-3",
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
                    [120, 320],
                  ],
                  tags: [],
                },
                {
                  id: "region-harbor",
                  name: "Harbor Line",
                  polygon: [
                    [500, 240],
                    [900, 260],
                    [860, 520],
                    [560, 540],
                  ],
                  tags: ["harbor"],
                },
              ],
              width: 1024,
            },
          };
        }

        if (endpoint === "/api/world/routes/plan") {
          assert.deepEqual(
            JSON.parse(String((options as { body?: string } | undefined)?.body ?? "{}")),
            {
              fromDestinationId: "dest-1",
              mode: "walk",
              scope: "cross-map",
              strategy: "distance",
              toDestinationId: "dest-2",
            },
          );
          return {
            item: {
              failure: {
                blockedFrom: "dest-2-node-a",
                blockedTo: "dest-2-node-b",
                code: "world_route_local_unreachable",
                reason: "local_graph_disconnected",
                stage: "destination-leg",
              },
              legs: [
                {
                  cost: 18,
                  destinationId: "dest-1",
                  distance: 70,
                  localNodeIds: ["dest-1-node-a", "dest-1-node-b"],
                  scope: "destination",
                  steps: [
                    {
                      cost: 18,
                      destinationId: "dest-1",
                      distance: 70,
                      edgeId: "edge-local-a",
                      fromLocalNodeId: "dest-1-node-a",
                      kind: "local-edge",
                      mode: "walk",
                      toLocalNodeId: "dest-1-node-b",
                    },
                  ],
                },
                {
                  cost: 272,
                  distance: 232,
                  entryPortalId: "portal-1",
                  exitPortalId: "portal-2",
                  scope: "world",
                  steps: [
                    {
                      cost: 8,
                      destinationId: "dest-1",
                      distance: 12,
                      kind: "portal-transfer",
                      localNodeId: "dest-1-node-b",
                      mode: "walk",
                      portalId: "portal-1",
                      transferCost: 8,
                      transferDirection: "local-to-world",
                      transferDistance: 12,
                      worldNodeId: "world-node-1",
                    },
                    {
                      congestion: 0.2,
                      cost: 264,
                      distance: 220,
                      edgeId: "world-edge-1",
                      fromWorldNodeId: "world-node-1",
                      kind: "world-edge",
                      mode: "walk",
                      roadType: "tunnel",
                      toWorldNodeId: "world-node-2",
                    },
                  ],
                  worldNodeIds: ["world-node-1", "world-node-2"],
                },
              ],
              mode: "walk",
              portalSelection: {
                candidatePairCount: 1,
                entryPortalId: "portal-1",
                exitPortalId: "portal-2",
                ruleVersion: "v1",
                tieBreakOrder: ["total-cost-asc"],
              },
              reachable: false,
              scope: "cross-map",
              strategy: "distance",
              summary: {
                destinationCost: 18,
                destinationDistance: 70,
                transferCost: 8,
                transferDistance: 12,
                worldCost: 264,
                worldDistance: 220,
              },
              totalCost: 290,
              totalDistance: 302,
              usedModes: ["walk"],
            },
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
          mode: "walk",
          strategy: "distance",
          view: "world",
        },
      },
      root,
    );

    const scopeSelect = requireElement(root, "#world-route-scope");
    scopeSelect.value = "cross-map";
    dispatchDomEvent(scopeSelect, "change");
    dispatchDomEvent(requireElement(root, "#world-route-form"), "submit");
    await settleAsync();

    assert.equal(leaflet.records.polylines.length, 1);
    assert.deepEqual(leaflet.records.polylines[0]?.latlngs, [
      [240, 180],
      [320, 420],
    ]);
    const worldRouteResult = requireElement(root, "#world-route-result");
    assert.equal(compactText(worldRouteResult).includes("Route returned an incomplete itinerary."), true);
    assert.equal(compactText(worldRouteResult).includes("destination leg blocked due to local graph disconnected"), true);
    const explanationSegments = Array.from(
      worldRouteResult.querySelectorAll("[data-route-world-explanation-segment]"),
    );
    assert.equal(explanationSegments.length, 2);
    assert.deepEqual(
      explanationSegments.map((segment) => segment.getAttribute("data-route-world-explanation-order")),
      ["1", "2"],
    );
    assert.equal(worldRouteResult.innerHTML.includes("portal transfer portal-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("dest-1-node-b"), true);
    assert.equal(worldRouteResult.innerHTML.includes("world-node-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("direction local-to-world"), true);
    assert.equal(worldRouteResult.innerHTML.includes("world edge world-edge-1"), true);
    assert.equal(worldRouteResult.innerHTML.includes("roadType tunnel"), true);
    assert.equal(
      requireElement(root, "[data-route-handoff='local-origin']").getAttribute("href"),
      "/map?destinationId=dest-1&from=dest-1-node-a&to=dest-1-node-b&strategy=distance&mode=walk",
    );
    assert.equal(
      requireElement(root, "[data-route-handoff='world']").getAttribute("href"),
      "/map?view=world",
    );
    const destinationHandoff = requireElement(root, "[data-route-handoff='local-destination']");
    assert.equal(destinationHandoff.tagName, "span");
    assert.equal(worldRouteResult.innerHTML.includes("Destination local map unavailable"), true);

    if (typeof cleanup === "function") {
      cleanup();
    }

    assert.equal(leaflet.records.maps[0]?.removeCallCount, 1);
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view accepts zero-distance world edges in world details payload", async () => {
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
          return {
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
                edges: [
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.2,
                    distance: 0,
                    from: "world-node-1",
                    id: "world-edge-1",
                    roadType: "road",
                    to: "world-node-2",
                  },
                ],
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
                  {
                    id: "world-node-2",
                    kind: "hub",
                    label: "Axis Hub",
                    tags: ["hub"],
                    x: 420,
                    y: 320,
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

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details"]);
    assert.equal(root.innerHTML.includes("World routing surface"), true);
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("World details unavailable"), false);
    assert.equal(leaflet.records.maps.length, 1);
    assert.equal(
      fixture.statuses.some(
        (status) =>
          status.tone === "error" && status.message.startsWith("World details are malformed:"),
      ),
      false,
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view downgrades to unavailable when world details payload is malformed", async () => {
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
          return {
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
                edges: [
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.2,
                    distance: 220,
                    from: "world-node-1",
                    id: "world-edge-1",
                    roadType: "road",
                    to: "world-node-2",
                  },
                ],
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
                  {
                    id: "world-node-2",
                    kind: "hub",
                    label: "Axis Hub",
                    tags: ["hub"],
                    x: 420,
                    y: 320,
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
                    [1200, 340],
                  ],
                  tags: [],
                },
              ],
              width: 1024,
            },
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

    assert.deepEqual(fixture.requestJsonCalls, ["/api/world", "/api/world/details"]);
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("World details unavailable"), true);
    assert.equal(leaflet.records.maps.length, 0);
    assert.equal(compactText(requireElement(root, "#world-route-result")).includes("controls are unavailable"), true);
    assert.equal(fixture.statuses[0]?.tone, "error");
    assert.equal(String(fixture.statuses[0]?.message ?? "").startsWith("World details are malformed:"), true);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map world view renders route failure state and clears active world polyline", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const runtimeGlobals = globalThis as Record<string, unknown>;
  const previousLeaflet = runtimeGlobals.L;

  try {
    const leaflet = createLeafletStub();
    runtimeGlobals.L = leaflet.L;
    let routePlanCallCount = 0;

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
              {
                destinationId: "dest-2",
                iconType: "scenic-harbor",
                label: "Lantern Point",
                regionId: "region-harbor",
                x: 620,
                y: 430,
              },
            ],
            enabled: true,
            regions: [
              { id: "region-river", name: "River Arc" },
              { id: "region-harbor", name: "Harbor Line" },
            ],
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
          return {
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
                {
                  destinationId: "dest-2",
                  iconType: "scenic-harbor",
                  label: "Lantern Point",
                  portalIds: ["portal-2"],
                  radius: 22,
                  regionId: "region-harbor",
                  x: 620,
                  y: 430,
                },
              ],
              graph: {
                edges: [
                  {
                    allowedModes: ["walk"],
                    bidirectional: true,
                    congestion: 0.2,
                    distance: 220,
                    from: "world-node-1",
                    id: "world-edge-1",
                    roadType: "road",
                    to: "world-node-2",
                  },
                ],
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
                  {
                    id: "world-node-2",
                    kind: "hub",
                    label: "Axis Hub",
                    tags: ["hub"],
                    x: 620,
                    y: 430,
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
                {
                  allowedModes: ["walk"],
                  destinationId: "dest-2",
                  direction: "bidirectional",
                  id: "portal-2",
                  label: "Lantern Lift",
                  localNodeId: "dest-2-node-a",
                  portalType: "gate",
                  priority: 1,
                  transferCost: 6,
                  transferDistance: 10,
                  worldNodeId: "world-node-2",
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
                    [120, 320],
                  ],
                  tags: ["river"],
                },
                {
                  id: "region-harbor",
                  name: "Harbor Line",
                  polygon: [
                    [500, 240],
                    [900, 260],
                    [860, 520],
                    [560, 540],
                  ],
                  tags: ["harbor"],
                },
              ],
              width: 1024,
            },
          };
        }

        if (endpoint === "/api/world/routes/plan") {
          routePlanCallCount += 1;
          if (routePlanCallCount === 1) {
            return {
              item: {
                legs: [
                  {
                    cost: 220,
                    distance: 220,
                    scope: "world",
                    steps: [
                      {
                        congestion: 0.2,
                        cost: 264,
                        distance: 220,
                        edgeId: "world-edge-1",
                        fromWorldNodeId: "world-node-1",
                        kind: "world-edge",
                        mode: "walk",
                        roadType: "road",
                        toWorldNodeId: "world-node-2",
                      },
                    ],
                    worldNodeIds: ["world-node-1", "world-node-2"],
                  },
                ],
                mode: "walk",
                reachable: true,
                scope: "world-only",
                strategy: "distance",
                summary: {
                  destinationCost: 0,
                  destinationDistance: 0,
                  transferCost: 0,
                  transferDistance: 0,
                  worldCost: 264,
                  worldDistance: 220,
                },
                totalCost: 264,
                totalDistance: 220,
                usedModes: ["walk"],
              },
            };
          }
          throw new Error("World route service unavailable.");
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

    dispatchDomEvent(requireElement(root, "#world-route-form"), "submit");
    await settleAsync();
    assert.equal(leaflet.records.polylines.length, 1);
    assert.equal(leaflet.records.polylines[0]?.removeCallCount, 0);

    dispatchDomEvent(requireElement(root, "#world-route-form"), "submit");
    await settleAsync();
    assert.equal(routePlanCallCount, 2);
    assert.equal(compactText(requireElement(root, "#world-route-result")).includes("Route planning failed"), true);
    assert.equal(leaflet.records.maps[0]?.removeLayerCalls.length, 1);
    assert.equal(leaflet.records.polylines[0]?.removeCallCount, 1);
    const latestStatus = fixture.statuses[fixture.statuses.length - 1];
    assert.equal(latestStatus?.tone, "error");
    assert.equal(latestStatus?.message, "World route service unavailable.");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    runtimeGlobals.L = previousLeaflet;
    restore();
  }
});

test("map local view keeps using local route planning endpoints after world route enhancements", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const globals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: unknown;
  };
  const previousRouteVisualizationMarkers = globals.RouteVisualizationMarkers;

  try {
    globals.RouteVisualizationMarkers = requireRuntimePublicModule("route-visualization-markers.js");

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

    dispatchDomEvent(requireElement(root, "#map-route-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/routes/plan"]);
    assert.equal(fixture.requestJsonCalls.includes("/api/world"), false);
    assert.equal(fixture.requestJsonCalls.includes("/api/world/routes/plan"), false);
    assert.equal(
      requireElement(root, "[data-map-world-link='true']").getAttribute("href"),
      "/map?view=world&actor=user-2",
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    globals.RouteVisualizationMarkers = previousRouteVisualizationMarkers;
    restore();
  }
});

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
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("World map unavailable"), true);
    assert.equal(leaflet.records.maps.length, 0);
    assert.deepEqual(fixture.statuses, [
      {
        message: "World mode is unavailable.",
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
    assert.equal(requireElement(root, "#world-map-stage").innerHTML.includes("World details unavailable"), true);
    assert.equal(leaflet.records.maps.length, 0);
    assert.deepEqual(fixture.statuses, [
      {
        message: "World details worker offline.",
        tone: "error",
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
    assert.equal(compactText(root.innerHTML).includes("Browser shell unavailable"), true);
    assert.equal(compactText(root.innerHTML).includes("Bootstrap exploded."), true);
    assert.equal(compactText(root.innerHTML).includes("Reload the shell"), true);
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
    assert.deepEqual(requests, ["/api/bootstrap", "/api/feed?limit=3"]);
    assert.equal(requireElement(root, ".site-brand").getAttribute("href"), "/");
    assert.equal(requireElement(root, "#status-pill").textContent, "Runtime data: seeded. Algorithms: fallback.");
    assert.equal(requireElement(root, "#status-pill").dataset.tone, "success");
    assert.equal(requireElement(root, "#view-root").innerHTML.includes("Start with a destination, not a control panel"), true);
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
