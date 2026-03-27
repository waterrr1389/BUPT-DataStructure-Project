import { MinHeap } from "./top-k";

export type RoutingStrategy = "distance" | "time";

export interface GraphNode<NodeMeta = undefined> {
  data?: NodeMeta;
  id: string;
}

export interface GraphEdgeInput<Mode extends string = string, EdgeMeta = undefined> {
  allowedModes?: readonly Mode[];
  bidirectional?: boolean;
  crowdFactor?: number;
  distance: number;
  from: string;
  metadata?: EdgeMeta;
  speedByMode?: Partial<Record<Mode, number>>;
  timeByMode?: Partial<Record<Mode, number>>;
  to: string;
}

export interface GraphEdge<Mode extends string = string, EdgeMeta = undefined> {
  allowedModes?: readonly Mode[];
  crowdFactor: number;
  distance: number;
  from: string;
  metadata?: EdgeMeta;
  speedByMode?: Partial<Record<Mode, number>>;
  timeByMode?: Partial<Record<Mode, number>>;
  to: string;
}

export interface ShortestPathOptions<Mode extends string = string, EdgeMeta = undefined> {
  allowedModes?: readonly Mode[];
  defaultSpeedByMode?: Partial<Record<Mode, number>>;
  edgeFilter?: (edge: GraphEdge<Mode, EdgeMeta>) => boolean;
  mode?: Mode;
  strategy?: RoutingStrategy;
}

export interface PathStep<Mode extends string = string, EdgeMeta = undefined> {
  cost: number;
  distance: number;
  from: string;
  metadata?: EdgeMeta;
  mode: Mode | null;
  time: number;
  to: string;
}

export interface ShortestPathResult<Mode extends string = string, EdgeMeta = undefined> {
  cost: number;
  distance: number;
  nodes: string[];
  reachable: boolean;
  steps: PathStep<Mode, EdgeMeta>[];
  time: number;
  visitedNodes: number;
}

interface FrontierEntry {
  cost: number;
  distance: number;
  nodeId: string;
  time: number;
}

interface PathState<Mode extends string, EdgeMeta> {
  cost: number;
  distance: number;
  nodeId: string;
  previousNodeId?: string;
  previousStep?: PathStep<Mode, EdgeMeta>;
  time: number;
}

interface DijkstraResult<Mode extends string, EdgeMeta> {
  states: Map<string, PathState<Mode, EdgeMeta>>;
  visitedNodes: number;
}

function compareMetrics(
  left: Pick<PathState<string, unknown> | FrontierEntry, "cost" | "distance" | "time">,
  right: Pick<PathState<string, unknown> | FrontierEntry, "cost" | "distance" | "time">,
): number {
  // Secondary metrics keep path selection stable when the primary strategy ties.
  if (left.cost !== right.cost) {
    return left.cost - right.cost;
  }

  if (left.time !== right.time) {
    return left.time - right.time;
  }

  return left.distance - right.distance;
}

function createTrivialResult<Mode extends string, EdgeMeta>(): ShortestPathResult<Mode, EdgeMeta> {
  return {
    cost: 0,
    distance: 0,
    nodes: [],
    reachable: true,
    steps: [],
    time: 0,
    visitedNodes: 1,
  };
}

function createUnreachableResult<Mode extends string, EdgeMeta>(visitedNodes: number): ShortestPathResult<Mode, EdgeMeta> {
  return {
    cost: Number.POSITIVE_INFINITY,
    distance: Number.POSITIVE_INFINITY,
    nodes: [],
    reachable: false,
    steps: [],
    time: Number.POSITIVE_INFINITY,
    visitedNodes,
  };
}

function validateModeRecord<Mode extends string>(label: string, values: Partial<Record<Mode, number>> | undefined): void {
  if (!values) {
    return;
  }

  for (const [mode, value] of Object.entries(values) as Array<[string, number]>) {
    if (mode === "" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} entries must use non-empty mode names and positive numbers.`);
    }
  }
}

function validateRoutingOptions<Mode extends string>(options: ShortestPathOptions<Mode, unknown>): void {
  if (options.allowedModes && options.allowedModes.length === 0) {
    throw new Error("Allowed modes must not be empty.");
  }

  validateModeRecord("Default speed", options.defaultSpeedByMode);

  if (options.mode && options.allowedModes && !options.allowedModes.includes(options.mode)) {
    throw new Error("Specific mode must be included in allowedModes.");
  }
}

function copyModeRecord<Mode extends string>(values: Partial<Record<Mode, number>> | undefined): Partial<Record<Mode, number>> | undefined {
  return values ? { ...values } : undefined;
}

function cloneGraphNode<NodeMeta>(node: GraphNode<NodeMeta>): GraphNode<NodeMeta> {
  const clonedNode: GraphNode<NodeMeta> = { id: node.id };

  if (node.data !== undefined) {
    clonedNode.data = node.data;
  }

  return clonedNode;
}

function createGraphEdge<Mode extends string, EdgeMeta>(
  from: string,
  to: string,
  edge: GraphEdgeInput<Mode, EdgeMeta>,
): GraphEdge<Mode, EdgeMeta> {
  const storedEdge: GraphEdge<Mode, EdgeMeta> = {
    crowdFactor: edge.crowdFactor ?? 1,
    distance: edge.distance,
    from,
    to,
  };

  if (edge.allowedModes !== undefined) {
    storedEdge.allowedModes = [...edge.allowedModes];
  }

  if (edge.metadata !== undefined) {
    storedEdge.metadata = edge.metadata;
  }

  const speedByMode = copyModeRecord(edge.speedByMode);
  if (speedByMode !== undefined) {
    storedEdge.speedByMode = speedByMode;
  }

  const timeByMode = copyModeRecord(edge.timeByMode);
  if (timeByMode !== undefined) {
    storedEdge.timeByMode = timeByMode;
  }

  return storedEdge;
}

function collectModes<Mode extends string>(edge: GraphEdge<Mode, unknown>): Mode[] {
  const modes = new Set<Mode>();

  for (const mode of edge.allowedModes ?? []) {
    modes.add(mode);
  }

  for (const mode of Object.keys(edge.speedByMode ?? {}) as Mode[]) {
    modes.add(mode);
  }

  for (const mode of Object.keys(edge.timeByMode ?? {}) as Mode[]) {
    modes.add(mode);
  }

  return Array.from(modes.values());
}

function estimateTraversalTime<Mode extends string>(
  edge: GraphEdge<Mode, unknown>,
  mode: Mode | null,
  defaultSpeedByMode: Partial<Record<Mode, number>> | undefined,
): number {
  const crowdFactor = edge.crowdFactor;

  if (mode !== null) {
    // Time resolution prefers explicit per-mode duration before any speed-based estimate.
    const explicitTime = edge.timeByMode?.[mode];

    if (explicitTime !== undefined) {
      // Lower crowdFactor increases the effective traversal time.
      return explicitTime / crowdFactor;
    }

    // If no explicit duration exists, fall back to edge speed, then graph-level default speed.
    const speed = edge.speedByMode?.[mode] ?? defaultSpeedByMode?.[mode];

    if (speed !== undefined) {
      return (edge.distance / speed) / crowdFactor;
    }
  }

  // A null mode, or a mode with no time/speed data, falls back to distance scaled by crowdFactor.
  return edge.distance / crowdFactor;
}

function isModeAllowed<Mode extends string>(
  edge: GraphEdge<Mode, unknown>,
  mode: Mode,
): boolean {
  if (!edge.allowedModes) {
    return true;
  }

  return edge.allowedModes.includes(mode);
}

function resolveTraversal<Mode extends string, EdgeMeta>(
  edge: GraphEdge<Mode, EdgeMeta>,
  options: ShortestPathOptions<Mode, EdgeMeta>,
): PathStep<Mode, EdgeMeta> | undefined {
  if (options.edgeFilter && !options.edgeFilter(edge)) {
    return undefined;
  }

  const strategy = options.strategy ?? "distance";
  const candidateModes: Array<Mode | null> = [];

  if (options.mode) {
    if (!isModeAllowed(edge, options.mode)) {
      return undefined;
    }

    candidateModes.push(options.mode);
  } else if (options.allowedModes && options.allowedModes.length > 0) {
    for (const mode of options.allowedModes) {
      if (isModeAllowed(edge, mode)) {
        candidateModes.push(mode);
      }
    }

    if (candidateModes.length === 0) {
      return undefined;
    }
  } else {
    const edgeModes = collectModes(edge);

    if (edgeModes.length === 0) {
      // Edges without mode metadata stay traversable as generic distance-based links.
      candidateModes.push(null);
    } else {
      for (const mode of edgeModes) {
        if (isModeAllowed(edge, mode)) {
          candidateModes.push(mode);
        }
      }
    }
  }

  if (candidateModes.length === 0) {
    return undefined;
  }

  let bestStep: PathStep<Mode, EdgeMeta> | undefined;

  for (const mode of candidateModes) {
    const time = estimateTraversalTime(edge, mode, options.defaultSpeedByMode);
    const candidateStep: PathStep<Mode, EdgeMeta> = {
      cost: strategy === "time" ? time : edge.distance,
      distance: edge.distance,
      from: edge.from,
      mode,
      time,
      to: edge.to,
    };

    if (edge.metadata !== undefined) {
      candidateStep.metadata = edge.metadata;
    }

    // Reuse the global metric ordering so route expansion and mode selection agree.
    if (!bestStep || compareMetrics(candidateStep, bestStep) < 0) {
      bestStep = candidateStep;
    }
  }

  return bestStep;
}

export class WeightedGraph<Mode extends string = string, NodeMeta = undefined, EdgeMeta = undefined> {
  private readonly adjacency: Map<string, GraphEdge<Mode, EdgeMeta>[]>;
  private readonly nodes: Map<string, GraphNode<NodeMeta>>;

  constructor() {
    this.adjacency = new Map<string, GraphEdge<Mode, EdgeMeta>[]>();
    this.nodes = new Map<string, GraphNode<NodeMeta>>();
  }

  get size(): number {
    return this.nodes.size;
  }

  addEdge(edge: GraphEdgeInput<Mode, EdgeMeta>): void {
    this.validateEdge(edge);
    this.ensureNode(edge.from);
    this.ensureNode(edge.to);
    this.insertEdge(edge.from, edge.to, edge);

    if (edge.bidirectional) {
      this.insertEdge(edge.to, edge.from, edge);
    }
  }

  addEdges(edges: Iterable<GraphEdgeInput<Mode, EdgeMeta>>): void {
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  addNode(node: GraphNode<NodeMeta>): void {
    if (node.id.trim() === "") {
      throw new Error("Graph node id must not be empty.");
    }

    this.nodes.set(node.id, cloneGraphNode(node));

    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  addNodes(nodes: Iterable<GraphNode<NodeMeta>>): void {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  getEdgesFrom(nodeId: string): readonly GraphEdge<Mode, EdgeMeta>[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  getNode(nodeId: string): GraphNode<NodeMeta> | undefined {
    return this.nodes.get(nodeId);
  }

  getNodeIds(): string[] {
    return Array.from(this.nodes.keys()).sort();
  }

  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  private ensureNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      this.addNode({ id: nodeId });
    }
  }

  private insertEdge(from: string, to: string, edge: GraphEdgeInput<Mode, EdgeMeta>): void {
    const adjacency = this.adjacency.get(from) as GraphEdge<Mode, EdgeMeta>[];

    adjacency.push(createGraphEdge(from, to, edge));
  }

  private validateEdge(edge: GraphEdgeInput<Mode, EdgeMeta>): void {
    if (edge.from.trim() === "" || edge.to.trim() === "") {
      throw new Error("Graph edges must use non-empty node ids.");
    }

    if (!Number.isFinite(edge.distance) || edge.distance <= 0) {
      throw new Error("Graph edge distance must be a positive number.");
    }

    if (edge.allowedModes && edge.allowedModes.length === 0) {
      throw new Error("Edge allowed modes must not be empty.");
    }

    if (edge.crowdFactor !== undefined && (!Number.isFinite(edge.crowdFactor) || edge.crowdFactor <= 0 || edge.crowdFactor > 1)) {
      throw new Error("Edge crowd factor must be in the interval (0, 1].");
    }

    validateModeRecord("Edge speed", edge.speedByMode);
    validateModeRecord("Edge time", edge.timeByMode);
  }
}

export function buildGraph<Mode extends string = string, NodeMeta = undefined, EdgeMeta = undefined>(
  nodes: Iterable<GraphNode<NodeMeta>>,
  edges: Iterable<GraphEdgeInput<Mode, EdgeMeta>>,
): WeightedGraph<Mode, NodeMeta, EdgeMeta> {
  const graph = new WeightedGraph<Mode, NodeMeta, EdgeMeta>();
  graph.addNodes(nodes);
  graph.addEdges(edges);
  return graph;
}

function reconstructPath<Mode extends string, EdgeMeta>(
  source: string,
  target: string,
  states: Map<string, PathState<Mode, EdgeMeta>>,
  visitedNodes: number,
): ShortestPathResult<Mode, EdgeMeta> {
  if (source === target) {
    return {
      ...createTrivialResult<Mode, EdgeMeta>(),
      nodes: [source],
      visitedNodes,
    };
  }

  const state = states.get(target);

  if (!state) {
    return createUnreachableResult<Mode, EdgeMeta>(visitedNodes);
  }

  const nodes: string[] = [];
  const steps: PathStep<Mode, EdgeMeta>[] = [];
  let currentState: PathState<Mode, EdgeMeta> | undefined = state;

  while (currentState) {
    nodes.push(currentState.nodeId);

    if (currentState.previousStep) {
      steps.push(currentState.previousStep);
    }

    currentState = currentState.previousNodeId ? states.get(currentState.previousNodeId) : undefined;
  }

  nodes.reverse();
  steps.reverse();

  return {
    cost: state.cost,
    distance: state.distance,
    nodes,
    reachable: true,
    steps,
    time: state.time,
    visitedNodes,
  };
}

function runDijkstra<Mode extends string, NodeMeta, EdgeMeta>(
  graph: WeightedGraph<Mode, NodeMeta, EdgeMeta>,
  source: string,
  options: ShortestPathOptions<Mode, EdgeMeta>,
): DijkstraResult<Mode, EdgeMeta> {
  validateRoutingOptions(options as ShortestPathOptions<Mode, unknown>);

  const states = new Map<string, PathState<Mode, EdgeMeta>>();
  const frontier = new MinHeap<FrontierEntry>((left, right) => compareMetrics(left, right));
  let visitedNodes = 0;

  states.set(source, {
    cost: 0,
    distance: 0,
    nodeId: source,
    time: 0,
  });

  frontier.push({
    cost: 0,
    distance: 0,
    nodeId: source,
    time: 0,
  });

  while (!frontier.isEmpty()) {
    const frontierEntry = frontier.pop() as FrontierEntry;
    const currentState = states.get(frontierEntry.nodeId) as PathState<Mode, EdgeMeta>;

    // Relaxation pushes replacement entries, so older heap entries must be ignored here.
    if (compareMetrics(frontierEntry, currentState) > 0) {
      continue;
    }

    visitedNodes += 1;

    for (const edge of graph.getEdgesFrom(frontierEntry.nodeId)) {
      const step = resolveTraversal(edge, options);

      if (!step) {
        continue;
      }

      const nextState: PathState<Mode, EdgeMeta> = {
        cost: currentState.cost + step.cost,
        distance: currentState.distance + step.distance,
        nodeId: edge.to,
        previousNodeId: currentState.nodeId,
        previousStep: step,
        time: currentState.time + step.time,
      };

      const knownState = states.get(edge.to);

      if (!knownState || compareMetrics(nextState, knownState) < 0) {
        states.set(edge.to, nextState);
        frontier.push({
          cost: nextState.cost,
          distance: nextState.distance,
          nodeId: edge.to,
          time: nextState.time,
        });
      }
    }
  }

  return { states, visitedNodes };
}

export function findShortestPath<Mode extends string = string, NodeMeta = undefined, EdgeMeta = undefined>(
  graph: WeightedGraph<Mode, NodeMeta, EdgeMeta>,
  source: string,
  target: string,
  options: ShortestPathOptions<Mode, EdgeMeta> = {},
): ShortestPathResult<Mode, EdgeMeta> {
  if (!graph.hasNode(source)) {
    throw new Error(`Unknown source node: ${source}`);
  }

  if (!graph.hasNode(target)) {
    throw new Error(`Unknown target node: ${target}`);
  }

  if (source === target) {
    return {
      ...createTrivialResult<Mode, EdgeMeta>(),
      nodes: [source],
    };
  }

  const { states, visitedNodes } = runDijkstra(graph, source, options);
  return reconstructPath(source, target, states, visitedNodes);
}

export function findShortestPathTree<Mode extends string = string, NodeMeta = undefined, EdgeMeta = undefined>(
  graph: WeightedGraph<Mode, NodeMeta, EdgeMeta>,
  source: string,
  options: ShortestPathOptions<Mode, EdgeMeta> = {},
): Map<string, ShortestPathResult<Mode, EdgeMeta>> {
  if (!graph.hasNode(source)) {
    throw new Error(`Unknown source node: ${source}`);
  }

  const { states, visitedNodes } = runDijkstra(graph, source, options);
  const results = new Map<string, ShortestPathResult<Mode, EdgeMeta>>();

  for (const nodeId of states.keys()) {
    results.set(nodeId, reconstructPath(source, nodeId, states, visitedNodes));
  }

  return results;
}
