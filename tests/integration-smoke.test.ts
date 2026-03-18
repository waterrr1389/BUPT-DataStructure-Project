import assert from "node:assert/strict";
import test from "node:test";

import { collectBenchmarkResults } from "../scripts/benchmark-support";
import { createDemoReport } from "../scripts/demo-support";

test("demo support exposes deterministic end-to-end coverage", async () => {
  const report = await createDemoReport();

  assert.deepEqual(report.runtime, {
    dataSource: "external",
    destinationCount: 220,
    userCount: 12,
    seedJournalCount: 12,
    focusDestinationId: "dest-002",
    focusDestinationName: "River Polytechnic",
  });

  assert.equal(report.destination.searchQuery, "river polytechnic");
  assert.deepEqual(report.destination.searchTopIds, ["dest-002", "dest-022", "dest-042"]);
  assert.deepEqual(report.destination.searchTopMatches, ["river", "polytechnic"]);
  assert.equal(report.destination.recommendationUserId, "user-2");
  assert.equal(report.destination.recommendationTopIds.length, 3);
  assert.equal(
    report.destination.recommendationTopIds.every((entry) => entry.startsWith("dest-")),
    true,
  );
  assert.equal(report.destination.recommendationExactNameHits > 0, true);

  assert.equal(report.route.destinationId, "dest-002");
  assert.equal(report.route.startNodeId, "dest-002-gate");
  assert.equal(report.route.endNodeId, "dest-002-archive");
  assert.equal(report.route.reachable, true);
  assert.deepEqual(report.route.nodeIds, [
    "dest-002-gate",
    "dest-002-garden",
    "dest-002-hub",
    "dest-002-hall-entry",
    "dest-002-hall-l1",
    "dest-002-elevator-l1",
    "dest-002-elevator-l2",
    "dest-002-archive",
  ]);
  assert.deepEqual(report.route.indoorNodeIds, [
    "dest-002-hall-entry",
    "dest-002-hall-l1",
    "dest-002-elevator-l1",
    "dest-002-elevator-l2",
    "dest-002-archive",
  ]);
  assert.equal(report.route.indoorStepCount, 4);
  assert.deepEqual(report.route.usedModes, ["walk", "bike"]);

  assert.deepEqual(report.facility, {
    destinationId: "dest-002",
    category: "info",
    nearestId: "dest-002-facility-4",
    nearestName: "info station 4",
    nearestDistance: 480,
    nearestNodePath: ["dest-002-gate", "dest-002-garden", "dest-002-hub"],
  });

  assert.equal(report.journal.createdId, "journal-13");
  assert.equal(report.journal.createdTitle, "River Polytechnic indoor loop memo");
  assert.deepEqual(report.journal.createdTags, ["indoor", "loop", "nature", "waterfront"]);
  assert.equal(report.journal.loadedId, report.journal.createdId);
  assert.equal(report.journal.loadedViews, 0);
  assert.equal(report.journal.viewedViews, 1);
  assert.equal(report.journal.ratedAverage, 5);
  assert.equal(report.journal.recommendationTopId, report.journal.createdId);

  assert.equal(report.exchange.exactTitleId, report.journal.createdId);
  assert.equal(report.exchange.fullTextTopId, report.journal.createdId);
  assert.deepEqual(report.exchange.fullTextMatches, ["media", "lab", "noodle"]);
  assert.equal(report.exchange.compressedLength > 0, true);
  assert.equal(report.exchange.compressionRatio > 1, true);
  assert.equal(report.exchange.decompressedMatches, true);
  assert.equal(report.exchange.storyboardTitle, "River Polytechnic indoor loop memo storyboard");
  assert.deepEqual(report.exchange.storyboardFrameIds, [
    "frame-1",
    "frame-2",
    "frame-3",
    "frame-4",
  ]);

  assert.equal(report.food.searchQuery, "noodle lab");
  assert.equal(report.food.searchTopId, "dest-002-food-3");
  assert.equal(report.food.searchTopCuisine, "noodle lab");
  assert.equal(report.food.recommendationTopIds.length, 3);
  assert.equal(
    report.food.recommendationTopIds.every((entry) => entry.startsWith("dest-002-food-")),
    true,
  );
  assert.deepEqual([...report.food.recommendationTopCuisines].sort(), [
    "noodle lab",
    "sea bowl",
    "tea house",
  ]);
});

test("benchmark support covers the expected algorithm groups", () => {
  const results = collectBenchmarkResults({
    graphSize: 8,
    itemCount: 40,
    iterations: 2,
  });

  assert.deepEqual(
    results.map((result) => result.name),
    ["top-k", "search", "graph", "compression"],
  );
  assert.ok(results.every((result) => result.iterations === 2));
  assert.ok(results.every((result) => result.durationMs >= 0));
});
