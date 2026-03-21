import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER } from "../src/services/contracts";
import { createAppServices, type AppServices } from "../src/services/index";
import { deriveWorldRuntimeState } from "../src/services/runtime";
import { isWorldRouteServiceError } from "../src/services/world-route-service";

// These package-level checks depend on the runtime/service wiring the external algorithm bundle.
// Use an isolated runtimeDir because JournalStore persists the seed journals on disk.
function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
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

const SEEDED_JOURNAL_DESTINATION_IDS = [
  "dest-001",
  "dest-004",
  "dest-007",
  "dest-010",
  "dest-013",
  "dest-016",
  "dest-019",
  "dest-022",
  "dest-025",
  "dest-028",
  "dest-031",
  "dest-034",
] as const;

async function createIsolatedApp(name: string): Promise<AppServices> {
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-runtime-services-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(runtimeDir, { recursive: true });
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();
  return app;
}

async function createRuntimeDir(name: string): Promise<string> {
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-runtime-services-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(runtimeDir, { recursive: true });
  return runtimeDir;
}

function disableWorld(app: AppServices): void {
  app.runtime.seedData = {
    ...app.runtime.seedData,
    world: undefined,
  };
  app.runtime.lookups.world = undefined;
  app.runtime.world = deriveWorldRuntimeState(app.runtime.seedData);
}

function cloneWorld(app: AppServices) {
  const world = app.runtime.seedData.world;
  if (!world) {
    throw new Error("World mode is unavailable.");
  }
  return JSON.parse(JSON.stringify(world)) as typeof world;
}

function applyWorld(app: AppServices, world: NonNullable<AppServices["runtime"]["seedData"]["world"]>): void {
  app.runtime.seedData = {
    ...app.runtime.seedData,
    world,
  };
  app.runtime.lookups.world = world;
  app.runtime.world = deriveWorldRuntimeState(app.runtime.seedData);
}

function addWorldStrategyFork(world: NonNullable<AppServices["runtime"]["seedData"]["world"]>): void {
  world.graph.nodes.push({
    id: "world-node-strategy-fork",
    x: 890,
    y: 1160,
    kind: "junction",
    label: "Strategy Fork Junction",
    tags: ["strategy", "test-only"],
  });
  world.graph.edges.push(
    {
      id: "world-edge-strategy-distance-1",
      from: "world-node-dest-002-main",
      to: "world-node-strategy-fork",
      distance: 200,
      roadType: "road",
      allowedModes: ["walk", "bike", "shuttle", "mixed"],
      congestion: 0.9,
      bidirectional: true,
    },
    {
      id: "world-edge-strategy-distance-2",
      from: "world-node-strategy-fork",
      to: "world-node-dest-004-main",
      distance: 200,
      roadType: "road",
      allowedModes: ["walk", "bike", "shuttle", "mixed"],
      congestion: 0.9,
      bidirectional: true,
    },
    {
      id: "world-edge-strategy-mixed-direct",
      from: "world-node-dest-002-main",
      to: "world-node-dest-004-main",
      distance: 500,
      roadType: "road",
      allowedModes: ["walk", "bike", "shuttle", "mixed"],
      congestion: 0.01,
      bidirectional: true,
    },
  );
}

function destinationIds(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id);
}

function destinationById(app: AppServices, destinationId: string) {
  const destination = app.runtime.seedData.destinations.find((entry) => entry.id === destinationId);
  if (!destination) {
    throw new Error(format({ destinationId }));
  }
  return destination;
}

function nodePosition(app: AppServices, destinationId: string, suffix: string) {
  const destination = destinationById(app, destinationId);
  const node = destination.graph.nodes.find((entry) => entry.id === `${destinationId}-${suffix}`);
  if (!node) {
    throw new Error(format({ destinationId, suffix }));
  }
  return { x: node.x, y: node.y };
}

function edgeIds(app: AppServices, destinationId: string): string[] {
  return destinationById(app, destinationId).graph.edges.map((edge) => edge.id).sort();
}

function worldEdgeIdsFromLeg(leg: Record<string, unknown> | undefined): string[] {
  return (Array.isArray(leg?.steps) ? leg.steps : [])
    .filter((step): step is { edgeId: string; kind: string } =>
      Boolean(step) &&
      typeof step === "object" &&
      "kind" in step &&
      "edgeId" in step &&
      (step as { kind?: unknown }).kind === "world-edge" &&
      typeof (step as { edgeId?: unknown }).edgeId === "string",
    )
    .map((step) => step.edgeId);
}

test("createAppServices resolves the real seed with external algorithms", async () => {
  const app = await createIsolatedApp("source");

  assert.equal(app.runtime.source.data, "external");
  assert.equal(app.runtime.source.algorithms, "external");
});

test("destination search rejects invalid sortBy values", async () => {
  const app = await createIsolatedApp("sort-by");

  assert.throws(() => {
    app.destinations.search({
      query: "harbor",
      sortBy: "bogus" as never,
    });
  });
});

test("bootstrap exposes full destination catalog for seeded journal lookups and keeps featured unchanged", async () => {
  const app = await createIsolatedApp("bootstrap-destinations");
  const bootstrap = await app.bootstrap();
  const featured = bootstrap.featured as Array<{ id: string }>;
  const destinations = bootstrap.destinations as Array<{ id: string }>;
  const users = bootstrap.users as Array<Record<string, unknown>>;
  const seededJournalDestinationIds = app.runtime.seedData.journals.map((journal) => journal.destinationId);

  assert.deepEqual(seededJournalDestinationIds, [...SEEDED_JOURNAL_DESTINATION_IDS]);
  assert.equal(destinations.length, app.runtime.seedData.destinations.length);
  assert.deepEqual(destinationIds(featured), destinationIds(app.destinations.listCatalog(12) as Array<{ id: string }>));
  assert.equal(featured.length, 12);
  assert.equal(featured.some((destination) => destination.id === "dest-013"), false, format(featured));

  for (const destinationId of SEEDED_JOURNAL_DESTINATION_IDS) {
    assert.ok(
      destinations.some((destination) => destination.id === destinationId),
      format({ destinationId, destinationIds: destinationIds(destinations) }),
    );
  }

  assert.equal("graph" in (destinations[0] ?? {}), false, format(destinations[0]));
  assert.equal("buildings" in (destinations[0] ?? {}), false, format(destinations[0]));
  assert.equal("world" in bootstrap, false, format(bootstrap));
  assert.equal("interests" in (users[0] ?? {}), false, format(users[0]));
  assert.deepEqual(
    Object.keys(users[0] ?? {}).sort(),
    ["id", "name"],
    format(users[0]),
  );
});

test("runtime derives read-only world capabilities and world service keeps summary and details separate", async () => {
  const app = await createIsolatedApp("world-summary");
  const summary = app.world.summary();
  const details = app.world.details();

  assert.deepEqual(app.runtime.world, {
    available: true,
    capabilities: {
      worldView: true,
      destinationRouting: true,
      crossMapRouting: true,
    },
  });
  assert.equal(app.runtime.lookups.world, app.runtime.seedData.world);
  assert.equal(summary.enabled, true, format(summary));
  assert.deepEqual(summary.capabilities, app.runtime.world.capabilities, format(summary.capabilities));
  assert.deepEqual(
    Object.keys(summary.world ?? {}).sort(),
    ["backgroundImage", "height", "id", "name", "width"],
    format(summary.world),
  );
  assert.equal("polygon" in (summary.regions[0] ?? {}), false, format(summary.regions[0]));
  assert.equal("tags" in (summary.regions[0] ?? {}), false, format(summary.regions[0]));
  assert.equal("radius" in (summary.destinations[0] ?? {}), false, format(summary.destinations[0]));
  assert.equal("portalIds" in (summary.destinations[0] ?? {}), false, format(summary.destinations[0]));
  assert.equal(details.world.id, app.runtime.seedData.world?.id);
  assert.equal(details.world.regions.length > 0, true, format(details.world.regions));
  assert.equal(details.world.graph.nodes.length > 0, true, format(details.world.graph));
  assert.equal(details.world.portals.length > 0, true, format(details.world.portals));
});

test("world service exposes disabled summary and unavailable details when world mode is absent", async () => {
  const app = await createIsolatedApp("world-unavailable");
  disableWorld(app);

  const summary = app.world.summary();

  assert.equal(app.world.isAvailable(), false);
  assert.equal(app.runtime.lookups.world, undefined);
  assert.deepEqual(summary, {
    enabled: false,
    regions: [],
    destinations: [],
    capabilities: {
      worldView: false,
      destinationRouting: false,
      crossMapRouting: false,
    },
  });
  assert.deepEqual(app.world.unavailable(), {
    error: "World mode is unavailable.",
    code: "world_unavailable",
  });
  assert.throws(() => app.world.details(), /World mode is unavailable\./);
});

test("world route service plans cross-map destination-to-destination routes using zero-length local boundary legs", async () => {
  const app = await createIsolatedApp("world-routing-destination-to-destination");
  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<Record<string, unknown>>;
    portalSelection: Record<string, unknown>;
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.legs.length, 3, format(itinerary.legs));
  assert.equal(itinerary.legs[0]?.scope, "destination", format(itinerary.legs[0]));
  assert.equal(itinerary.legs[0]?.distance, 0, format(itinerary.legs[0]));
  assert.equal(Array.isArray(itinerary.legs[0]?.steps), true, format(itinerary.legs[0]));
  assert.equal((itinerary.legs[0]?.steps as unknown[]).length, 0, format(itinerary.legs[0]));
  assert.equal(itinerary.legs[1]?.scope, "world", format(itinerary.legs[1]));
  assert.equal(itinerary.legs[2]?.scope, "destination", format(itinerary.legs[2]));
  assert.equal(itinerary.legs[2]?.distance, 0, format(itinerary.legs[2]));
  assert.equal(itinerary.portalSelection.entryPortalId, "portal-dest-002-main");
  assert.equal(itinerary.portalSelection.exitPortalId, "portal-dest-004-main");
});

test("world route service plans world-only routes from world node to world node", async () => {
  const app = await createIsolatedApp("world-routing-world-only");
  const itinerary = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    scope: string;
    legs: Array<Record<string, unknown>>;
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.scope, "world-only", format(itinerary));
  assert.equal(itinerary.legs.length, 1, format(itinerary.legs));
  assert.equal(itinerary.legs[0]?.scope, "world", format(itinerary.legs[0]));
  assert.equal(
    (itinerary.legs[0]?.steps as Array<{ kind?: string }>).every((step) => step.kind === "world-edge"),
    true,
    format(itinerary.legs[0]),
  );
});

test("world route service applies strategy-specific world weighting for world-only routes", async () => {
  const app = await createIsolatedApp("world-routing-world-only-strategy-weighting");
  const world = cloneWorld(app);
  addWorldStrategyFork(world);
  applyWorld(app, world);

  const distanceItinerary = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<{
      steps: Array<{ edgeId: string }>;
      distance: number;
      cost: number;
    }>;
    summary: {
      worldDistance: number;
      worldCost: number;
    };
  };

  const mixedItinerary = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "mixed",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<{
      steps: Array<{ edgeId: string }>;
      distance: number;
      cost: number;
    }>;
    summary: {
      worldDistance: number;
      worldCost: number;
    };
  };

  assert.equal(distanceItinerary.reachable, true, format(distanceItinerary));
  assert.equal(mixedItinerary.reachable, true, format(mixedItinerary));
  assert.deepEqual(
    distanceItinerary.legs[0]?.steps.map((step) => step.edgeId),
    ["world-edge-strategy-distance-1", "world-edge-strategy-distance-2"],
    format(distanceItinerary.legs[0]),
  );
  assert.deepEqual(
    mixedItinerary.legs[0]?.steps.map((step) => step.edgeId),
    ["world-edge-strategy-mixed-direct"],
    format(mixedItinerary.legs[0]),
  );
  assert.equal(distanceItinerary.summary.worldDistance, 400, format(distanceItinerary.summary));
  assert.equal(distanceItinerary.summary.worldCost, 760, format(distanceItinerary.summary));
  assert.equal(mixedItinerary.summary.worldDistance, 500, format(mixedItinerary.summary));
  assert.equal(mixedItinerary.summary.worldCost, 505, format(mixedItinerary.summary));
});

test("world route service returns world_route_mode_not_allowed when world-only traversal is blocked by world edges", async () => {
  const app = await createIsolatedApp("world-routing-world-only-mode-not-allowed");
  const world = cloneWorld(app);
  world.graph.edges = world.graph.edges.map((edge) =>
    edge.id === "world-edge-west-to-crossing" || edge.id === "world-edge-west-to-central"
      ? { ...edge, allowedModes: ["shuttle", "mixed"] }
      : edge,
  );
  applyWorld(app, world);

  try {
    app.worldRouting.plan({
      scope: "world-only",
      fromWorldNodeId: "world-node-dest-002-main",
      toWorldNodeId: "world-node-dest-004-main",
      strategy: "distance",
      mode: "walk",
    });
  } catch (error) {
    assert.equal(isWorldRouteServiceError(error), true, format(error));
    if (!isWorldRouteServiceError(error)) {
      throw error;
    }
    assert.equal(error.statusCode, 422, format(error.payload));
    assert.deepEqual(error.payload, {
      error: "Route mode is not allowed by selected edges or portals.",
      code: "world_route_mode_not_allowed",
      mode: "walk",
      allowedModes: ["shuttle", "mixed"],
    });
    return;
  }

  throw new Error("Expected world-only planning to fail with world_route_mode_not_allowed.");
});

test("world route service respects strategy weighting for world-only and cross-map routes", async () => {
  const app = await createIsolatedApp("world-routing-strategy-weighting");
  const world = cloneWorld(app);

  world.graph.nodes = world.graph.nodes.filter(
    (node) => node.id === "world-node-dest-002-main" || node.id === "world-node-dest-004-main",
  );
  world.graph.nodes.push({
    id: "world-node-strategy-detour",
    kind: "junction",
    label: "Strategy Detour",
    tags: ["detour"],
    x: 300,
    y: 280,
  });
  world.graph.edges = [
    {
      id: "world-edge-strategy-direct",
      from: "world-node-dest-002-main",
      to: "world-node-dest-004-main",
      distance: 100,
      roadType: "road",
      allowedModes: ["walk"],
      congestion: 1,
      bidirectional: true,
    },
    {
      id: "world-edge-strategy-detour-a",
      from: "world-node-dest-002-main",
      to: "world-node-strategy-detour",
      distance: 80,
      roadType: "road",
      allowedModes: ["walk"],
      congestion: 0,
      bidirectional: true,
    },
    {
      id: "world-edge-strategy-detour-b",
      from: "world-node-strategy-detour",
      to: "world-node-dest-004-main",
      distance: 80,
      roadType: "road",
      allowedModes: ["walk"],
      congestion: 0,
      bidirectional: true,
    },
  ];
  applyWorld(app, world);

  const worldOnlyDistance = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    legs: Array<Record<string, unknown>>;
    reachable: boolean;
  };
  const worldOnlyTime = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "time",
    mode: "walk",
  }) as unknown as {
    legs: Array<Record<string, unknown>>;
    reachable: boolean;
  };
  const crossMapDistance = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    legs: Array<Record<string, unknown>>;
    reachable: boolean;
  };
  const crossMapMixed = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "mixed",
    mode: "walk",
  }) as unknown as {
    legs: Array<Record<string, unknown>>;
    reachable: boolean;
  };

  assert.equal(worldOnlyDistance.reachable, true, format(worldOnlyDistance));
  assert.equal(worldOnlyTime.reachable, true, format(worldOnlyTime));
  assert.equal(crossMapDistance.reachable, true, format(crossMapDistance));
  assert.equal(crossMapMixed.reachable, true, format(crossMapMixed));
  assert.deepEqual(worldEdgeIdsFromLeg(worldOnlyDistance.legs[0]), ["world-edge-strategy-direct"]);
  assert.deepEqual(
    worldEdgeIdsFromLeg(worldOnlyTime.legs[0]),
    ["world-edge-strategy-detour-a", "world-edge-strategy-detour-b"],
  );
  assert.deepEqual(worldEdgeIdsFromLeg(crossMapDistance.legs[1]), ["world-edge-strategy-direct"]);
  assert.deepEqual(
    worldEdgeIdsFromLeg(crossMapMixed.legs[1]),
    ["world-edge-strategy-detour-a", "world-edge-strategy-detour-b"],
  );
});

test("world route service supports zero-distance world edges during routing", async () => {
  const app = await createIsolatedApp("world-routing-zero-distance");
  const world = cloneWorld(app);

  world.graph.nodes = world.graph.nodes.filter(
    (node) => node.id === "world-node-dest-002-main" || node.id === "world-node-dest-004-main",
  );
  world.graph.edges = [
    {
      id: "world-edge-zero-distance",
      from: "world-node-dest-002-main",
      to: "world-node-dest-004-main",
      distance: 0,
      roadType: "road",
      allowedModes: ["walk"],
      congestion: 0,
      bidirectional: true,
    },
  ];
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "world-only",
    fromWorldNodeId: "world-node-dest-002-main",
    toWorldNodeId: "world-node-dest-004-main",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    legs: Array<Record<string, unknown>>;
    reachable: boolean;
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.deepEqual(worldEdgeIdsFromLeg(itinerary.legs[0]), ["world-edge-zero-distance"]);
  assert.equal(itinerary.legs[0]?.distance, 0, format(itinerary.legs[0]));
});

test("world route service plans cross-map routes between explicit local nodes", async () => {
  const app = await createIsolatedApp("world-routing-local-to-local");
  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    fromLocalNodeId: "dest-002-archive",
    toLocalNodeId: "dest-004-archive",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<Record<string, unknown>>;
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.legs.length, 3, format(itinerary.legs));
  const originLocalLeg = itinerary.legs[0];
  const targetLocalLeg = itinerary.legs[2];
  assert.equal(originLocalLeg?.scope, "destination", format(originLocalLeg));
  assert.equal(targetLocalLeg?.scope, "destination", format(targetLocalLeg));
  assert.equal((originLocalLeg?.localNodeIds as string[])[0], "dest-002-archive", format(originLocalLeg));
  assert.equal(
    (originLocalLeg?.localNodeIds as string[])[(originLocalLeg?.localNodeIds as string[]).length - 1],
    "dest-002-gate",
    format(originLocalLeg),
  );
  assert.equal((targetLocalLeg?.localNodeIds as string[])[0], "dest-004-gate", format(targetLocalLeg));
  assert.equal(
    (targetLocalLeg?.localNodeIds as string[])[(targetLocalLeg?.localNodeIds as string[]).length - 1],
    "dest-004-archive",
    format(targetLocalLeg),
  );
  assert.equal((originLocalLeg?.steps as unknown[]).length > 0, true, format(originLocalLeg));
  assert.equal((targetLocalLeg?.steps as unknown[]).length > 0, true, format(targetLocalLeg));
});

test("world route service applies strategy-specific world weighting for cross-map routes", async () => {
  const app = await createIsolatedApp("world-routing-cross-map-strategy-weighting");
  const world = cloneWorld(app);
  addWorldStrategyFork(world);
  applyWorld(app, world);

  const distanceItinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<{
      scope: string;
      steps: Array<{ kind: string; edgeId?: string }>;
      distance: number;
      cost: number;
    }>;
    summary: {
      worldDistance: number;
      worldCost: number;
    };
    portalSelection: {
      entryPortalId: string;
      exitPortalId: string;
    };
  };

  const mixedItinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "mixed",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<{
      scope: string;
      steps: Array<{ kind: string; edgeId?: string }>;
      distance: number;
      cost: number;
    }>;
    summary: {
      worldDistance: number;
      worldCost: number;
    };
    portalSelection: {
      entryPortalId: string;
      exitPortalId: string;
    };
  };

  assert.equal(distanceItinerary.reachable, true, format(distanceItinerary));
  assert.equal(mixedItinerary.reachable, true, format(mixedItinerary));
  assert.equal(distanceItinerary.legs[1]?.scope, "world", format(distanceItinerary.legs[1]));
  assert.equal(mixedItinerary.legs[1]?.scope, "world", format(mixedItinerary.legs[1]));
  assert.deepEqual(
    distanceItinerary.legs[1]?.steps
      .filter((step) => step.kind === "world-edge")
      .map((step) => step.edgeId),
    ["world-edge-strategy-distance-1", "world-edge-strategy-distance-2"],
    format(distanceItinerary.legs[1]),
  );
  assert.deepEqual(
    mixedItinerary.legs[1]?.steps
      .filter((step) => step.kind === "world-edge")
      .map((step) => step.edgeId),
    ["world-edge-strategy-mixed-direct"],
    format(mixedItinerary.legs[1]),
  );
  assert.equal(distanceItinerary.summary.worldDistance, 400, format(distanceItinerary.summary));
  assert.equal(distanceItinerary.summary.worldCost, 760, format(distanceItinerary.summary));
  assert.equal(mixedItinerary.summary.worldDistance, 500, format(mixedItinerary.summary));
  assert.equal(mixedItinerary.summary.worldCost, 505, format(mixedItinerary.summary));
  assert.equal(distanceItinerary.portalSelection.entryPortalId, "portal-dest-002-main");
  assert.equal(distanceItinerary.portalSelection.exitPortalId, "portal-dest-004-main");
  assert.equal(mixedItinerary.portalSelection.entryPortalId, "portal-dest-002-main");
  assert.equal(mixedItinerary.portalSelection.exitPortalId, "portal-dest-004-main");
});

test("world route service respects mode-restricted portal candidates during deterministic selection", async () => {
  const app = await createIsolatedApp("world-routing-mode-portal-selection");
  const world = cloneWorld(app);
  const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
  const targetMain = world.portals.find((portal) => portal.id === "portal-dest-004-main");
  if (!originMain || !targetMain) {
    throw new Error(format({ originMain, targetMain }));
  }

  world.portals.push(
    {
      ...originMain,
      id: "portal-dest-002-bike-only-fast",
      label: "River Polytechnic Bike Connector",
      allowedModes: ["bike"],
      priority: 300,
      transferDistance: 2,
      transferCost: 1,
    },
    {
      ...originMain,
      id: "portal-dest-002-walk-only-fast",
      label: "River Polytechnic Walk Connector",
      allowedModes: ["walk"],
      priority: 200,
      transferDistance: 2,
      transferCost: 1,
    },
    {
      ...targetMain,
      id: "portal-dest-004-bike-only-fast",
      label: "Summit Learning Hub Bike Connector",
      allowedModes: ["bike"],
      priority: 300,
      transferDistance: 2,
      transferCost: 1,
    },
    {
      ...targetMain,
      id: "portal-dest-004-walk-only-fast",
      label: "Summit Learning Hub Walk Connector",
      allowedModes: ["walk"],
      priority: 200,
      transferDistance: 2,
      transferCost: 1,
    },
  );
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    portalSelection: { entryPortalId: string; exitPortalId: string };
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.portalSelection.entryPortalId, "portal-dest-002-walk-only-fast");
  assert.equal(itinerary.portalSelection.exitPortalId, "portal-dest-004-walk-only-fast");
});

test("world route service ignores an unused misconfigured lower-priority portal when a valid cross-map route exists", async () => {
  const app = await createIsolatedApp("world-routing-unused-misconfigured-portal");
  const world = cloneWorld(app);
  const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
  if (!originMain) {
    throw new Error(format({ originMain }));
  }

  world.portals.push({
    ...originMain,
    id: "portal-dest-002-broken-low-priority",
    label: "River Polytechnic Broken Connector",
    localNodeId: "dest-002-missing-node",
    priority: 1,
  });
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    portalSelection: { entryPortalId: string; exitPortalId: string };
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.portalSelection.entryPortalId, "portal-dest-002-main");
  assert.equal(itinerary.portalSelection.exitPortalId, "portal-dest-004-main");
});

test("world route service ranks portal priority ahead of cheaper transfer cost", async () => {
  const app = await createIsolatedApp("world-routing-priority-before-transfer");
  const world = cloneWorld(app);
  const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
  const targetMain = world.portals.find((portal) => portal.id === "portal-dest-004-main");
  if (!originMain || !targetMain) {
    throw new Error(format({ originMain, targetMain }));
  }

  world.portals = world.portals.filter(
    (portal) => portal.id !== originMain.id && portal.id !== targetMain.id,
  );
  world.portals.push(
    {
      ...originMain,
      id: "portal-dest-002-priority-high-expensive",
      label: "River Polytechnic High Priority Connector",
      priority: 500,
      transferDistance: 40,
      transferCost: 120,
    },
    {
      ...originMain,
      id: "portal-dest-002-priority-low-cheap",
      label: "River Polytechnic Low Priority Connector",
      priority: 10,
      transferDistance: 1,
      transferCost: 1,
    },
    {
      ...targetMain,
      id: "portal-dest-004-priority-high-expensive",
      label: "Summit Learning Hub High Priority Connector",
      priority: 500,
      transferDistance: 40,
      transferCost: 120,
    },
    {
      ...targetMain,
      id: "portal-dest-004-priority-low-cheap",
      label: "Summit Learning Hub Low Priority Connector",
      priority: 10,
      transferDistance: 1,
      transferCost: 1,
    },
  );
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    summary: { transferCost: number };
    portalSelection: {
      entryPortalId: string;
      exitPortalId: string;
      tieBreakOrder: string[];
    };
  };

  assert.equal(itinerary.reachable, true, format(itinerary));
  assert.equal(itinerary.portalSelection.entryPortalId, "portal-dest-002-priority-high-expensive");
  assert.equal(itinerary.portalSelection.exitPortalId, "portal-dest-004-priority-high-expensive");
  assert.equal(itinerary.summary.transferCost, 240, format(itinerary.summary));
  assert.deepEqual(itinerary.portalSelection.tieBreakOrder, WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER);
});

test("world route service returns empty cross-map prefix legs when origin portal direction blocks outbound transfer", async () => {
  const app = await createIsolatedApp("world-routing-empty-prefix-legs");
  const world = cloneWorld(app);
  const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
  if (!originMain) {
    throw new Error(format({ originMain }));
  }

  originMain.direction = "inbound";
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<Record<string, unknown>>;
    failure?: { stage: string; code: string };
  };

  assert.equal(itinerary.reachable, false, format(itinerary));
  assert.equal(itinerary.failure?.stage, "origin-portal", format(itinerary.failure));
  assert.equal(itinerary.failure?.code, "origin_portal_unavailable", format(itinerary.failure));
  assert.equal(itinerary.legs.length, 0, format(itinerary.legs));
});

test("world route service returns destination and world prefix legs when destination local traversal is unreachable", async () => {
  const app = await createIsolatedApp("world-routing-destination-prefix-legs");
  const targetDestination = app.runtime.seedData.destinations.find((destination) => destination.id === "dest-004");
  if (!targetDestination) {
    throw new Error(format({ targetDestination }));
  }

  const mutatedDestination = {
    ...targetDestination,
    graph: {
      ...targetDestination.graph,
      edges: targetDestination.graph.edges.filter(
        (edge) => edge.from !== "dest-004-archive" && edge.to !== "dest-004-archive",
      ),
    },
  };
  app.runtime.seedData = {
    ...app.runtime.seedData,
    destinations: app.runtime.seedData.destinations.map((destination) =>
      destination.id === mutatedDestination.id ? mutatedDestination : destination,
    ),
  };
  const destinationById = new Map(app.runtime.lookups.destinationById);
  destinationById.set(mutatedDestination.id, mutatedDestination);
  app.runtime.lookups = {
    ...app.runtime.lookups,
    destinationById,
  };

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    toLocalNodeId: "dest-004-archive",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<Record<string, unknown>>;
    failure?: { stage: string; code: string };
  };

  assert.equal(itinerary.reachable, false, format(itinerary));
  assert.equal(itinerary.failure?.stage, "destination-local", format(itinerary.failure));
  assert.equal(itinerary.failure?.code, "destination_local_unreachable", format(itinerary.failure));
  assert.equal(itinerary.legs.length, 2, format(itinerary.legs));
  assert.equal(itinerary.legs[0]?.scope, "destination", format(itinerary.legs[0]));
  assert.equal(itinerary.legs[1]?.scope, "world", format(itinerary.legs[1]));
});

test("world route service returns reachable=false with prefix legs when world traversal becomes disconnected", async () => {
  const app = await createIsolatedApp("world-routing-world-unreachable");
  const world = cloneWorld(app);
  world.graph.edges = world.graph.edges.filter(
    (edge) => edge.id !== "world-edge-west-to-crossing" && edge.id !== "world-edge-west-to-central",
  );
  applyWorld(app, world);

  const itinerary = app.worldRouting.plan({
    scope: "cross-map",
    fromDestinationId: "dest-002",
    toDestinationId: "dest-004",
    strategy: "distance",
    mode: "walk",
  }) as unknown as {
    reachable: boolean;
    legs: Array<Record<string, unknown>>;
    failure?: Record<string, unknown>;
  };

  assert.equal(itinerary.reachable, false, format(itinerary));
  assert.equal(itinerary.failure?.stage, "world", format(itinerary.failure));
  assert.equal(itinerary.failure?.code, "world_segment_unreachable", format(itinerary.failure));
  assert.equal(itinerary.legs.length, 1, format(itinerary.legs));
  assert.equal(itinerary.legs[0]?.scope, "destination", format(itinerary.legs[0]));
});

test("world route service returns the world unavailable contract when world mode is disabled", async () => {
  const app = await createIsolatedApp("world-routing-unavailable");
  disableWorld(app);

  try {
    app.worldRouting.plan({
      scope: "cross-map",
      fromDestinationId: "dest-002",
      toDestinationId: "dest-004",
      strategy: "distance",
      mode: "walk",
    });
  } catch (error) {
    assert.equal(isWorldRouteServiceError(error), true, format(error));
    if (!isWorldRouteServiceError(error)) {
      throw error;
    }
    assert.equal(error.statusCode, 409, format(error.payload));
    assert.deepEqual(error.payload, {
      error: "World mode is unavailable.",
      code: "world_unavailable",
    });
    return;
  }

  throw new Error("Expected world route planning to fail when world mode is disabled.");
});

test("food search tolerates typo queries on the real dataset", async () => {
  const app = await createIsolatedApp("food-typo");
  const results = app.foods.search({
    destinationId: "dest-001",
    query: "nodle",
    limit: 5,
  }) as Array<{ name: string; matchScore?: number; matches?: string[] }>;
  const noodleLab = results.find((item) => item.name === "noodle lab kitchen 4");

  if (!noodleLab) {
    throw new Error(format(results));
  }
  assert.ok((noodleLab.matchScore ?? 0) > 0, format(noodleLab));
  assert.ok((noodleLab.matches?.length ?? 0) > 0, format(noodleLab));
});

test("legacy destination, food, and exchange queries clamp over-max limits", async () => {
  const app = await createIsolatedApp("legacy-limit-clamping");

  const catalog = app.destinations.listCatalog(999);
  const foods = app.foods.search({
    destinationId: "dest-002",
    cuisine: "tea",
    limit: 99,
  });
  const exchangeResults = await app.exchange.searchText("field note", 99);

  assert.equal(catalog.length, 60, format(catalog));
  assert.equal(Array.isArray(foods), true, format(foods));
  assert.equal(Array.isArray(exchangeResults), true, format(exchangeResults));
});

test("journal exchange keeps exact-title lookup separate from full-text search", async () => {
  const app = await createIsolatedApp("journal-search");
  const exact = await app.exchange.exactTitle("Amber Bay field note 1");
  const bodyOnly = await app.exchange.exactTitle("indoor hall");
  const results = await app.exchange.searchText("indoor hall", 5);
  const match = results.find((entry) => (entry as { id?: string }).id === "journal-1") as
    | { id?: string; matches?: string[] }
    | undefined;

  assert.equal(exact?.id, "journal-1");
  assert.equal(bodyOnly, null);
  if (!match) {
    throw new Error(format(results));
  }
  assert.ok(match.matches?.includes("indoor"), format(match));
  assert.ok(match.matches?.includes("hall"), format(match));
});

test("fallback seed exposes distinct scenic and campus graph variants", async () => {
  const app = await createIsolatedApp("graph-variants");
  const scenicLoop = edgeIds(app, "dest-001");
  const scenicSpur = edgeIds(app, "dest-003");
  const campusLoop = edgeIds(app, "dest-002");
  const campusCross = edgeIds(app, "dest-004");

  assert.equal(
    format(nodePosition(app, "dest-001", "hall-entry")) === format(nodePosition(app, "dest-003", "hall-entry")),
    false,
  );
  assert.equal(format(nodePosition(app, "dest-002", "deck")) === format(nodePosition(app, "dest-004", "deck")), false);
  assert.equal(format(scenicLoop) === format(scenicSpur), false);
  assert.equal(format(campusLoop) === format(campusCross), false);

  assert.ok(scenicLoop.includes("dest-001-edge-plaza-market"), format(scenicLoop));
  assert.equal(scenicLoop.includes("dest-001-edge-gallery-lake"), false, format(scenicLoop));
  assert.ok(scenicSpur.includes("dest-003-edge-gallery-lake"), format(scenicSpur));
  assert.equal(scenicSpur.includes("dest-003-edge-plaza-market"), false, format(scenicSpur));

  assert.ok(campusLoop.includes("dest-002-edge-plaza-market"), format(campusLoop));
  assert.equal(campusLoop.includes("dest-002-edge-hub-lake"), false, format(campusLoop));
  assert.ok(campusCross.includes("dest-004-edge-hub-lake"), format(campusCross));
  assert.ok(campusCross.includes("dest-004-edge-gallery-deck"), format(campusCross));
  assert.equal(campusCross.includes("dest-004-edge-plaza-market"), false, format(campusCross));
});

test("indoor route planning and nearby facility lookup work on scenic and campus variants", async () => {
  const app = await createIsolatedApp("routing-facilities");
  const scenicRoute = app.routing.plan({
    destinationId: "dest-001",
    startNodeId: "dest-001-gate",
    endNodeId: "dest-001-hall-l1",
    mode: "walk",
    strategy: "distance",
  });
  const scenicNearby = app.facilities.findNearby({
    destinationId: "dest-001",
    fromNodeId: "dest-001-gate",
    category: "info",
    radius: 900,
    limit: 3,
    mode: "walk",
  });
  const scenicFirst = scenicNearby.items[0];

  assert.equal(scenicRoute.reachable, true, format(scenicRoute));
  assert.ok(scenicRoute.totalDistance > 0, format(scenicRoute));
  assert.equal(scenicRoute.nodeIds[0], "dest-001-gate");
  assert.equal(scenicRoute.nodeIds[scenicRoute.nodeIds.length - 1], "dest-001-hall-l1");
  assert.ok(
    scenicRoute.steps.some((step) => step.edgeId === "dest-001-edge-hall-entry-hall-l1"),
    format(scenicRoute.steps),
  );

  assert.ok(scenicFirst, format(scenicNearby));
  assert.equal(scenicFirst.id, "dest-001-facility-5");
  assert.equal(scenicFirst.nodeId, "dest-001-hall-l1");
  assert.equal(scenicFirst.distance, scenicRoute.totalDistance, format({ scenicFirst, scenicRoute }));
  assert.deepEqual(scenicFirst.nodePath, scenicRoute.nodeIds, format({ scenicFirst, scenicRoute }));
  assert.ok(scenicFirst.nodePath.includes("dest-001-hall-entry"), format(scenicFirst));

  const campusRoute = app.routing.plan({
    destinationId: "dest-002",
    startNodeId: "dest-002-gate",
    endNodeId: "dest-002-hall-l1",
    mode: "walk",
    strategy: "distance",
  });
  const campusNearby = app.facilities.findNearby({
    destinationId: "dest-002",
    fromNodeId: "dest-002-gate",
    category: "info",
    radius: 900,
    limit: 3,
    mode: "walk",
  });
  const campusFirst = campusNearby.items[0];

  assert.equal(campusRoute.reachable, true, format(campusRoute));
  assert.ok(campusRoute.totalDistance > 0, format(campusRoute));
  assert.equal(campusRoute.nodeIds[0], "dest-002-gate");
  assert.equal(campusRoute.nodeIds[campusRoute.nodeIds.length - 1], "dest-002-hall-l1");
  assert.ok(
    campusRoute.steps.some((step) => step.edgeId === "dest-002-edge-hall-entry-hall-l1"),
    format(campusRoute.steps),
  );

  assert.ok(campusFirst, format(campusNearby));
  assert.equal(campusFirst.id, "dest-002-facility-4");
  assert.equal(campusFirst.nodeId, "dest-002-hub");
  assert.ok(campusFirst.distance > 0, format(campusFirst));
  assert.equal(campusFirst.nodePath[0], "dest-002-gate");
  assert.equal(campusFirst.nodePath[campusFirst.nodePath.length - 1], "dest-002-hub");
  assert.ok(campusFirst.nodePath.includes("dest-002-garden"), format(campusFirst));
});

test("journal social flows keep feed summaries compact and preserve legacy journal behavior", async () => {
  const app = await createIsolatedApp("journal-social");
  const authorName = app.runtime.lookups.userById.get("user-2")?.name;
  const firstCommentUserName = app.runtime.lookups.userById.get("user-5")?.name;
  const secondCommentUserName = app.runtime.lookups.userById.get("user-6")?.name;
  const created = await app.journals.create({
    body: "Started at the main gate, crossed the lobby, and ended at the archive with a quiet tea stop.",
    destinationId: "dest-002",
    tags: ["indoor", "loop"],
    title: "River Polytechnic archive route",
    userId: "user-2",
  });
  const createdId = (created as { id: string }).id;

  const liked = await app.journals.like(createdId, "user-4");
  const firstComment = await app.journals.createComment(createdId, {
    body: "The indoor archive leg saved time when the plaza got crowded.",
    userId: "user-5",
  });
  const secondComment = await app.journals.createComment(createdId, {
    body: "Late tea stop sounds right for that route.",
    userId: "user-6",
  });
  const detail = await app.journals.get(createdId, { viewerUserId: "user-4" });
  const feedPage = await app.journals.feed({
    limit: 1,
    viewerUserId: "user-4",
  });
  const nextFeedPage = await app.journals.feed({
    cursor: feedPage.nextCursor ?? undefined,
    limit: 1,
    viewerUserId: "user-4",
  });
  const commentPage = await app.journals.listComments({
    journalId: createdId,
    limit: 1,
  });
  const nextCommentPage = await app.journals.listComments({
    journalId: createdId,
    cursor: commentPage.nextCursor ?? undefined,
    limit: 1,
  });
  await expectRejects(() => app.journals.like(createdId, "user-4"), /already liked/i);
  const unliked = await app.journals.unlike(createdId, "user-4");
  const rated = await app.journals.rate(createdId, "user-7", 5);
  const viewed = await app.journals.recordView(createdId);

  assert.equal((liked as { likeCount: number }).likeCount, 1, format(liked));
  assert.equal(detail.commentCount, 2, format(detail));
  assert.equal(detail.likeCount, 1, format(detail));
  assert.equal(detail.viewerHasLiked, true, format(detail));
  assert.equal(typeof detail.summaryBody, "string", format(detail));
  assert.equal(detail.destinationLabel, "River Polytechnic");
  assert.equal(detail.userLabel, authorName);
  assert.equal((rated as { averageRating: number }).averageRating, 5, format(rated));
  assert.equal((viewed as { views: number }).views, 1, format(viewed));

  assert.equal(feedPage.items.length, 1, format(feedPage));
  assert.equal(feedPage.totalCount > 1, true, format(feedPage));
  assert.equal(feedPage.nextCursor !== null, true, format(feedPage));
  assert.equal(feedPage.items[0]?.id, createdId, format(feedPage.items[0]));
  assert.equal(feedPage.items[0] ? "body" in feedPage.items[0] : false, false, format(feedPage.items[0]));
  assert.equal(feedPage.items[0] ? "ratings" in feedPage.items[0] : false, false, format(feedPage.items[0]));
  assert.equal(feedPage.items[0] ? "graph" in feedPage.items[0] : false, false, format(feedPage.items[0]));
  assert.equal(feedPage.items[0]?.viewerHasLiked, true, format(feedPage.items[0]));
  assert.equal(feedPage.items[0]?.commentCount, 2, format(feedPage.items[0]));
  assert.equal(nextFeedPage.items[0]?.id === createdId, false, format(nextFeedPage));

  assert.equal(commentPage.totalCount, 2, format(commentPage));
  assert.equal(commentPage.nextCursor !== null, true, format(commentPage));
  assert.equal(commentPage.items[0]?.id, (secondComment as { id: string }).id, format(commentPage));
  assert.equal(commentPage.items[0]?.userLabel, secondCommentUserName);
  assert.equal(nextCommentPage.items[0]?.id, (firstComment as { id: string }).id, format(nextCommentPage));
  assert.equal(nextCommentPage.items[0]?.userLabel, firstCommentUserName);

  assert.equal((unliked as { likeCount: number; viewerHasLiked: boolean }).likeCount, 0, format(unliked));
  assert.equal((unliked as { likeCount: number; viewerHasLiked: boolean }).viewerHasLiked, false, format(unliked));

  await expectRejects(() => app.journals.feed({ cursor: "bogus", viewerUserId: "user-4" }), /Invalid cursor/);
  await expectRejects(
    () => app.journals.createComment(createdId, { body: "   ", userId: "user-5" }),
    /Comment body is required/,
  );
  await expectRejects(
    () => app.journals.createComment("journal-404", { body: "Unknown journal", userId: "user-5" }),
    /Unknown journal/,
  );
  await expectRejects(
    () => app.journals.createComment(createdId, { body: "Unknown user", userId: "user-404" }),
    /Unknown user/,
  );
});

test("feed cursors stay valid across social-only journal activity", async () => {
  const app = await createIsolatedApp("journal-feed-cursor-stability");
  const created = await app.journals.create({
    body: "Indoor archive notes with a tea stop at the end of the route.",
    destinationId: "dest-002",
    tags: ["indoor", "archive"],
    title: "River Polytechnic cursor stability memo",
    userId: "user-2",
  });
  const createdId = created.id;
  const initialUpdatedAt = created.updatedAt;
  const feedPage = await app.journals.feed({
    limit: 1,
    viewerUserId: "user-4",
  });

  assert.equal(feedPage.items[0]?.id, createdId, format(feedPage));
  assert.equal(feedPage.nextCursor !== null, true, format(feedPage));

  await app.journals.like(createdId, "user-4");
  await app.journals.createComment(createdId, {
    body: "Archive shortcut still works after the indoor split.",
    userId: "user-5",
  });
  await app.journals.recordView(createdId);
  await app.journals.unlike(createdId, "user-4");

  const detail = await app.journals.get(createdId, { viewerUserId: "user-4" });
  const nextFeedPage = await app.journals.feed({
    cursor: feedPage.nextCursor ?? undefined,
    limit: 1,
    viewerUserId: "user-4",
  });

  assert.equal(detail.updatedAt, initialUpdatedAt, format(detail));
  assert.equal(detail.commentCount, 1, format(detail));
  assert.equal(detail.likeCount, 0, format(detail));
  assert.equal(detail.views, 1, format(detail));
  assert.equal(nextFeedPage.items[0]?.id === createdId, false, format(nextFeedPage));
});

test("feed cursors stay valid when the anchor journal is edited and rated", async () => {
  const app = await createIsolatedApp("journal-feed-edit-stability");
  const created = await app.journals.create({
    body: "Indoor archive notes with an overlook stop before the tea room.",
    destinationId: "dest-002",
    tags: ["indoor", "archive"],
    title: "River Polytechnic edit stability memo",
    userId: "user-2",
  });
  const createdId = created.id;
  const feedPage = await app.journals.feed({
    limit: 1,
    viewerUserId: "user-4",
  });

  assert.equal(feedPage.items[0]?.id, createdId, format(feedPage));
  assert.equal(feedPage.nextCursor !== null, true, format(feedPage));

  const updated = await app.journals.update(createdId, {
    body: "Indoor archive notes with an overlook stop before the tea room and a faster return loop.",
    tags: ["indoor", "archive", "return"],
    title: "River Polytechnic edit stability memo revised",
  });
  const rated = await app.journals.rate(createdId, "user-4", 5);
  const nextFeedPage = await app.journals.feed({
    cursor: feedPage.nextCursor ?? undefined,
    limit: 1,
    viewerUserId: "user-4",
  });

  assert.equal(updated.id, createdId, format(updated));
  assert.equal(updated.title, "River Polytechnic edit stability memo revised", format(updated));
  assert.equal(rated.averageRating, 5, format(rated));
  assert.equal(nextFeedPage.items[0]?.id === createdId, false, format(nextFeedPage));
});

test("journal and comment ordering break timestamp ties by numeric id", async () => {
  const app = await createIsolatedApp("journal-id-tiebreakers");
  const tiedStamp = "2026-04-01T12:00:00.000Z";

  await app.journalStore.saveAll([
    {
      id: "journal-8",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case eight",
      body: "Tie case eight body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
    {
      id: "journal-9",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case nine",
      body: "Tie case nine body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
    {
      id: "journal-10",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case ten",
      body: "Tie case ten body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
  ]);

  const listed = await app.journals.list({ limit: 3 });
  const feedPage = await app.journals.feed({ limit: 1 });
  const feedNextPage = await app.journals.feed({
    cursor: feedPage.nextCursor ?? undefined,
    limit: 1,
  });

  assert.deepEqual(
    listed.map((journal) => journal.id),
    ["journal-10", "journal-9", "journal-8"],
    format(listed),
  );
  assert.equal(feedPage.items[0]?.id, "journal-10", format(feedPage));
  assert.equal(feedNextPage.items[0]?.id, "journal-9", format(feedNextPage));

  await app.journalStore.upsertComment({
    id: "comment-8",
    journalId: "journal-10",
    userId: "user-2",
    body: "Comment eight",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });
  await app.journalStore.upsertComment({
    id: "comment-9",
    journalId: "journal-10",
    userId: "user-2",
    body: "Comment nine",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });
  await app.journalStore.upsertComment({
    id: "comment-10",
    journalId: "journal-10",
    userId: "user-2",
    body: "Comment ten",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });

  const commentsPage = await app.journals.listComments({
    journalId: "journal-10",
    limit: 1,
  });
  const commentsNextPage = await app.journals.listComments({
    journalId: "journal-10",
    cursor: commentsPage.nextCursor ?? undefined,
    limit: 1,
  });

  assert.equal(commentsPage.items[0]?.id, "comment-10", format(commentsPage));
  assert.equal(commentsNextPage.items[0]?.id, "comment-9", format(commentsNextPage));
});

test("feed and comment cursors survive deleted anchor items", async () => {
  const app = await createIsolatedApp("journal-deleted-anchor-cursors");
  const tiedStamp = "2026-04-02T12:00:00.000Z";

  await app.journalStore.saveAll([
    {
      id: "journal-8",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case eight",
      body: "Tie case eight body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
    {
      id: "journal-9",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case nine",
      body: "Tie case nine body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
    {
      id: "journal-10",
      userId: "user-2",
      destinationId: "dest-002",
      title: "Tie case ten",
      body: "Tie case ten body.",
      tags: ["tie"],
      media: [],
      createdAt: tiedStamp,
      updatedAt: tiedStamp,
      views: 0,
      ratings: [],
      recommendedFor: [],
    },
  ]);

  const feedPage = await app.journals.feed({ limit: 1 });
  assert.equal(feedPage.items[0]?.id, "journal-10", format(feedPage));
  await app.journals.delete("journal-10");

  const nextFeedPage = await app.journals.feed({
    cursor: feedPage.nextCursor ?? undefined,
    limit: 1,
  });

  assert.equal(nextFeedPage.items[0]?.id, "journal-9", format(nextFeedPage));

  await app.journalStore.upsertComment({
    id: "comment-8",
    journalId: "journal-9",
    userId: "user-2",
    body: "Comment eight",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });
  await app.journalStore.upsertComment({
    id: "comment-9",
    journalId: "journal-9",
    userId: "user-2",
    body: "Comment nine",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });
  await app.journalStore.upsertComment({
    id: "comment-10",
    journalId: "journal-9",
    userId: "user-2",
    body: "Comment ten",
    createdAt: tiedStamp,
    updatedAt: tiedStamp,
  });

  const commentsPage = await app.journals.listComments({
    journalId: "journal-9",
    limit: 1,
  });
  assert.equal(commentsPage.items[0]?.id, "comment-10", format(commentsPage));
  await app.journals.deleteComment("comment-10", "user-2");

  const nextCommentsPage = await app.journals.listComments({
    journalId: "journal-9",
    cursor: commentsPage.nextCursor ?? undefined,
    limit: 1,
  });

  assert.equal(nextCommentsPage.items[0]?.id, "comment-9", format(nextCommentsPage));
});

test("journal likes and comments persist across service reloads and reset clears social state", async () => {
  const runtimeDir = await createRuntimeDir("journal-social-persistence");
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();

  const comment = await app.journals.createComment("journal-1", {
    body: "Archive routes need that indoor cutoff.",
    userId: "user-3",
  });
  await app.journals.like("journal-1", "user-4");

  const reloaded = await createAppServices({ runtimeDir });
  const persistedDetail = await reloaded.journals.get("journal-1", { viewerUserId: "user-4" });
  const persistedComments = await reloaded.journals.listComments({ journalId: "journal-1", limit: 10 });

  assert.equal(persistedDetail.commentCount, 1, format(persistedDetail));
  assert.equal(persistedDetail.likeCount, 1, format(persistedDetail));
  assert.equal(persistedDetail.viewerHasLiked, true, format(persistedDetail));
  assert.equal(persistedComments.totalCount, 1, format(persistedComments));
  assert.equal(persistedComments.items[0]?.id, (comment as { id: string }).id, format(persistedComments));

  await reloaded.journalStore.reset();

  const resetApp = await createAppServices({ runtimeDir });
  const resetDetail = await resetApp.journals.get("journal-1", { viewerUserId: "user-4" });
  const resetComments = await resetApp.journals.listComments({ journalId: "journal-1", limit: 10 });

  assert.equal(resetDetail.commentCount, 0, format(resetDetail));
  assert.equal(resetDetail.likeCount, 0, format(resetDetail));
  assert.equal(resetDetail.viewerHasLiked, false, format(resetDetail));
  assert.equal(resetComments.totalCount, 0, format(resetComments));
});

test("journal social pagination rejects over-max feed and comment limits", async () => {
  const app = await createIsolatedApp("journal-social-limit-validation");
  const created = await app.journals.create({
    body: "Indoor archive path with a short tea stop.",
    destinationId: "dest-002",
    tags: ["indoor", "tea"],
    title: "River Polytechnic validation route",
    userId: "user-2",
  });
  const createdId = (created as { id: string }).id;

  await expectRejects(
    () => app.journals.feed({ limit: 41, viewerUserId: "user-4" }),
    /Limit must be at most 40\./,
  );
  await expectRejects(
    () => app.journals.listComments({ journalId: createdId, limit: 51 }),
    /Limit must be at most 50\./,
  );
});
