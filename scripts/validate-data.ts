import { assertValidSeedData, summarizeSeedData } from "../src/data/validation";
import { createSampleSeedData } from "./sample-data";

const seedData = createSampleSeedData();

assertValidSeedData(seedData);

const metrics = summarizeSeedData(seedData);

console.log("Seed data validation passed.");
console.log(JSON.stringify(metrics, null, 2));
