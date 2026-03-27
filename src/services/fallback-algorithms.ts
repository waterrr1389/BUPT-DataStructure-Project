import type {
  DestinationEdge,
  DestinationRecord,
  JournalRating,
  PathResult,
  RecommendationHelpers,
  RouteStep,
  RoutingHelpers,
  RouteStrategy,
  SearchHelpers,
  StoryboardResult,
  TravelMode,
} from "./contracts";

const STOP_WORDS = new Set(["the", "and", "for", "with", "into", "from", "that", "this", "then"]);

class MinHeap<T> {
  #items: T[] = [];
  #compare: (left: T, right: T) => number;

  constructor(compare: (left: T, right: T) => number) {
    this.#compare = compare;
  }

  get size(): number {
    return this.#items.length;
  }

  peek(): T | undefined {
    return this.#items[0];
  }

  push(value: T): void {
    this.#items.push(value);
    this.#bubbleUp(this.#items.length - 1);
  }

  replaceTop(value: T): void {
    this.#items[0] = value;
    this.#bubbleDown(0);
  }

  pop(): T | undefined {
    if (this.#items.length === 0) {
      return undefined;
    }
    const top = this.#items[0];
    const last = this.#items.pop()!;
    if (this.#items.length > 0) {
      this.#items[0] = last;
      this.#bubbleDown(0);
    }
    return top;
  }

  values(): T[] {
    return [...this.#items];
  }

  #bubbleUp(index: number): void {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (this.#compare(this.#items[child], this.#items[parent]) >= 0) {
        break;
      }
      [this.#items[child], this.#items[parent]] = [this.#items[parent], this.#items[child]];
      child = parent;
    }
  }

  #bubbleDown(index: number): void {
    let parent = index;
    while (true) {
      const left = parent * 2 + 1;
      const right = parent * 2 + 2;
      let candidate = parent;
      if (left < this.#items.length && this.#compare(this.#items[left], this.#items[candidate]) < 0) {
        candidate = left;
      }
      if (right < this.#items.length && this.#compare(this.#items[right], this.#items[candidate]) < 0) {
        candidate = right;
      }
      if (candidate === parent) {
        break;
      }
      [this.#items[parent], this.#items[candidate]] = [this.#items[candidate], this.#items[parent]];
      parent = candidate;
    }
  }
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function averageRating(ratings: JournalRating[]): number {
  if (ratings.length === 0) {
    return 0;
  }
  const sum = ratings.reduce((total, rating) => total + rating.score, 0);
  return Number((sum / ratings.length).toFixed(2));
}

export const fallbackRecommendationHelpers: RecommendationHelpers = {
  topK<T>(items: T[], limit: number, score: (item: T) => number): T[] {
    if (limit <= 0) {
      return [];
    }
    // Keep only the current winners so ranking stays stable by insertion order without sorting the whole input.
    const heap = new MinHeap<{ item: T; score: number; order: number }>((left, right) => {
      if (left.score === right.score) {
        return left.order - right.order;
      }
      return left.score - right.score;
    });
    items.forEach((item, order) => {
      const value = score(item);
      const entry = { item, score: value, order };
      if (heap.size < limit) {
        heap.push(entry);
        return;
      }
      const top = heap.peek()!;
      if (value > top.score || (value === top.score && order < top.order)) {
        heap.replaceTop(entry);
      }
    });
    return heap
      .values()
      .sort((left, right) => (right.score === left.score ? left.order - right.order : right.score - left.score))
      .map((entry) => entry.item);
  },
};

export const fallbackSearchHelpers: SearchHelpers = {
  rankText<T>(
    items: T[],
    query: string,
    value: (item: T) => string[],
    limit: number,
  ): Array<{ item: T; score: number; matches: string[] }> {
    const queryTokens = uniqueStrings(tokenize(query));
    if (queryTokens.length === 0) {
      return [];
    }
    const ranked = items
      .map((item) => {
        const haystacks = value(item).map((part) => normalizeText(part));
        const matches = queryTokens.filter((token) => haystacks.some((haystack) => haystack.includes(token)));
        const normalizedQuery = normalizeText(query);
        // Exact and phrase boosts keep short, direct matches ahead of broad token overlaps.
        const exactBoost = haystacks.some((haystack) => haystack === normalizedQuery) ? 4 : 0;
        const phraseBoost = haystacks.join(" ").includes(normalizedQuery) ? 2 : 0;
        const score = matches.length * 3 + exactBoost + phraseBoost;
        return { item, score, matches };
      })
      .filter((result) => result.matches.length > 0)
      .sort((left, right) => right.score - left.score);
    return ranked.slice(0, Math.max(limit, 1));
  },
  exactTitle<T>(items: T[], title: string, value: (item: T) => string): T | null {
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) {
      return null;
    }
    return items.find((item) => normalizeText(value(item)) === normalizedTitle) ?? null;
  },
  buildInvertedIndex<T>(items: T[], text: (item: T) => string): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    items.forEach((item) => {
      const id = String((item as { id?: string }).id ?? "");
      tokenize(text(item)).forEach((token) => {
        const bucket = index.get(token) ?? new Set<string>();
        bucket.add(id);
        index.set(token, bucket);
      });
    });
    return index;
  },
};

function modeSpeed(mode: TravelMode): number {
  switch (mode) {
    case "bike":
      return 4.6;
    case "shuttle":
      return 6.2;
    default:
      return 1.4;
  }
}

function pickMode(edge: DestinationEdge, requestedMode: TravelMode): TravelMode | null {
  if (requestedMode === "mixed") {
    // Mixed routing prefers the fastest permitted mode on each edge instead of preserving a prior segment mode.
    if (edge.allowedModes.includes("shuttle")) {
      return "shuttle";
    }
    if (edge.allowedModes.includes("bike")) {
      return "bike";
    }
    return edge.allowedModes.includes("walk") ? "walk" : null;
  }
  return edge.allowedModes.includes(requestedMode) ? requestedMode : null;
}

function edgeCost(edge: DestinationEdge, strategy: RouteStrategy, mode: TravelMode): { cost: number; mode: TravelMode } | null {
  const effectiveMode = strategy === "mixed" ? pickMode(edge, "mixed") : pickMode(edge, mode);
  if (!effectiveMode) {
    return null;
  }
  if (strategy === "distance") {
    return { cost: edge.distance, mode: effectiveMode };
  }
  const speed = modeSpeed(effectiveMode);
  const adjusted = edge.distance / speed;
  // Time-based routing starts from travel time, then inflates it by edge congestion so blocked shortcuts lose priority.
  const congestionMultiplier = 1 + edge.congestion * 1.15;
  return {
    cost: Number((adjusted * congestionMultiplier).toFixed(2)),
    mode: effectiveMode,
  };
}

function buildAdjacency(destination: DestinationRecord): Map<string, Array<{ edge: DestinationEdge; next: string }>> {
  const adjacency = new Map<string, Array<{ edge: DestinationEdge; next: string }>>();
  for (const edge of destination.graph.edges) {
    const fromEntries = adjacency.get(edge.from) ?? [];
    fromEntries.push({ edge, next: edge.to });
    adjacency.set(edge.from, fromEntries);
    const toEntries = adjacency.get(edge.to) ?? [];
    toEntries.push({ edge, next: edge.from });
    adjacency.set(edge.to, toEntries);
  }
  return adjacency;
}

function reconstructPath(
  previous: Map<string, { nodeId: string; edge: DestinationEdge; mode: TravelMode }>,
  endNodeId: string,
  startNodeId: string,
  strategy: RouteStrategy,
  costs: Map<string, number>,
): PathResult {
  const nodeIds: string[] = [endNodeId];
  const steps: RouteStep[] = [];
  let current = endNodeId;
  let totalDistance = 0;
  while (current !== startNodeId) {
    const segment = previous.get(current);
    if (!segment) {
      return {
        reachable: false,
        nodeIds: [],
        steps: [],
        totalDistance: 0,
        totalCost: 0,
        strategy,
      };
    }
    nodeIds.unshift(segment.nodeId);
    steps.unshift({
      edgeId: segment.edge.id,
      from: segment.nodeId,
      to: current,
      mode: segment.mode,
      distance: segment.edge.distance,
      cost: Number((costs.get(current)! - costs.get(segment.nodeId)!).toFixed(2)),
    });
    totalDistance += segment.edge.distance;
    current = segment.nodeId;
  }
  return {
    reachable: true,
    nodeIds,
    steps,
    totalDistance,
    totalCost: Number((costs.get(endNodeId) ?? 0).toFixed(2)),
    strategy,
  };
}

function runShortestPath(args: {
  destination: DestinationRecord;
  startNodeId: string;
  endNodeId: string;
  strategy: RouteStrategy;
  mode: TravelMode;
}): PathResult {
  const { destination, startNodeId, endNodeId, strategy, mode } = args;
  const nodeIds = new Set(destination.graph.nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId) || !nodeIds.has(endNodeId)) {
    throw new Error("Unknown node id for route planning.");
  }
  if (startNodeId === endNodeId) {
    return {
      reachable: true,
      nodeIds: [startNodeId],
      steps: [],
      totalDistance: 0,
      totalCost: 0,
      strategy,
    };
  }

  const adjacency = buildAdjacency(destination);
  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: DestinationEdge; mode: TravelMode }>();
  const queue = new MinHeap<{ nodeId: string; cost: number }>((left, right) => left.cost - right.cost);
  queue.push({ nodeId: startNodeId, cost: 0 });
  const visited = new Set<string>();

  while (queue.size > 0) {
    const current = queue.pop()!;
    if (visited.has(current.nodeId)) {
      continue;
    }
    visited.add(current.nodeId);
    if (current.nodeId === endNodeId) {
      break;
    }
    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      const nextCost = edgeCost(neighbor.edge, strategy, mode);
      if (!nextCost) {
        continue;
      }
      const candidate = current.cost + nextCost.cost;
      const known = distances.get(neighbor.next);
      if (known === undefined || candidate < known) {
        distances.set(neighbor.next, candidate);
        previous.set(neighbor.next, {
          nodeId: current.nodeId,
          edge: neighbor.edge,
          mode: nextCost.mode,
        });
        queue.push({ nodeId: neighbor.next, cost: candidate });
      }
    }
  }

  if (!distances.has(endNodeId)) {
    return {
      reachable: false,
      nodeIds: [],
      steps: [],
      totalDistance: 0,
      totalCost: 0,
      strategy,
    };
  }
  return reconstructPath(previous, endNodeId, startNodeId, strategy, distances);
}

function mergePaths(paths: PathResult[], strategy: RouteStrategy): PathResult {
  const nodeIds: string[] = [];
  const steps: RouteStep[] = [];
  let totalDistance = 0;
  let totalCost = 0;
  for (const path of paths) {
    if (!path.reachable) {
      return {
        reachable: false,
        nodeIds: [],
        steps: [],
        totalDistance: 0,
        totalCost: 0,
        strategy,
      };
    }
    if (nodeIds.length === 0) {
      nodeIds.push(...path.nodeIds);
    } else {
      // Drop the repeated boundary node when stitching consecutive segments into one walk.
      nodeIds.push(...path.nodeIds.slice(1));
    }
    steps.push(...path.steps);
    totalDistance += path.totalDistance;
    totalCost += path.totalCost;
  }
  return {
    reachable: true,
    nodeIds,
    steps,
    totalDistance,
    totalCost: Number(totalCost.toFixed(2)),
    strategy,
  };
}

function runClosedWalk(args: {
  destination: DestinationRecord;
  startNodeId: string;
  targetNodeIds: string[];
  strategy: RouteStrategy;
  mode: TravelMode;
}): PathResult {
  const uniqueTargets = uniqueStrings(args.targetNodeIds).filter((target) => target !== args.startNodeId);
  if (uniqueTargets.length === 0) {
    return {
      reachable: true,
      nodeIds: [args.startNodeId],
      steps: [],
      totalDistance: 0,
      totalCost: 0,
      strategy: args.strategy,
    };
  }

  const cache = new Map<string, PathResult>();
  const getPath = (from: string, to: string): PathResult => {
    const key = `${from}->${to}`;
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }
    const path = runShortestPath({
      destination: args.destination,
      startNodeId: from,
      endNodeId: to,
      strategy: args.strategy,
      mode: args.mode,
    });
    cache.set(key, path);
    return path;
  };

  const orderedTargets: string[] = [];
  let current = args.startNodeId;
  const remaining = new Set(uniqueTargets);
  while (remaining.size > 0) {
    const candidates = [...remaining].map((target) => ({ target, path: getPath(current, target) }));
    // The fallback planner uses a greedy nearest-next pass to stay deterministic and lightweight.
    candidates.sort((left, right) => left.path.totalCost - right.path.totalCost);
    const next = candidates.find((candidate) => candidate.path.reachable);
    if (!next) {
      return {
        reachable: false,
        nodeIds: [],
        steps: [],
        totalDistance: 0,
        totalCost: 0,
        strategy: args.strategy,
      };
    }
    orderedTargets.push(next.target);
    remaining.delete(next.target);
    current = next.target;
  }

  const parts: PathResult[] = [];
  current = args.startNodeId;
  for (const target of orderedTargets) {
    parts.push(getPath(current, target));
    current = target;
  }
  parts.push(getPath(current, args.startNodeId));
  return mergePaths(parts, args.strategy);
}

export const fallbackRoutingHelpers: RoutingHelpers = {
  shortestPath: runShortestPath,
  closedWalk: runClosedWalk,
};

export function compressText(input: string): string {
  if (input.length === 0) {
    return "";
  }
  const dict = new Map<string, number>();
  for (let index = 0; index < 256; index += 1) {
    dict.set(String.fromCharCode(index), index);
  }
  let phrase = input[0];
  let code = 256;
  const output: number[] = [];
  for (let index = 1; index < input.length; index += 1) {
    const char = input[index];
    const combined = phrase + char;
    if (dict.has(combined)) {
      phrase = combined;
      continue;
    }
    output.push(dict.get(phrase)!);
    dict.set(combined, code);
    code += 1;
    phrase = char;
  }
  output.push(dict.get(phrase)!);
  return output.map((value) => value.toString(36)).join("-");
}

export function decompressText(input: string): string {
  if (input.trim() === "") {
    return "";
  }
  const codes = input.split("-").map((part) => Number.parseInt(part, 36));
  const dict = new Map<number, string>();
  for (let index = 0; index < 256; index += 1) {
    dict.set(index, String.fromCharCode(index));
  }
  let previous = dict.get(codes[0]);
  if (previous === undefined) {
    throw new Error("Invalid compressed payload.");
  }
  let code = 256;
  let output = previous;
  for (let index = 1; index < codes.length; index += 1) {
    const currentCode = codes[index];
    let entry = dict.get(currentCode);
    if (entry === undefined && currentCode === code) {
      entry = previous + previous[0];
    }
    if (entry === undefined) {
      throw new Error("Compressed payload could not be decoded.");
    }
    output += entry;
    dict.set(code, previous + entry[0]);
    code += 1;
    previous = entry;
  }
  return output;
}

function svgDataUri(seed: number, caption: string): string {
  const palette = [
    ["#f97316", "#0f172a", "#fdba74"],
    ["#0f766e", "#082f49", "#99f6e4"],
    ["#be123c", "#1f2937", "#fecdd3"],
    ["#155e75", "#111827", "#a5f3fc"],
  ];
  const [accent, base, detail] = palette[seed % palette.length];
  const safeCaption = caption.replace(/[<&>]/g, " ");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="${base}"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="180" rx="20" fill="url(#g)"/>` +
    `<circle cx="58" cy="54" r="26" fill="${detail}" fill-opacity="0.55"/>` +
    `<path d="M0 146 Q84 104 164 132 T320 112 L320 180 L0 180 Z" fill="${detail}" fill-opacity="0.25"/>` +
    `<text x="24" y="126" fill="#fff7ed" font-family="Georgia, serif" font-size="18">${safeCaption}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generateStoryboard(title: string, prompt: string, mediaSources: string[]): StoryboardResult {
  const promptTokens = uniqueStrings(tokenize(prompt)).slice(0, 5);
  if (promptTokens.length === 0 && mediaSources.length === 0) {
    throw new Error("Storyboard generation needs text or media inputs.");
  }
  const frames = Array.from({ length: 4 }, (_, index) => {
    const motif = promptTokens[index] ?? mediaSources[index]?.split("/").pop() ?? "journey";
    const caption = `Frame ${index + 1}: ${motif} at ${title}`;
    return {
      id: `frame-${index + 1}`,
      caption,
      art: svgDataUri(index, caption),
      durationMs: 1200 + index * 150,
    };
  });
  return {
    title: `${title} storyboard`,
    frames,
  };
}

export function excerpt(text: string, terms: string[]): string {
  if (terms.length === 0) {
    return text.slice(0, 140);
  }
  const normalized = normalizeText(text);
  const term = terms.find((candidate) => normalized.includes(candidate));
  if (!term) {
    return text.slice(0, 140);
  }
  const index = normalized.indexOf(term);
  return text.slice(Math.max(0, index - 30), Math.min(text.length, index + 110)).trim();
}
