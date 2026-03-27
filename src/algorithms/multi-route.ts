import {
  findShortestPathTree,
  ShortestPathOptions,
  ShortestPathResult,
  WeightedGraph,
} from "./graph";

export interface MultiRouteOptions<Mode extends string = string, EdgeMeta = undefined>
  extends ShortestPathOptions<Mode, EdgeMeta> {
  deduplicateStops?: boolean;
  maxExactStops?: number;
}

export interface RouteLeg<Mode extends string = string, EdgeMeta = undefined> {
  from: string;
  path: ShortestPathResult<Mode, EdgeMeta>;
  to: string;
}

export interface MultiRouteResult<Mode extends string = string, EdgeMeta = undefined> {
  closedLoop: string[];
  legs: RouteLeg<Mode, EdgeMeta>[];
  method: "exact" | "heuristic" | "trivial";
  order: string[];
  path: string[];
  reachable: boolean;
  totalCost: number;
  totalDistance: number;
  totalTime: number;
  unreachablePairs: Array<{ from: string; to: string }>;
}

interface RouteMetrics {
  cost: number;
  distance: number;
  time: number;
}

interface ExactState extends RouteMetrics {
  previousLast: number;
  previousMask: number;
}

function compareMetrics(left: RouteMetrics, right: RouteMetrics): number {
  // Keep routing decisions deterministic by using the same tie-break order as shortest-path search.
  if (left.cost !== right.cost) {
    return left.cost - right.cost;
  }

  if (left.time !== right.time) {
    return left.time - right.time;
  }

  return left.distance - right.distance;
}

function createLookupKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

function createUnreachableResult<Mode extends string, EdgeMeta>(
  method: "exact" | "heuristic" | "trivial",
  unreachablePairs: Array<{ from: string; to: string }>,
): MultiRouteResult<Mode, EdgeMeta> {
  return {
    closedLoop: [],
    legs: [],
    method,
    order: [],
    path: [],
    reachable: false,
    totalCost: Number.POSITIVE_INFINITY,
    totalDistance: Number.POSITIVE_INFINITY,
    totalTime: Number.POSITIVE_INFINITY,
    unreachablePairs,
  };
}

function createTrivialResult<Mode extends string, EdgeMeta>(origin: string): MultiRouteResult<Mode, EdgeMeta> {
  return {
    closedLoop: [origin],
    legs: [],
    method: "trivial",
    order: [],
    path: [origin],
    reachable: true,
    totalCost: 0,
    totalDistance: 0,
    totalTime: 0,
    unreachablePairs: [],
  };
}

function validateMaxExactStops(maxExactStops: number): void {
  if (!Number.isInteger(maxExactStops) || maxExactStops <= 0) {
    throw new Error("maxExactStops must be a positive integer.");
  }
}

function getExactStateRow(
  dp: ReadonlyArray<Array<ExactState | undefined>>,
  mask: number,
): Array<ExactState | undefined> {
  const row = dp[mask];

  if (row === undefined) {
    throw new Error("Internal route solver state is inconsistent.");
  }

  return row;
}

function getStop(stops: readonly string[], index: number): string {
  const stop = stops[index];

  if (stop === undefined) {
    throw new Error("Internal route solver stop index is out of bounds.");
  }

  return stop;
}

function buildPairwisePaths<Mode extends string, NodeMeta, EdgeMeta>(
  graph: WeightedGraph<Mode, NodeMeta, EdgeMeta>,
  checkpoints: string[],
  options: MultiRouteOptions<Mode, EdgeMeta>,
): {
  paths: Map<string, ShortestPathResult<Mode, EdgeMeta>>;
  unreachablePairs: Array<{ from: string; to: string }>;
} {
  const lookup = new Map<string, ShortestPathResult<Mode, EdgeMeta>>();
  const unreachablePairs: Array<{ from: string; to: string }> = [];

  for (const source of checkpoints) {
    const tree = findShortestPathTree(graph, source, options);

    for (const target of checkpoints) {
      if (source === target) {
        continue;
      }

      const path = tree.get(target);

      if (!path || !path.reachable) {
        unreachablePairs.push({ from: source, to: target });
        continue;
      }

      lookup.set(createLookupKey(source, target), path);
    }
  }

  return { paths: lookup, unreachablePairs };
}

function getPath<Mode extends string, EdgeMeta>(
  paths: Map<string, ShortestPathResult<Mode, EdgeMeta>>,
  from: string,
  to: string,
): ShortestPathResult<Mode, EdgeMeta> | undefined {
  return paths.get(createLookupKey(from, to));
}

function solveExactRoute<Mode extends string, EdgeMeta>(
  origin: string,
  stops: string[],
  paths: Map<string, ShortestPathResult<Mode, EdgeMeta>>,
): string[] | undefined {
  const stopCount = stops.length;

  if (stopCount === 0) {
    return [];
  }

  const fullMask = (1 << stopCount) - 1;
  // Held-Karp state: dp[mask][last] stores the best metrics for visiting `mask` and ending at `last`.
  const dp: Array<Array<ExactState | undefined>> = Array.from(
    { length: fullMask + 1 },
    () => Array.from({ length: stopCount }, () => undefined),
  );

  for (let index = 0; index < stopCount; index += 1) {
    const initialRow = getExactStateRow(dp, 1 << index);
    const path = getPath(paths, origin, getStop(stops, index));

    if (!path) {
      continue;
    }

    initialRow[index] = {
      cost: path.cost,
      distance: path.distance,
      previousLast: -1,
      previousMask: 0,
      time: path.time,
    };
  }

  for (let mask = 1; mask <= fullMask; mask += 1) {
    const row = getExactStateRow(dp, mask);

    for (let last = 0; last < stopCount; last += 1) {
      const state = row[last];

      if (!state) {
        continue;
      }

      for (let next = 0; next < stopCount; next += 1) {
        if ((mask & (1 << next)) !== 0) {
          continue;
        }

        const path = getPath(paths, getStop(stops, last), getStop(stops, next));

        if (!path) {
          continue;
        }

        const nextMask = mask | (1 << next);
        const nextState: ExactState = {
          cost: state.cost + path.cost,
          distance: state.distance + path.distance,
          previousLast: last,
          previousMask: mask,
          time: state.time + path.time,
        };

        const nextRow = getExactStateRow(dp, nextMask);
        const currentBest = nextRow[next];

        if (!currentBest || compareMetrics(nextState, currentBest) < 0) {
          nextRow[next] = nextState;
        }
      }
    }
  }

  let bestLast = -1;
  let bestMetrics: RouteMetrics | undefined;

  for (let last = 0; last < stopCount; last += 1) {
    const fullMaskRow = getExactStateRow(dp, fullMask);
    const state = fullMaskRow[last];
    const returnPath = getPath(paths, getStop(stops, last), origin);

    if (!state || !returnPath) {
      continue;
    }

    const totalMetrics: RouteMetrics = {
      cost: state.cost + returnPath.cost,
      distance: state.distance + returnPath.distance,
      time: state.time + returnPath.time,
    };

    if (!bestMetrics || compareMetrics(totalMetrics, bestMetrics) < 0) {
      bestLast = last;
      bestMetrics = totalMetrics;
    }
  }

  if (bestLast < 0) {
    return undefined;
  }

  const order: string[] = [];
  let mask = fullMask;
  let last = bestLast;

  while (last >= 0) {
    order.push(getStop(stops, last));
    const row = getExactStateRow(dp, mask);
    const state = row[last];

    if (!state) {
      throw new Error("Internal route reconstruction failed.");
    }

    mask = state.previousMask;
    last = state.previousLast;
  }

  order.reverse();
  return order;
}

function solveHeuristicRoute<Mode extends string, EdgeMeta>(
  origin: string,
  stops: string[],
  paths: Map<string, ShortestPathResult<Mode, EdgeMeta>>,
): string[] | undefined {
  const remaining = new Set<string>(stops);
  const order: string[] = [];
  let current = origin;

  while (remaining.size > 0) {
    let bestStop: string | undefined;
    let bestMetrics: RouteMetrics | undefined;

    // The heuristic fallback is a nearest-neighbor walk using the same metric ordering as the exact solver.
    for (const stop of remaining) {
      const path = getPath(paths, current, stop);

      if (!path) {
        continue;
      }

      const metrics: RouteMetrics = {
        cost: path.cost,
        distance: path.distance,
        time: path.time,
      };

      if (!bestMetrics || compareMetrics(metrics, bestMetrics) < 0) {
        bestStop = stop;
        bestMetrics = metrics;
      }
    }

    if (!bestStop) {
      return undefined;
    }

    order.push(bestStop);
    remaining.delete(bestStop);
    current = bestStop;
  }

  return getPath(paths, current, origin) ? order : undefined;
}

function buildRouteResult<Mode extends string, EdgeMeta>(
  origin: string,
  order: string[],
  method: "exact" | "heuristic",
  paths: Map<string, ShortestPathResult<Mode, EdgeMeta>>,
  unreachablePairs: Array<{ from: string; to: string }>,
): MultiRouteResult<Mode, EdgeMeta> {
  const checkpoints = [origin, ...order, origin];
  const legs: RouteLeg<Mode, EdgeMeta>[] = [];
  const joinedPath: string[] = [];
  let totalCost = 0;
  let totalDistance = 0;
  let totalTime = 0;

  for (let index = 0; index < checkpoints.length - 1; index += 1) {
    const from = checkpoints[index] as string;
    const to = checkpoints[index + 1] as string;
    const path = getPath(paths, from, to);

    if (!path || !path.reachable) {
      return createUnreachableResult(method, unreachablePairs);
    }

    legs.push({ from, path, to });
    totalCost += path.cost;
    totalDistance += path.distance;
    totalTime += path.time;

    if (joinedPath.length === 0) {
      joinedPath.push(...path.nodes);
    } else {
      // Adjacent legs share a checkpoint node, so drop the repeated first node from later segments.
      joinedPath.push(...path.nodes.slice(1));
    }
  }

  return {
    closedLoop: checkpoints,
    legs,
    method,
    order,
    path: joinedPath,
    reachable: true,
    totalCost,
    totalDistance,
    totalTime,
    unreachablePairs,
  };
}

export function planClosedLoopRoute<Mode extends string = string, NodeMeta = undefined, EdgeMeta = undefined>(
  graph: WeightedGraph<Mode, NodeMeta, EdgeMeta>,
  origin: string,
  stops: Iterable<string>,
  options: MultiRouteOptions<Mode, EdgeMeta> = {},
): MultiRouteResult<Mode, EdgeMeta> {
  if (!graph.hasNode(origin)) {
    throw new Error(`Unknown origin node: ${origin}`);
  }

  const maxExactStops = options.maxExactStops ?? 10;
  validateMaxExactStops(maxExactStops);

  const order: string[] = [];
  const seenStops = new Set<string>();

  for (const stop of stops) {
    if (!graph.hasNode(stop)) {
      throw new Error(`Unknown stop node: ${stop}`);
    }

    if (stop === origin) {
      if (options.deduplicateStops) {
        continue;
      }

      throw new Error("Stops must not include the origin node.");
    }

    if (seenStops.has(stop)) {
      if (options.deduplicateStops) {
        continue;
      }

      throw new Error(`Duplicate stop detected: ${stop}`);
    }

    seenStops.add(stop);
    order.push(stop);
  }

  if (order.length === 0) {
    return createTrivialResult(origin);
  }

  const checkpoints = [origin, ...order];
  const { paths, unreachablePairs } = buildPairwisePaths(graph, checkpoints, options);
  // The exact solver grows exponentially with stop count, so larger inputs switch to the heuristic fallback.
  const method = order.length <= maxExactStops ? "exact" : "heuristic";
  const routeOrder = method === "exact"
    ? solveExactRoute(origin, order, paths)
    : solveHeuristicRoute(origin, order, paths);

  if (!routeOrder) {
    return createUnreachableResult(method, unreachablePairs);
  }

  return buildRouteResult(origin, routeOrder, method, paths, unreachablePairs);
}
