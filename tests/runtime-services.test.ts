import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAppServices, type AppServices } from "../src/services/index";

// These package-level checks depend on the runtime/service wiring the external algorithm bundle.
// Use an isolated runtimeDir because JournalStore persists the seed journals on disk.
function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
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
  const runtimeDir = path.join("/tmp", `ds-ts-runtime-services-${name}`);
  await fs.mkdir(runtimeDir, { recursive: true });
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();
  return app;
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
