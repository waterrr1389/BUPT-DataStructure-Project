import assert from "node:assert/strict";
import test from "node:test";

import { MINIMUM_COUNTS, validateSeedData } from "../src/data/validation";
import { createSampleSeedData } from "../scripts/sample-data";

test("sample script seed data satisfies validation minima", () => {
  const result = validateSeedData(createSampleSeedData());

  assert.equal(result.ok, true);
  assert.equal(result.metrics.destinations, MINIMUM_COUNTS.destinations);
  assert.equal(result.metrics.users, MINIMUM_COUNTS.users);
  assert.equal(result.metrics.facilityCategories, MINIMUM_COUNTS.facilityCategories);
  assert.ok(result.metrics.buildings >= MINIMUM_COUNTS.buildings);
  assert.ok(result.metrics.facilities >= MINIMUM_COUNTS.facilities);
  assert.ok(result.metrics.edges >= MINIMUM_COUNTS.edges);
});
