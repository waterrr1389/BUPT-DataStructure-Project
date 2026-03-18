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

test("indoor route planning and nearby facility lookup work on the real dataset", async () => {
  const app = await createIsolatedApp("routing-facilities");
  const route = app.routing.plan({
    destinationId: "dest-001",
    startNodeId: "dest-001-gate",
    endNodeId: "dest-001-hall-l1",
    mode: "walk",
    strategy: "distance",
  });
  const nearby = app.facilities.findNearby({
    destinationId: "dest-001",
    fromNodeId: "dest-001-gate",
    category: "info",
    radius: 900,
    limit: 3,
    mode: "walk",
  });
  const first = nearby.items[0];

  assert.equal(route.reachable, true, format(route));
  assert.equal(route.totalDistance, 747, format(route));
  assert.equal(route.nodeIds[0], "dest-001-gate");
  assert.equal(route.nodeIds[route.nodeIds.length - 1], "dest-001-hall-l1");
  assert.ok(
    route.steps.some((step) => step.edgeId === "dest-001-edge-hall-entry-hall-l1"),
    format(route.steps),
  );

  assert.ok(first, format(nearby));
  assert.equal(first.id, "dest-001-facility-5");
  assert.equal(first.nodeId, "dest-001-hall-l1");
  assert.equal(first.distance, 747, format(first));
  assert.equal(first.nodePath[0], "dest-001-gate");
  assert.equal(first.nodePath[first.nodePath.length - 1], "dest-001-hall-l1");
  assert.ok(first.nodePath.includes("dest-001-hall-entry"), format(first));
});
