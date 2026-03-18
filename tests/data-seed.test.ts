import assert from "node:assert/strict";
import test from "node:test";

import {
  destinationById,
  facilityCategoryById,
  lookups,
  seedData,
  userById,
} from "../src/data/seed";
import { MINIMUM_COUNTS, validateSeedData } from "../src/data/validation";

test("seedData exports a validation-ready dataset with matching lookups", () => {
  const result = validateSeedData(seedData);

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.ok(seedData.version.length > 0);
  assert.ok(!Number.isNaN(Date.parse(seedData.generatedAt)));

  assert.equal(seedData.destinations.length >= MINIMUM_COUNTS.destinations, true);
  assert.equal(seedData.users.length >= MINIMUM_COUNTS.users, true);
  assert.equal(
    seedData.facilityCategories.length >= MINIMUM_COUNTS.facilityCategories,
    true,
  );

  assert.equal(lookups.destinationById, destinationById);
  assert.equal(lookups.userById, userById);
  assert.equal(lookups.facilityCategoryById, facilityCategoryById);

  assert.equal(destinationById.size, seedData.destinations.length);
  assert.equal(userById.size, seedData.users.length);
  assert.equal(facilityCategoryById.size, seedData.facilityCategories.length);
});
