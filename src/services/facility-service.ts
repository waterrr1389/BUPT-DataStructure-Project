import { ensureRadius, findDestination } from "./service-helpers";
import type { NearbyFacilitiesInput } from "./contracts";
import type { ResolvedRuntime } from "./runtime";

export function createFacilityService(runtime: ResolvedRuntime) {
  return {
    findNearby(input: NearbyFacilitiesInput) {
      const destination = findDestination(runtime.seedData.destinations, input.destinationId);
      const limit = Math.max(1, Math.min(input.limit ?? 8, 25));
      const radius = ensureRadius(input.radius, 900);
      const category = input.category && input.category !== "all" ? input.category : undefined;

      const items = destination.facilities
        .filter((facility) => (category ? facility.category === category : true))
        .map((facility) => {
          const path = runtime.algorithms.routing.shortestPath({
            destination,
            startNodeId: input.fromNodeId,
            endNodeId: facility.nodeId,
            strategy: "distance",
            mode: input.mode ?? "walk",
          });
          return { facility, path };
        })
        .filter((entry) => entry.path.reachable && entry.path.totalDistance <= radius)
        .sort((left, right) => left.path.totalDistance - right.path.totalDistance)
        .slice(0, limit)
        .map((entry) => ({
          ...entry.facility,
          distance: entry.path.totalDistance,
          nodePath: entry.path.nodeIds,
        }));

      return {
        destinationId: destination.id,
        destinationName: destination.name,
        fromNodeId: input.fromNodeId,
        radius,
        items,
      };
    },
  };
}
