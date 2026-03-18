import {
  compressText,
  decompressText,
  findShortestPath,
  InvertedIndex,
  selectTopK,
  WeightedGraph,
} from "../src/algorithms/index";
import type { SeedMetrics } from "../src/data/validation";
import { summarizeSeedData, validateSeedData } from "../src/data/validation";
import type { Destination } from "../src/domain/models";
import { createSampleSeedData } from "./sample-data";

export interface DemoReport {
  compression: {
    inputLength: number;
    outputLength: number;
    roundTrip: boolean;
  };
  featuredDestinations: string[];
  metrics: SeedMetrics;
  route: {
    cost: number;
    nodes: string[];
    reachable: boolean;
    time: number;
  };
  searchHits: string[];
  validationOk: boolean;
}

function scoreDestination(destination: Destination): number {
  return destination.rating + (destination.heat / 100) + (destination.featured ? 1 : 0);
}

function createDemoGraph(): WeightedGraph<"walk" | "bike"> {
  const graph = new WeightedGraph<"walk" | "bike">();
  graph.addNodes([
    { id: "gate" },
    { id: "plaza" },
    { id: "garden" },
    { id: "lake" },
  ]);
  graph.addEdges([
    {
      allowedModes: ["walk", "bike"],
      bidirectional: true,
      distance: 4,
      from: "gate",
      speedByMode: { bike: 4, walk: 1 },
      to: "plaza",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 2,
      from: "gate",
      speedByMode: { walk: 1 },
      to: "garden",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 2,
      from: "garden",
      speedByMode: { walk: 1 },
      to: "lake",
    },
    {
      allowedModes: ["walk", "bike"],
      bidirectional: true,
      distance: 4,
      from: "plaza",
      speedByMode: { bike: 4, walk: 1 },
      to: "lake",
    },
  ]);

  return graph;
}

export function createDemoReport(): DemoReport {
  const seedData = createSampleSeedData();
  const validation = validateSeedData(seedData);
  const destinationNames = new Map(
    seedData.destinations.map((destination) => [destination.id, destination.name]),
  );
  const searchIndex = new InvertedIndex<string>();

  for (const destination of seedData.destinations.slice(0, 24)) {
    searchIndex.add({
      id: destination.id,
      text: [
        destination.name,
        destination.description,
        destination.categories.join(" "),
        destination.keywords.join(" "),
      ].join(" "),
    });
  }

  const featuredDestinations = selectTopK(
    seedData.destinations,
    3,
    (left, right) => scoreDestination(right) - scoreDestination(left),
  ).map((destination) => destination.name);
  const searchHits = searchIndex
    .search("sample route campus", { limit: 3, matchMode: "any" })
    .map((hit) => destinationNames.get(hit.id) ?? hit.id);
  const route = findShortestPath(createDemoGraph(), "gate", "lake", {
    allowedModes: ["walk", "bike"],
    strategy: "time",
  });
  const journal = seedData.journals[0];
  const compressed = compressText(journal.body);
  const restored = decompressText(compressed.data);

  return {
    compression: {
      inputLength: journal.body.length,
      outputLength: compressed.stats.outputLength,
      roundTrip: restored === journal.body,
    },
    featuredDestinations,
    metrics: summarizeSeedData(seedData),
    route: {
      cost: route.cost,
      nodes: route.nodes,
      reachable: route.reachable,
      time: route.time,
    },
    searchHits,
    validationOk: validation.ok,
  };
}
