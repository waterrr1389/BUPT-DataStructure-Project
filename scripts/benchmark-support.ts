import {
  compressText,
  decompressText,
  findShortestPath,
  InvertedIndex,
  selectTopK,
  WeightedGraph,
} from "../src/algorithms/index";

export type BenchmarkName = "top-k" | "search" | "graph" | "compression";

export interface BenchmarkResult {
  durationMs: number;
  iterations: number;
  name: BenchmarkName;
  sampleSize: number;
}

export interface BenchmarkOptions {
  graphSize?: number;
  itemCount?: number;
  iterations?: number;
}

function measure(iterations: number, operation: () => void): number {
  const startedAt = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    operation();
  }

  return Number((performance.now() - startedAt).toFixed(3));
}

function createSearchIndex(itemCount: number): InvertedIndex<string> {
  const index = new InvertedIndex<string>();

  for (let entryIndex = 0; entryIndex < itemCount; entryIndex += 1) {
    index.add({
      id: `doc-${entryIndex}`,
      text:
        `cluster ${entryIndex % 10} sample route benchmark document ${entryIndex} ` +
        `with searchable destination text ${entryIndex % 7}`,
    });
  }

  return index;
}

function createGraph(size: number): WeightedGraph<"walk"> {
  const graph = new WeightedGraph<"walk">();

  for (let nodeIndex = 0; nodeIndex < size; nodeIndex += 1) {
    graph.addNode({ id: `node-${nodeIndex}` });
  }

  for (let nodeIndex = 0; nodeIndex < size - 1; nodeIndex += 1) {
    graph.addEdge({
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 1,
      from: `node-${nodeIndex}`,
      speedByMode: { walk: 1 },
      to: `node-${nodeIndex + 1}`,
    });
  }

  return graph;
}

export function collectBenchmarkResults(
  options: BenchmarkOptions = {},
): BenchmarkResult[] {
  const iterations = options.iterations ?? 25;
  const itemCount = options.itemCount ?? 1_000;
  const graphSize = options.graphSize ?? 64;
  const numbers = Array.from(
    { length: itemCount },
    (_, index) => ((itemCount - index) % 113) + index,
  );
  const searchIndex = createSearchIndex(itemCount);
  const graph = createGraph(graphSize);
  const compressionInput =
    "round-zero benchmark payload for deterministic compression checks ".repeat(40);

  return [
    {
      durationMs: measure(iterations, () => {
        selectTopK(numbers, 20, (left, right) => right - left);
      }),
      iterations,
      name: "top-k",
      sampleSize: itemCount,
    },
    {
      durationMs: measure(iterations, () => {
        searchIndex.search("cluster 4 route", { limit: 5, matchMode: "all" });
      }),
      iterations,
      name: "search",
      sampleSize: itemCount,
    },
    {
      durationMs: measure(iterations, () => {
        findShortestPath(graph, "node-0", `node-${graphSize - 1}`, {
          mode: "walk",
          strategy: "distance",
        });
      }),
      iterations,
      name: "graph",
      sampleSize: graphSize,
    },
    {
      durationMs: measure(iterations, () => {
        const compressed = compressText(compressionInput);
        const restored = decompressText(compressed.data);

        if (restored !== compressionInput) {
          throw new Error("Compression benchmark failed its round-trip check.");
        }
      }),
      iterations,
      name: "compression",
      sampleSize: compressionInput.length,
    },
  ];
}
