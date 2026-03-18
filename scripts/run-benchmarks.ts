import { collectBenchmarkResults } from "./benchmark-support";

const results = collectBenchmarkResults();

console.log("Representative benchmark results:");

for (const result of results) {
  console.log(
    `${result.name}: ${result.durationMs.toFixed(3)} ms ` +
    `over ${result.iterations} iteration(s) with sample size ${result.sampleSize}`,
  );
}
