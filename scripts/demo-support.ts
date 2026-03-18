import fs from "node:fs/promises";
import path from "node:path";

import { createAppServices, type AppServices } from "../src/services/index";

const DEMO_DESTINATION_ID = "dest-002";
const DEMO_DESTINATION_NAME = "River Polytechnic";
const DEMO_DESTINATION_QUERY = "river polytechnic";
const DEMO_FOOD_QUERY = "noodle lab";
const DEMO_FULL_TEXT_QUERY = "media lab noodle";
const DEMO_JOURNAL_TITLE = "River Polytechnic indoor loop memo";
const DEMO_JOURNAL_BODY =
  "Started at the main gate, crossed Civic Plaza, then moved into the Innovation Center lobby and media lab. " +
  "The noodle lab counter and info station made the route easy to recommend.";
const DEMO_ROUTE_START_NODE_ID = `${DEMO_DESTINATION_ID}-gate`;
const DEMO_ROUTE_END_NODE_ID = `${DEMO_DESTINATION_ID}-archive`;
const DEMO_RECOMMENDATION_USER_ID = "user-2";
const DEMO_RATING_USER_ID = "user-4";

type SummaryRecord = Record<string, unknown>;
type RuntimeFs = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

export interface DemoReport {
  runtime: {
    dataSource: "fallback" | "external";
    destinationCount: number;
    userCount: number;
    seedJournalCount: number;
    focusDestinationId: string;
    focusDestinationName: string;
  };
  destination: {
    searchQuery: string;
    searchTopIds: string[];
    searchTopMatches: string[];
    recommendationUserId: string;
    recommendationTopIds: string[];
    recommendationExactNameHits: number;
  };
  route: {
    destinationId: string;
    startNodeId: string;
    endNodeId: string;
    reachable: boolean;
    nodeIds: string[];
    indoorNodeIds: string[];
    indoorStepCount: number;
    usedModes: string[];
  };
  facility: {
    destinationId: string;
    category: string;
    nearestId: string;
    nearestName: string;
    nearestDistance: number;
    nearestNodePath: string[];
  };
  journal: {
    createdId: string;
    createdTitle: string;
    createdTags: string[];
    loadedId: string;
    loadedViews: number;
    viewedViews: number;
    ratedAverage: number;
    recommendationTopId: string;
  };
  exchange: {
    exactTitleId: string;
    fullTextTopId: string;
    fullTextMatches: string[];
    compressedLength: number;
    compressionRatio: number;
    decompressedMatches: boolean;
    storyboardTitle: string;
    storyboardFrameIds: string[];
  };
  food: {
    searchQuery: string;
    searchTopId: string;
    searchTopCuisine: string;
    recommendationTopIds: string[];
    recommendationTopCuisines: string[];
  };
}

function expectItem<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

function expectSummary(value: unknown, message: string): SummaryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as SummaryRecord;
}

function readString(record: SummaryRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Expected "${key}" to be a string.`);
  }
  return value;
}

function readNumber(record: SummaryRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`Expected "${key}" to be a number.`);
  }
  return value;
}

function readStringArray(record: SummaryRecord, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Expected "${key}" to be a string array.`);
  }
  return [...value];
}

function matchedQueryTokens(query: string, matches: string[]): string[] {
  const normalizedMatches = new Set(matches.map((entry) => entry.toLowerCase()));
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].filter((token) =>
    normalizedMatches.has(token),
  );
}

async function withDemoServices<T>(run: (app: AppServices) => Promise<T>): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  try {
    const app = await createAppServices({ runtimeDir });
    return await run(app);
  } finally {
    await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
  }
}

export async function createDemoReport(): Promise<DemoReport> {
  return withDemoServices(async (app) => {
    const destination = app.destinations.getDestination(DEMO_DESTINATION_ID) as SummaryRecord & {
      graph: {
        edges: Array<{ id: string; roadType: "walkway" | "bike-lane" | "shuttle-lane" | "indoor" }>;
        nodes: Array<{ id: string; buildingId?: string }>;
      };
    };
    const destinationName = readString(destination, "name");
    if (destinationName !== DEMO_DESTINATION_NAME) {
      throw new Error(`Expected ${DEMO_DESTINATION_ID} to resolve to ${DEMO_DESTINATION_NAME}.`);
    }

    const destinationSearch = app.destinations.search({
      limit: 3,
      query: DEMO_DESTINATION_QUERY,
    });
    const destinationRecommendations = app.destinations.recommend({
      limit: 3,
      query: DEMO_DESTINATION_QUERY,
      userId: DEMO_RECOMMENDATION_USER_ID,
    });
    const destinationRecommendationNames = destinationRecommendations.map((entry) =>
      readString(
        expectSummary(entry, "Expected destination recommendation to be a summary record."),
        "name",
      ),
    );
    const topDestinationSearch = expectSummary(
      expectItem(
        destinationSearch[0],
        "Expected at least one destination search result in the deterministic demo scenario.",
      ),
      "Expected destination search result to be a summary record.",
    );
    const route = app.routing.plan({
      destinationId: DEMO_DESTINATION_ID,
      endNodeId: DEMO_ROUTE_END_NODE_ID,
      mode: "mixed",
      startNodeId: DEMO_ROUTE_START_NODE_ID,
      strategy: "time",
    });
    const nodeById = new Map(destination.graph.nodes.map((node) => [node.id, node]));
    const edgeById = new Map(destination.graph.edges.map((edge) => [edge.id, edge]));
    const facilityLookup = app.facilities.findNearby({
      category: "info",
      destinationId: DEMO_DESTINATION_ID,
      fromNodeId: DEMO_ROUTE_START_NODE_ID,
      limit: 3,
      mode: "walk",
      radius: 900,
    });
    const nearestFacility = expectItem(
      facilityLookup.items[0],
      "Expected at least one nearby facility in the deterministic demo scenario.",
    );

    const createdJournal = expectSummary(
      await app.journals.create({
        body: DEMO_JOURNAL_BODY,
        destinationId: DEMO_DESTINATION_ID,
        recommendedFor: [DEMO_RATING_USER_ID],
        tags: ["indoor", "loop"],
        title: DEMO_JOURNAL_TITLE,
        userId: DEMO_RECOMMENDATION_USER_ID,
      }),
      "Expected journal creation to return a summary record.",
    );
    const createdJournalId = readString(createdJournal, "id");
    const createdJournalTitle = readString(createdJournal, "title");
    const loadedJournal = expectSummary(
      await app.journals.get(createdJournalId),
      "Expected journal lookup to return a summary record.",
    );
    const viewedJournal = expectSummary(
      await app.journals.recordView(createdJournalId),
      "Expected journal view tracking to return a summary record.",
    );
    const ratedJournal = expectSummary(
      await app.journals.rate(createdJournalId, DEMO_RATING_USER_ID, 5),
      "Expected journal rating to return a summary record.",
    );
    const journalRecommendations = await app.journals.recommend({
      destinationId: DEMO_DESTINATION_ID,
      limit: 3,
      userId: DEMO_RATING_USER_ID,
    });
    const topJournalRecommendation = expectSummary(
      expectItem(
        journalRecommendations[0],
        "Expected at least one journal recommendation in the deterministic demo scenario.",
      ),
      "Expected journal recommendation to be a summary record.",
    );

    const exactTitleMatch = expectSummary(
      await app.exchange.exactTitle(createdJournalTitle),
      "Expected exact title lookup to return the created journal.",
    );
    const fullTextMatches = await app.exchange.searchText(DEMO_FULL_TEXT_QUERY, 3);
    const topFullTextMatch = expectSummary(
      expectItem(
        fullTextMatches[0],
        "Expected a journal full-text search hit in the deterministic demo scenario.",
      ),
      "Expected journal full-text search result to be a summary record.",
    );
    const compressed = app.exchange.compress(DEMO_JOURNAL_BODY);
    const decompressed = app.exchange.decompress(compressed.compressed);
    const storyboard = app.exchange.generateStoryboard({
      prompt: DEMO_JOURNAL_BODY,
      title: createdJournalTitle,
    });

    const foodSearch = app.foods.search({
      destinationId: DEMO_DESTINATION_ID,
      limit: 3,
      query: DEMO_FOOD_QUERY,
    });
    const topFoodSearch = expectItem(
      foodSearch[0],
      "Expected at least one food search hit in the deterministic demo scenario.",
    );
    const foodRecommendations = app.foods.recommend({
      destinationId: DEMO_DESTINATION_ID,
      fromNodeId: DEMO_ROUTE_START_NODE_ID,
      limit: 3,
      userId: DEMO_RECOMMENDATION_USER_ID,
    });

    return {
      runtime: {
        dataSource: app.runtime.source.data,
        destinationCount: app.runtime.seedData.destinations.length,
        focusDestinationId: DEMO_DESTINATION_ID,
        focusDestinationName: destinationName,
        seedJournalCount: app.runtime.seedData.journals.length,
        userCount: app.runtime.seedData.users.length,
      },
      destination: {
        recommendationTopIds: destinationRecommendations.map((entry) =>
          readString(expectSummary(entry, "Expected destination recommendation to be a summary record."), "id"),
        ),
        recommendationExactNameHits: destinationRecommendationNames.filter(
          (name) => name === DEMO_DESTINATION_NAME,
        ).length,
        recommendationUserId: DEMO_RECOMMENDATION_USER_ID,
        searchQuery: DEMO_DESTINATION_QUERY,
        searchTopIds: destinationSearch.map((entry) =>
          readString(expectSummary(entry, "Expected destination search result to be a summary record."), "id"),
        ),
        searchTopMatches: matchedQueryTokens(
          DEMO_DESTINATION_QUERY,
          readStringArray(topDestinationSearch, "matches"),
        ),
      },
      route: {
        destinationId: DEMO_DESTINATION_ID,
        endNodeId: DEMO_ROUTE_END_NODE_ID,
        indoorNodeIds: route.nodeIds.filter((nodeId) => Boolean(nodeById.get(nodeId)?.buildingId)),
        indoorStepCount: route.steps.filter((step) => edgeById.get(step.edgeId)?.roadType === "indoor").length,
        nodeIds: route.nodeIds,
        reachable: route.reachable,
        startNodeId: DEMO_ROUTE_START_NODE_ID,
        usedModes: [...new Set(route.steps.map((step) => step.mode))],
      },
      facility: {
        category: "info",
        destinationId: DEMO_DESTINATION_ID,
        nearestDistance: nearestFacility.distance,
        nearestId: nearestFacility.id,
        nearestName: nearestFacility.name,
        nearestNodePath: nearestFacility.nodePath,
      },
      journal: {
        createdId: createdJournalId,
        createdTags: readStringArray(createdJournal, "tags"),
        createdTitle: createdJournalTitle,
        loadedId: readString(loadedJournal, "id"),
        loadedViews: readNumber(loadedJournal, "views"),
        ratedAverage: readNumber(ratedJournal, "averageRating"),
        recommendationTopId: readString(topJournalRecommendation, "id"),
        viewedViews: readNumber(viewedJournal, "views"),
      },
      exchange: {
        compressedLength: compressed.compressed.length,
        compressionRatio: compressed.ratio,
        decompressedMatches: decompressed.text === DEMO_JOURNAL_BODY,
        exactTitleId: readString(exactTitleMatch, "id"),
        fullTextMatches: matchedQueryTokens(
          DEMO_FULL_TEXT_QUERY,
          readStringArray(topFullTextMatch, "matches"),
        ),
        fullTextTopId: readString(topFullTextMatch, "id"),
        storyboardFrameIds: storyboard.frames.map((frame) => frame.id),
        storyboardTitle: storyboard.title,
      },
      food: {
        recommendationTopCuisines: foodRecommendations.map((entry) => entry.cuisine),
        recommendationTopIds: foodRecommendations.map((entry) => entry.id),
        searchQuery: DEMO_FOOD_QUERY,
        searchTopCuisine: topFoodSearch.cuisine,
        searchTopId: topFoodSearch.id,
      },
    };
  });
}
