import { ensureLimit, findDestination, findUser } from "./service-helpers";
import type { ResolvedRuntime } from "./runtime";

interface FoodQuery {
  destinationId: string;
  userId?: string;
  fromNodeId?: string;
  cuisine?: string;
  query?: string;
  limit?: number;
}

export function createFoodService(runtime: ResolvedRuntime) {
  return {
    recommend(query: FoodQuery) {
      const destination = findDestination(runtime.seedData.destinations, query.destinationId);
      const user = findUser(runtime.seedData.users, query.userId);
      const limit = ensureLimit(query.limit, 8, 24);
      const cuisine = query.cuisine?.trim().toLowerCase();
      const fromNodeId = query.fromNodeId ?? destination.graph.nodes[0].id;

      const candidates = destination.foods.filter((food) => (cuisine ? food.cuisine.toLowerCase() === cuisine : true));
      const picked = runtime.algorithms.recommendation.topK(candidates, limit, (food) => {
        const path = runtime.algorithms.routing.shortestPath({
          destination,
          startNodeId: fromNodeId,
          endNodeId: food.nodeId,
          strategy: "distance",
          mode: "walk",
        });
        const dietaryBonus = user
          ? user.dietaryPreferences.some((preference) => food.keywords.some((keyword) => keyword.includes(preference)))
            ? 18
            : 0
          : 0;
        const distancePenalty = path.reachable ? path.totalDistance / 140 : 999;
        return food.heat * 0.45 + food.rating * 18 + dietaryBonus - distancePenalty;
      });

      return picked.map((food) => ({
        ...food,
        destinationName: destination.name,
      }));
    },

    search(query: FoodQuery) {
      const destination = findDestination(runtime.seedData.destinations, query.destinationId);
      const limit = ensureLimit(query.limit, 8, 24);
      const cuisine = query.cuisine?.trim().toLowerCase();
      const filtered = destination.foods.filter((food) => (cuisine ? food.cuisine.toLowerCase() === cuisine : true));
      if (!query.query && !cuisine) {
        throw new Error("Food search requires a query or cuisine filter.");
      }
      if (query.query) {
        const ranked = runtime.algorithms.search.rankText(
          filtered,
          query.query,
          (food) => [food.name, food.venue, food.cuisine, ...food.keywords],
          limit,
        );
        return ranked.map((entry) => ({
          ...entry.item,
          matchScore: entry.score,
          matches: entry.matches,
        }));
      }
      return runtime.algorithms.recommendation
        .topK(filtered, limit, (food) => food.rating * 20 + food.heat)
        .map((food) => food);
    },

    listCuisines() {
      return [...new Set(runtime.seedData.destinations.flatMap((destination) => destination.foods.map((food) => food.cuisine)))].sort();
    },
  };
}
