import assert from "node:assert/strict";
import test from "node:test";

import { collectBenchmarkResults } from "../scripts/benchmark-support";
import { createDemoReport } from "../scripts/demo-support";

test("demo support exposes a deterministic lightweight showcase", () => {
  const report = createDemoReport();

  assert.equal(report.validationOk, true);
  assert.equal(report.featuredDestinations.length, 3);
  assert.ok(report.searchHits.length > 0);
  assert.equal(report.route.reachable, true);
  assert.deepEqual(report.route.nodes, ["gate", "plaza", "lake"]);
  assert.equal(report.compression.roundTrip, true);
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
