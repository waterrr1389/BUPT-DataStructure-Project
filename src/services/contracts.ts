export type DestinationType = "scenic" | "campus";

export type TravelMode = "walk" | "bike" | "shuttle" | "mixed";

export type RouteStrategy = "distance" | "time" | "mixed";

export type FacilityCategory =
  | "restroom"
  | "clinic"
  | "store"
  | "charging"
  | "info"
  | "parking"
  | "water"
  | "atm"
  | "security"
  | "lounge";

export interface Coordinates {
  x: number;
  y: number;
}

export interface DestinationNode extends Coordinates {
  id: string;
  name: string;
  kind: "gate" | "plaza" | "scenic" | "building" | "junction" | "room" | "elevator";
  floor: number;
  buildingId?: string;
  keywords: string[];
}

export interface DestinationEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  congestion: number;
  roadType: "walkway" | "bike-lane" | "shuttle-lane" | "indoor";
  allowedModes: TravelMode[];
}

export interface BuildingRecord {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  entranceNodeId: string;
  floors: number;
  tags: string[];
}

export interface FacilityRecord {
  id: string;
  destinationId: string;
  nodeId: string;
  name: string;
  category: FacilityCategory;
  openHours: string;
}

export interface FoodRecord {
  id: string;
  destinationId: string;
  nodeId: string;
  name: string;
  venue: string;
  cuisine: string;
  rating: number;
  heat: number;
  avgPrice: number;
  keywords: string[];
}

export interface DestinationRecord {
  id: string;
  name: string;
  type: DestinationType;
  region: string;
  description: string;
  categories: string[];
  keywords: string[];
  heat: number;
  rating: number;
  featured: boolean;
  graph: {
    nodes: DestinationNode[];
    edges: DestinationEdge[];
  };
  buildings: BuildingRecord[];
  facilities: FacilityRecord[];
  foods: FoodRecord[];
}

export interface UserRecord {
  id: string;
  name: string;
  interests: string[];
  dietaryPreferences: string[];
  homeDestinationId: string;
}

export interface JournalMedia {
  type: "image" | "video";
  title: string;
  source: string;
  note?: string;
}

export interface JournalRating {
  userId: string;
  score: number;
}

export interface JournalRecord {
  id: string;
  userId: string;
  destinationId: string;
  title: string;
  body: string;
  tags: string[];
  media: JournalMedia[];
  createdAt: string;
  updatedAt: string;
  views: number;
  ratings: JournalRating[];
  recommendedFor: string[];
}

export interface SeedDataContract {
  destinations: DestinationRecord[];
  users: UserRecord[];
  journals: JournalRecord[];
}

export interface SeedLookupsContract {
  destinationById?: Map<string, DestinationRecord>;
  userById?: Map<string, UserRecord>;
}

export interface RouteStep {
  edgeId: string;
  from: string;
  to: string;
  mode: TravelMode;
  distance: number;
  cost: number;
}

export interface PathResult {
  reachable: boolean;
  nodeIds: string[];
  steps: RouteStep[];
  totalDistance: number;
  totalCost: number;
  strategy: RouteStrategy;
}

export interface RecommendationHelpers {
  topK<T>(items: T[], limit: number, score: (item: T) => number): T[];
}

export interface SearchHelpers {
  rankText<T>(
    items: T[],
    query: string,
    value: (item: T) => string[],
    limit: number,
  ): Array<{ item: T; score: number; matches: string[] }>;
  exactTitle<T>(items: T[], title: string, value: (item: T) => string): T | null;
  buildInvertedIndex<T>(items: T[], text: (item: T) => string): Map<string, Set<string>>;
}

export interface RoutingHelpers {
  shortestPath(args: {
    destination: DestinationRecord;
    startNodeId: string;
    endNodeId: string;
    strategy: RouteStrategy;
    mode: TravelMode;
  }): PathResult;
  closedWalk(args: {
    destination: DestinationRecord;
    startNodeId: string;
    targetNodeIds: string[];
    strategy: RouteStrategy;
    mode: TravelMode;
  }): PathResult;
}

export interface AlgorithmBundle {
  recommendation?: Partial<RecommendationHelpers>;
  search?: Partial<SearchHelpers>;
  routing?: Partial<RoutingHelpers>;
}

export interface ResolvedAlgorithmBundle {
  recommendation: RecommendationHelpers;
  search: SearchHelpers;
  routing: RoutingHelpers;
}

export interface ValidationBundle {
  validateSeedData?: (data: SeedDataContract) => { ok: boolean; issues: string[] };
  assertValidSeedData?: (data: SeedDataContract) => void;
}

export interface ResolvedValidationBundle {
  validateSeedData: (data: SeedDataContract) => { ok: boolean; issues: string[] };
  assertValidSeedData: (data: SeedDataContract) => void;
}

export interface ServiceContextOptions {
  runtimeDir?: string;
}

export const DESTINATION_SORT_BY_VALUES = ["heat", "rating", "match"] as const;

export type DestinationSortBy = (typeof DESTINATION_SORT_BY_VALUES)[number];

export function parseDestinationSortBy(value: string | null | undefined): DestinationSortBy | undefined {
  const candidate = value?.trim();
  if (!candidate) {
    return undefined;
  }

  if ((DESTINATION_SORT_BY_VALUES as readonly string[]).includes(candidate)) {
    return candidate as DestinationSortBy;
  }

  throw new Error(`Invalid sortBy value: ${candidate}. Expected one of ${DESTINATION_SORT_BY_VALUES.join(", ")}.`);
}

export interface DestinationQuery {
  query?: string;
  category?: string;
  sortBy?: DestinationSortBy;
  limit?: number;
  userId?: string;
}

export interface RoutePlanInput {
  destinationId: string;
  startNodeId: string;
  endNodeId?: string;
  waypointNodeIds?: string[];
  strategy?: RouteStrategy;
  mode?: TravelMode;
}

export interface NearbyFacilitiesInput {
  destinationId: string;
  fromNodeId: string;
  category?: FacilityCategory | "all";
  radius?: number;
  limit?: number;
  mode?: TravelMode;
}

export interface JournalCreateInput {
  userId: string;
  destinationId: string;
  title: string;
  body: string;
  tags?: string[];
  media?: JournalMedia[];
  recommendedFor?: string[];
}

export interface JournalUpdateInput {
  title?: string;
  body?: string;
  tags?: string[];
  media?: JournalMedia[];
  recommendedFor?: string[];
}

export interface JournalSearchResult {
  journal: JournalRecord;
  score: number;
  matches: string[];
}

export interface StoryboardFrame {
  id: string;
  caption: string;
  art: string;
  durationMs: number;
}

export interface StoryboardResult {
  title: string;
  frames: StoryboardFrame[];
}
