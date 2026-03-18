import { ensureLimit, findUser, scoreDestination } from "./service-helpers";
import type { DestinationQuery, DestinationRecord } from "./contracts";
import type { ResolvedRuntime } from "./runtime";

function summarizeDestination(destination: DestinationRecord): Record<string, unknown> {
  return {
    id: destination.id,
    name: destination.name,
    type: destination.type,
    region: destination.region,
    description: destination.description,
    categories: destination.categories,
    keywords: destination.keywords,
    heat: destination.heat,
    rating: destination.rating,
    featured: destination.featured,
    buildingCount: destination.buildings.length,
    facilityCount: destination.facilities.length,
    foodCount: destination.foods.length,
    nodeCount: destination.graph.nodes.length,
  };
}

export function createDestinationService(runtime: ResolvedRuntime) {
  return {
    listCatalog(limit = 24) {
      return runtime.seedData.destinations.slice(0, ensureLimit(limit, 24, 60)).map(summarizeDestination);
    },

    getDestination(destinationId: string) {
      const destination = runtime.lookups.destinationById.get(destinationId);
      if (!destination) {
        throw new Error(`Unknown destination: ${destinationId}`);
      }
      return {
        ...summarizeDestination(destination),
        graph: destination.graph,
        buildings: destination.buildings,
        facilities: destination.facilities,
        foods: destination.foods,
      };
    },

    search(query: DestinationQuery) {
      const category = query.category?.trim().toLowerCase();
      const limit = ensureLimit(query.limit, 10, 40);
      const filtered = runtime.seedData.destinations.filter((destination) =>
        category ? destination.categories.some((entry) => entry.toLowerCase() === category) : true,
      );
      if (!query.query && !category) {
        throw new Error("Destination search requires a query or category filter.");
      }

      if (query.query) {
        const ranked = runtime.algorithms.search.rankText(
          filtered,
          query.query,
          (destination) => [destination.name, destination.description, ...destination.categories, ...destination.keywords],
          limit,
        );
        return ranked.map((entry) => ({
          ...summarizeDestination(entry.item),
          matchScore: entry.score,
          matches: entry.matches,
        }));
      }

      const sortBy = query.sortBy ?? "rating";
      const scorer =
        sortBy === "heat"
          ? (destination: DestinationRecord) => destination.heat
          : (destination: DestinationRecord) => destination.rating * 10;
      return runtime.algorithms.recommendation
        .topK(filtered, limit, scorer)
        .map((destination) => summarizeDestination(destination));
    },

    recommend(query: DestinationQuery) {
      const limit = ensureLimit(query.limit, 10, 30);
      const user = findUser(runtime.seedData.users, query.userId);
      const candidates = query.query
        ? runtime.algorithms.search
            .rankText(
              runtime.seedData.destinations,
              query.query,
              (destination) => [destination.name, ...destination.categories, ...destination.keywords, destination.description],
              runtime.seedData.destinations.length,
            )
            .map((entry) => entry.item)
        : runtime.seedData.destinations;
      const picked = runtime.algorithms.recommendation.topK(candidates, limit, (destination) =>
        scoreDestination(destination, user, query.query ?? ""),
      );
      return picked.map((destination) => ({
        ...summarizeDestination(destination),
        reason: user ? `Aligned with ${user.name}'s interests` : "Strong heat and rating blend",
      }));
    },

    listCategories() {
      return [...new Set(runtime.seedData.destinations.flatMap((destination) => destination.categories))].sort();
    },
  };
}
