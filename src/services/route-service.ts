import { findDestination } from "./service-helpers";
import type { RoutePlanInput } from "./contracts";
import type { ResolvedRuntime } from "./runtime";

export function createRouteService(runtime: ResolvedRuntime) {
  return {
    plan(input: RoutePlanInput) {
      const destination = findDestination(runtime.seedData.destinations, input.destinationId);
      const strategy = input.strategy ?? "distance";
      const mode = input.mode ?? "walk";
      const targetNodeIds = [...new Set((input.waypointNodeIds ?? []).filter(Boolean))];
      const response =
        targetNodeIds.length > 0
          ? runtime.algorithms.routing.closedWalk({
              destination,
              startNodeId: input.startNodeId,
              targetNodeIds: input.endNodeId ? [...targetNodeIds, input.endNodeId] : targetNodeIds,
              strategy,
              mode,
            })
          : runtime.algorithms.routing.shortestPath({
              destination,
              startNodeId: input.startNodeId,
              endNodeId: input.endNodeId ?? destination.graph.nodes[0].id,
              strategy,
              mode,
            });

      const nodeNames = new Map(destination.graph.nodes.map((node) => [node.id, node.name]));
      return {
        destinationId: destination.id,
        destinationName: destination.name,
        strategy,
        mode,
        reachable: response.reachable,
        totalDistance: response.totalDistance,
        totalCost: response.totalCost,
        nodeIds: response.nodeIds,
        nodeNames: response.nodeIds.map((nodeId) => ({
          id: nodeId,
          name: nodeNames.get(nodeId) ?? nodeId,
        })),
        steps: response.steps,
      };
    },
  };
}
