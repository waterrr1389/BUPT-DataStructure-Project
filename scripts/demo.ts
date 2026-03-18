import { createDemoReport } from "./demo-support";

console.log("Deterministic demo report:");
console.log(JSON.stringify(createDemoReport(), null, 2));
