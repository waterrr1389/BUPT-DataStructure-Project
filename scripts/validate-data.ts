import { seedData } from "../src/data/seed";
import { assertValidSeedData, summarizeSeedData } from "../src/data/validation";

assertValidSeedData(seedData);

const metrics = summarizeSeedData(seedData);

console.log("Seed data validation passed.");
console.log(JSON.stringify(metrics, null, 2));
