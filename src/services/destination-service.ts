import { ensureLimit, findUser, scoreDestination } from "./service-helpers";
import { parseDestinationSortBy, type DestinationQuery, type DestinationRecord, type DestinationSortBy } from "./contracts";
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

function filterDestinations(destinations: DestinationRecord[], category: string | undefined): DestinationRecord[] {
  if (!category) {
    return destinations;
  }

  return destinations.filter((destination) =>
    destination.categories.some((entry) => entry.toLowerCase() === category),
  );
}

function destinationMetricScore(destination: DestinationRecord, sortBy: Exclude<DestinationSortBy, "match">): number {
  return sortBy === "heat" ? destination.heat : destination.rating * 10;
}

function resolveSearchSortBy(sortBy: string | null | undefined, hasQuery: boolean): DestinationSortBy {
  const resolved = parseDestinationSortBy(sortBy);
  if (!hasQuery && resolved === "match") {
    throw new Error('sortBy "match" requires a search query.');
  }

  return resolved ?? (hasQuery ? "match" : "rating");
}

function scoreRecommendedDestination(
  destination: DestinationRecord,
  sortBy: DestinationSortBy,
  matchScore: number,
): number {
  if (sortBy === "heat") {
    return (destination.heat * 24) + matchScore;
  }

  if (sortBy === "rating") {
    return (destination.rating * 240) + matchScore;
  }

  return matchScore;
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
      const searchQuery = query.query?.trim() ?? "";
      const hasQuery = searchQuery.length > 0;
      const limit = ensureLimit(query.limit, 10, 40);
      const filtered = filterDestinations(runtime.seedData.destinations, category);
      const sortBy = resolveSearchSortBy(query.sortBy, hasQuery);
      if (!hasQuery && !category) {
        throw new Error("Destination search requires a query or category filter.");
      }

      if (hasQuery) {
        const ranked = runtime.algorithms.search.rankText(
          filtered,
          searchQuery,
          (destination) => [destination.name, destination.description, ...destination.categories, ...destination.keywords],
          filtered.length,
        );
        const ordered =
          sortBy === "match"
            ? ranked.slice(0, limit)
            : runtime.algorithms.recommendation.topK(
                ranked,
                limit,
                (entry) => destinationMetricScore(entry.item, sortBy) + entry.score,
              );
        return ordered.map((entry) => ({
          ...summarizeDestination(entry.item),
          matchScore: entry.score,
          matches: entry.matches,
        }));
      }

      const browseSortBy: Exclude<DestinationSortBy, "match"> = sortBy === "match" ? "rating" : sortBy;
      return runtime.algorithms.recommendation
        .topK(filtered, limit, (destination) => destinationMetricScore(destination, browseSortBy))
        .map((destination) => summarizeDestination(destination));
    },

    recommend(query: DestinationQuery) {
      const category = query.category?.trim().toLowerCase();
      const searchQuery = query.query?.trim() ?? "";
      const limit = ensureLimit(query.limit, 10, 30);
      const sortBy = parseDestinationSortBy(query.sortBy) ?? "match";
      const user = findUser(runtime.seedData.users, query.userId);
      const candidates = searchQuery
        ? runtime.algorithms.search
            .rankText(
              filterDestinations(runtime.seedData.destinations, category),
              searchQuery,
              (destination) => [destination.name, ...destination.categories, ...destination.keywords, destination.description],
              runtime.seedData.destinations.length,
            )
            .map((entry) => entry.item)
        : filterDestinations(runtime.seedData.destinations, category);
      const picked = runtime.algorithms.recommendation.topK(candidates, limit, (destination) =>
        scoreRecommendedDestination(
          destination,
          sortBy,
          scoreDestination(destination, user, searchQuery),
        ),
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
