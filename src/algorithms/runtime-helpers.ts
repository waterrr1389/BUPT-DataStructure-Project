import { rankFuzzyMatches } from "./fuzzy";
import { buildGraph, findShortestPath } from "./graph";
import { InvertedIndex } from "./inverted-index";
import { planClosedLoopRoute } from "./multi-route";
import { selectTopK } from "./top-k";
import { Trie } from "./trie";
import type {
  DestinationEdge,
  DestinationRecord,
  PathResult,
  RecommendationHelpers,
  RouteStep,
  RouteStrategy,
  RoutingHelpers,
  SearchHelpers,
  TravelMode,
} from "../services/contracts";

interface RankedRecommendationItem<T> {
  index: number;
  item: T;
  score: number;
}

interface IndexedSearchItem<T> {
  fields: string[];
  index: number;
  item: T;
  primaryField: string;
}

interface SearchState<T> {
  index: number;
  item: T;
  matches: Set<string>;
  score: number;
}

const MODE_SPEEDS: Partial<Record<TravelMode, number>> = {
  bike: 4.6,
  shuttle: 6.2,
  walk: 1.4,
};

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (normalized === "") {
    return [];
  }

  return normalized.split(" ").filter((token) => token.length > 1);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function collectSearchFields(fields: string[]): string[] {
  return fields.map((field) => field.trim()).filter((field) => field.length > 0);
}

function toItemId(item: unknown, index: number): string {
  const candidate = (item as { id?: unknown }).id;
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate;
  }

  return String(index);
}

function createExactMatchTrie<T>(items: IndexedSearchItem<T>[]): Trie<number[]> {
  const trie = new Trie<number[]>({
    normalizer: normalizeSearchText,
  });

  for (const item of items) {
    if (item.primaryField === "") {
      continue;
    }

    const existing = trie.get(item.primaryField);
    if (existing) {
      existing.push(item.index);
    } else {
      trie.set(item.primaryField, [item.index]);
    }
  }

  return trie;
}

function createSearchState<T>(
  states: Map<number, SearchState<T>>,
  itemByIndex: Map<number, IndexedSearchItem<T>>,
  index: number,
): SearchState<T> {
  const existing = states.get(index);
  if (existing) {
    return existing;
  }

  const indexed = itemByIndex.get(index);
  if (!indexed) {
    throw new Error("Search state is missing indexed item data.");
  }

  const created: SearchState<T> = {
    index,
    item: indexed.item,
    matches: new Set<string>(),
    score: 0,
  };
  states.set(index, created);
  return created;
}

function createIndexedSearchItems<T>(
  items: readonly T[],
  value: (item: T) => string[],
): IndexedSearchItem<T>[] {
  const indexed: IndexedSearchItem<T>[] = [];

  items.forEach((item, index) => {
    const fields = collectSearchFields(value(item));
    if (fields.length === 0) {
      return;
    }

    indexed.push({
      fields,
      index,
      item,
      primaryField: fields[0] ?? "",
    });
  });

  return indexed;
}

function createSearchIndex<T>(items: IndexedSearchItem<T>[]): InvertedIndex<number, IndexedSearchItem<T>> {
  const index = new InvertedIndex<number, IndexedSearchItem<T>>({
    normalizer: normalizeSearchText,
    tokenizer: tokenizeSearchText,
  });

  for (const item of items) {
    index.add({
      id: item.index,
      metadata: item,
      text: item.fields.join(" "),
    });
  }

  return index;
}

function compareSearchStates<T>(left: SearchState<T>, right: SearchState<T>): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.index - right.index;
}

function toSearchMatches(matches: Set<string>): string[] {
  return Array.from(matches.values()).sort();
}

function createRecommendedModes(mode: TravelMode): readonly TravelMode[] | undefined {
  if (mode === "mixed") {
    return undefined;
  }

  return [mode];
}

function createRoutingStrategy(strategy: RouteStrategy): "distance" | "time" {
  return strategy === "distance" ? "distance" : "time";
}

function createEdgeSpeeds(allowedModes: readonly TravelMode[]): Partial<Record<TravelMode, number>> {
  const speeds: Partial<Record<TravelMode, number>> = {};

  for (const mode of allowedModes) {
    const speed = MODE_SPEEDS[mode];
    if (speed !== undefined) {
      speeds[mode] = speed;
    }
  }

  return speeds;
}

function createEdgeCrowdFactor(edge: DestinationEdge): number {
  return 1 / (1 + (edge.congestion * 1.15));
}

function buildDestinationGraph(destination: DestinationRecord) {
  return buildGraph<TravelMode, undefined, DestinationEdge>(
    destination.graph.nodes.map((node) => ({ id: node.id })),
    destination.graph.edges.map((edge) => ({
      allowedModes: edge.allowedModes,
      bidirectional: true,
      crowdFactor: createEdgeCrowdFactor(edge),
      distance: edge.distance,
      from: edge.from,
      metadata: edge,
      speedByMode: createEdgeSpeeds(edge.allowedModes),
      to: edge.to,
    })),
  );
}

function createUnreachablePath(strategy: RouteStrategy): PathResult {
  return {
    reachable: false,
    nodeIds: [],
    steps: [],
    strategy,
    totalCost: 0,
    totalDistance: 0,
  };
}

function toRouteStep(
  step: {
    cost: number;
    distance: number;
    from: string;
    metadata?: DestinationEdge;
    mode: TravelMode | null;
    to: string;
  },
): RouteStep {
  return {
    cost: roundMetric(step.cost),
    distance: roundMetric(step.distance),
    edgeId: step.metadata?.id ?? `${step.from}->${step.to}`,
    from: step.from,
    mode: step.mode ?? "walk",
    to: step.to,
  };
}

function toPathResult(
  strategy: RouteStrategy,
  result: {
    cost: number;
    distance: number;
    nodes: string[];
    reachable: boolean;
    steps: ReadonlyArray<{
      cost: number;
      distance: number;
      from: string;
      metadata?: DestinationEdge;
      mode: TravelMode | null;
      to: string;
    }>;
  },
): PathResult {
  if (!result.reachable) {
    return createUnreachablePath(strategy);
  }

  return {
    reachable: true,
    nodeIds: [...result.nodes],
    steps: result.steps.map((step) => toRouteStep(step)),
    strategy,
    totalCost: roundMetric(result.cost),
    totalDistance: roundMetric(result.distance),
  };
}

export const recommendation: RecommendationHelpers = {
  topK<T>(items: T[], limit: number, score: (item: T) => number): T[] {
    if (limit <= 0) {
      return [];
    }

    const ranked: RankedRecommendationItem<T>[] = items.map((item, index) => ({
      index,
      item,
      score: score(item),
    }));

    return selectTopK(
      ranked,
      limit,
      (left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      },
    ).map((entry) => entry.item);
  },
};

export const search: SearchHelpers = {
  rankText<T>(
    items: T[],
    query: string,
    value: (item: T) => string[],
    limit: number,
  ): Array<{ item: T; score: number; matches: string[] }> {
    if (limit <= 0) {
      return [];
    }

    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery === "") {
      return [];
    }

    const indexedItems = createIndexedSearchItems(items, value);
    if (indexedItems.length === 0) {
      return [];
    }

    const itemByIndex = new Map(indexedItems.map((item) => [item.index, item]));
    const searchIndex = createSearchIndex(indexedItems);
    const titleTrie = createExactMatchTrie(indexedItems);
    const states = new Map<number, SearchState<T>>();
    const lexicalHits = searchIndex.search(normalizedQuery, {
      matchMode: "any",
    });

    for (const hit of lexicalHits) {
      const state = createSearchState(states, itemByIndex, hit.id);
      state.score += hit.score * 10;
      hit.matchedTokens.forEach((token) => state.matches.add(token));
    }

    const exactMatchIds = titleTrie.searchExact(normalizedQuery)?.value ?? [];
    for (const index of exactMatchIds) {
      const state = createSearchState(states, itemByIndex, index);
      state.score += 16;
      state.matches.add("exact");
    }

    const prefixMatchIds = new Set<number>(
      titleTrie.searchPrefix(normalizedQuery).flatMap((entry) => entry.value),
    );
    for (const index of prefixMatchIds) {
      const state = createSearchState(states, itemByIndex, index);
      state.score += 6;
      state.matches.add("prefix");
    }

    const fuzzyMatches = rankFuzzyMatches(
      normalizedQuery,
      indexedItems,
      (item) =>
        item.fields.map((field, index) => ({
          key: index === 0 ? "title" : `field-${index + 1}`,
          text: field,
          weight: index === 0 ? 1.5 : 1,
        })),
      {
        normalizer: normalizeSearchText,
        threshold: lexicalHits.length > 0 ? 0.18 : 0.14,
        tieBreaker: (left, right) => left.index - right.index,
      },
    );

    for (const match of fuzzyMatches) {
      const state = createSearchState(states, itemByIndex, match.item.index);
      state.score += match.score * 8;
      match.matchedFields.forEach((field) => state.matches.add(field));
    }

    return selectTopK(
      Array.from(states.values()),
      limit,
      compareSearchStates,
    ).map((entry) => ({
      item: entry.item,
      matches: toSearchMatches(entry.matches),
      score: Number(entry.score.toFixed(3)),
    }));
  },

  exactTitle<T>(items: T[], title: string, value: (item: T) => string): T | null {
    const normalizedTitle = normalizeSearchText(title);
    if (normalizedTitle === "") {
      return null;
    }

    const trie = new Trie<T[]>({
      normalizer: normalizeSearchText,
    });

    items.forEach((item) => {
      const candidate = value(item);
      if (normalizeSearchText(candidate) === "") {
        return;
      }

      const existing = trie.get(candidate);
      if (existing) {
        existing.push(item);
      } else {
        trie.set(candidate, [item]);
      }
    });

    return trie.searchExact(normalizedTitle)?.value[0] ?? null;
  },

  buildInvertedIndex<T>(items: T[], text: (item: T) => string): Map<string, Set<string>> {
    const postingIndex = new Map<string, Set<string>>();

    items.forEach((item, index) => {
      const itemId = toItemId(item, index);
      const tokens = new Set(tokenizeSearchText(text(item)));

      tokens.forEach((token) => {
        const bucket = postingIndex.get(token) ?? new Set<string>();
        bucket.add(itemId);
        postingIndex.set(token, bucket);
      });
    });

    return postingIndex;
  },
};

export const routing: RoutingHelpers = {
  shortestPath(args: {
    destination: DestinationRecord;
    startNodeId: string;
    endNodeId: string;
    strategy: RouteStrategy;
    mode: TravelMode;
  }): PathResult {
    const graph = buildDestinationGraph(args.destination);
    const result = findShortestPath(graph, args.startNodeId, args.endNodeId, {
      allowedModes: createRecommendedModes(args.mode),
      defaultSpeedByMode: MODE_SPEEDS,
      mode: args.mode === "mixed" ? undefined : args.mode,
      strategy: createRoutingStrategy(args.strategy),
    });

    return toPathResult(args.strategy, result);
  },

  closedWalk(args: {
    destination: DestinationRecord;
    startNodeId: string;
    targetNodeIds: string[];
    strategy: RouteStrategy;
    mode: TravelMode;
  }): PathResult {
    const uniqueTargets = Array.from(new Set(args.targetNodeIds)).filter((target) => target !== args.startNodeId);
    if (uniqueTargets.length === 0) {
      return {
        reachable: true,
        nodeIds: [args.startNodeId],
        steps: [],
        strategy: args.strategy,
        totalCost: 0,
        totalDistance: 0,
      };
    }

    const graph = buildDestinationGraph(args.destination);
    const result = planClosedLoopRoute(graph, args.startNodeId, uniqueTargets, {
      allowedModes: createRecommendedModes(args.mode),
      deduplicateStops: true,
      defaultSpeedByMode: MODE_SPEEDS,
      mode: args.mode === "mixed" ? undefined : args.mode,
      strategy: createRoutingStrategy(args.strategy),
    });

    if (!result.reachable) {
      return createUnreachablePath(args.strategy);
    }

    const steps: RouteStep[] = [];
    result.legs.forEach((leg) => {
      leg.path.steps.forEach((step) => steps.push(toRouteStep(step)));
    });

    return {
      reachable: true,
      nodeIds: [...result.path],
      steps,
      strategy: args.strategy,
      totalCost: roundMetric(result.totalCost),
      totalDistance: roundMetric(result.totalDistance),
    };
  },
};
