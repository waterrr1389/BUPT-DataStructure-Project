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

export type WorldNodeKind = "portal" | "junction" | "hub" | "region-center";

export type WorldRoadType =
  | "road"
  | "rail"
  | "trail"
  | "ferry"
  | "tunnel"
  | "airlift"
  | "bridge";

export type WorldDistanceMeters = number;

export type WorldCostUnits = number;

export type WorldCongestionRatio = number;

export const WORLD_ROUTE_UNITS = {
  distance: "meters",
  cost: "cost-units",
  congestion: "ratio",
} as const;

export const WORLD_ROUTE_LIMITS = {
  distance: { min: 0, max: 1_000_000 },
  cost: { min: 0, max: 2_000_000 },
  transferDistance: { min: 0, max: 10_000 },
  transferCost: { min: 0, max: 100_000 },
  congestion: { min: 0, max: 1 },
  congestionCostMultiplier: { min: 1, max: 2 },
} as const;

export const WORLD_CONGESTION_COST_FORMULA = "distance * (1 + congestion)" as const;

export interface WorldRegionRecord {
  id: string;
  name: string;
  polygon: Array<[number, number]>;
  tags: string[];
}

export interface WorldDestinationPlacementRecord extends Coordinates {
  destinationId: string;
  label: string;
  radius: number;
  regionId: string;
  portalIds: string[];
  iconType: string;
}

export interface WorldNodeRecord extends Coordinates {
  id: string;
  kind: WorldNodeKind;
  label: string;
  tags: string[];
  destinationId?: string;
}

export interface WorldEdgeRecord {
  id: string;
  from: string;
  to: string;
  distance: WorldDistanceMeters;
  roadType: WorldRoadType;
  allowedModes: TravelMode[];
  congestion: WorldCongestionRatio;
  bidirectional: boolean;
}

export interface WorldGraphRecord {
  nodes: WorldNodeRecord[];
  edges: WorldEdgeRecord[];
}

export type DestinationPortalDirection = "inbound" | "outbound" | "bidirectional";

export interface DestinationPortalRecord {
  id: string;
  destinationId: string;
  worldNodeId: string;
  localNodeId: string;
  portalType: string;
  label: string;
  priority: number;
  allowedModes: TravelMode[];
  direction: DestinationPortalDirection;
  transferDistance: WorldDistanceMeters;
  transferCost: WorldCostUnits;
}

export interface WorldMapRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundImage: string;
  regions: WorldRegionRecord[];
  destinations: WorldDestinationPlacementRecord[];
  graph: WorldGraphRecord;
  portals: DestinationPortalRecord[];
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

export interface JournalCommentRecord {
  id: string;
  journalId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLikeRecord {
  journalId: string;
  userId: string;
  createdAt: string;
}

export interface JournalFeedItem {
  id: string;
  userId: string;
  userLabel: string;
  destinationId: string;
  destinationLabel: string;
  title: string;
  summaryBody: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  views: number;
  averageRating: number;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  mediaCount: number;
}

export interface JournalDetailRecord extends JournalRecord {
  averageRating: number;
  summaryBody: string;
  destinationLabel: string;
  userLabel: string;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
}

export interface JournalCommentView {
  id: string;
  journalId: string;
  userId: string;
  userLabel: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

export interface SeedDataContract {
  destinations: DestinationRecord[];
  users: UserRecord[];
  journals: JournalRecord[];
  world?: WorldMapRecord;
}

export interface SeedLookupsContract {
  destinationById?: Map<string, DestinationRecord>;
  userById?: Map<string, UserRecord>;
}

export interface WorldCapabilityRecord {
  worldView: boolean;
  destinationRouting: boolean;
  crossMapRouting: boolean;
}

export interface WorldSummaryRecord {
  enabled: boolean;
  world?: Pick<WorldMapRecord, "id" | "name" | "width" | "height" | "backgroundImage">;
  regions: Array<Pick<WorldRegionRecord, "id" | "name">>;
  destinations: Array<
    Pick<WorldDestinationPlacementRecord, "destinationId" | "label" | "x" | "y" | "iconType" | "regionId">
  >;
  capabilities: WorldCapabilityRecord;
}

export interface WorldDetailsRecord {
  world: WorldMapRecord;
}

export interface WorldUnavailableRecord {
  error: string;
  code: "world_unavailable";
}

export type WorldRouteScope = "world-only" | "cross-map";

export type WorldRouteLegScope = "destination" | "world";

export type WorldRouteFailureStage =
  | "origin-destination"
  | "origin-portal"
  | "world"
  | "destination-portal"
  | "destination-local";

export type WorldRouteFailureReason =
  | "unreachable"
  | "mode_not_allowed"
  | "direction_not_allowed"
  | "world_disconnected"
  | "portal_misconfigured";

export type WorldRouteFailureCode =
  | "origin_local_unreachable"
  | "origin_portal_unavailable"
  | "world_segment_unreachable"
  | "destination_portal_unavailable"
  | "destination_local_unreachable";

export type WorldPortalTransferDirection = "local-to-world" | "world-to-local";

export interface WorldRouteLocalStep {
  kind: "local-edge";
  destinationId: string;
  edgeId: string;
  fromLocalNodeId: string;
  toLocalNodeId: string;
  mode: TravelMode;
  distance: WorldDistanceMeters;
  cost: WorldCostUnits;
}

export interface WorldRouteWorldEdgeStep {
  kind: "world-edge";
  edgeId: string;
  fromWorldNodeId: string;
  toWorldNodeId: string;
  roadType: WorldRoadType;
  mode: TravelMode;
  distance: WorldDistanceMeters;
  congestion: WorldCongestionRatio;
  cost: WorldCostUnits;
}

interface WorldRoutePortalTransferStepBase {
  kind: "portal-transfer";
  portalId: string;
  destinationId: string;
  localNodeId: string;
  worldNodeId: string;
  mode: TravelMode;
  transferDistance: WorldDistanceMeters;
  transferCost: WorldCostUnits;
  distance: WorldDistanceMeters;
  cost: WorldCostUnits;
}

export interface WorldRoutePortalEntryTransferStep extends WorldRoutePortalTransferStepBase {
  transferDirection: "local-to-world";
}

export interface WorldRoutePortalExitTransferStep extends WorldRoutePortalTransferStepBase {
  transferDirection: "world-to-local";
}

export type WorldRoutePortalTransferStep = WorldRoutePortalEntryTransferStep | WorldRoutePortalExitTransferStep;

export type WorldRouteStep = WorldRouteLocalStep | WorldRouteWorldEdgeStep | WorldRoutePortalTransferStep;

export type WorldRouteWorldStep = WorldRouteWorldEdgeStep | WorldRoutePortalTransferStep;

export interface WorldDestinationRouteLeg {
  scope: "destination";
  destinationId: string;
  localNodeIds: string[];
  distance: WorldDistanceMeters;
  cost: WorldCostUnits;
  steps: WorldRouteLocalStep[];
}

export interface WorldOnlyRouteWorldLeg {
  scope: "world";
  worldNodeIds: string[];
  distance: WorldDistanceMeters;
  cost: WorldCostUnits;
  steps: WorldRouteWorldEdgeStep[];
}

export interface CrossMapRouteWorldLeg {
  scope: "world";
  worldNodeIds: string[];
  distance: WorldDistanceMeters;
  cost: WorldCostUnits;
  entryPortalId: string;
  exitPortalId: string;
  steps: [WorldRoutePortalEntryTransferStep, ...WorldRouteWorldEdgeStep[], WorldRoutePortalExitTransferStep];
}

export type WorldRouteWorldLeg = WorldOnlyRouteWorldLeg | CrossMapRouteWorldLeg;

export type WorldRouteLeg = WorldDestinationRouteLeg | WorldRouteWorldLeg;

export type CrossMapRouteSuccessLegs = [WorldDestinationRouteLeg, CrossMapRouteWorldLeg, WorldDestinationRouteLeg];

export type CrossMapRouteFailureLegs =
  | []
  | [WorldDestinationRouteLeg]
  | [WorldDestinationRouteLeg, CrossMapRouteWorldLeg]
  | CrossMapRouteSuccessLegs;

export interface WorldRouteFailure {
  stage: WorldRouteFailureStage;
  reason: WorldRouteFailureReason;
  code: WorldRouteFailureCode;
  blockedFrom?: string;
  blockedTo?: string;
}

export interface WorldRouteSummary {
  destinationDistance: WorldDistanceMeters;
  worldDistance: WorldDistanceMeters;
  transferDistance: WorldDistanceMeters;
  destinationCost: WorldCostUnits;
  worldCost: WorldCostUnits;
  transferCost: WorldCostUnits;
}

export const WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER = [
  "entry-priority-desc",
  "exit-priority-desc",
  "local-leg-cost-asc",
  "transfer-cost-asc",
  "entry-id-asc",
  "exit-id-asc",
] as const;

export type WorldRoutePortalSelectionTieBreak = (typeof WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER)[number];

export interface WorldRoutePortalSelection {
  ruleVersion: "v1";
  candidatePairCount: number;
  entryPortalId: string;
  exitPortalId: string;
  tieBreakOrder: WorldRoutePortalSelectionTieBreak[];
}

export interface WorldOnlyRouteItinerary {
  reachable: boolean;
  scope: "world-only";
  strategy: RouteStrategy;
  mode: TravelMode;
  legs: [WorldOnlyRouteWorldLeg];
  summary: WorldRouteSummary;
  totalDistance: WorldDistanceMeters;
  totalCost: WorldCostUnits;
  usedModes: TravelMode[];
  failure?: WorldRouteFailure;
}

interface CrossMapRouteItineraryBase {
  scope: "cross-map";
  strategy: RouteStrategy;
  mode: TravelMode;
  summary: WorldRouteSummary;
  totalDistance: WorldDistanceMeters;
  totalCost: WorldCostUnits;
  usedModes: TravelMode[];
  portalSelection: WorldRoutePortalSelection;
}

export interface CrossMapRouteReachableItinerary extends CrossMapRouteItineraryBase {
  reachable: true;
  legs: CrossMapRouteSuccessLegs;
  failure?: never;
}

export interface CrossMapRouteUnreachableItinerary extends CrossMapRouteItineraryBase {
  reachable: false;
  legs: CrossMapRouteFailureLegs;
  failure: WorldRouteFailure;
}

export type CrossMapRouteItinerary = CrossMapRouteReachableItinerary | CrossMapRouteUnreachableItinerary;

export type WorldRouteItinerary = WorldOnlyRouteItinerary | CrossMapRouteItinerary;

export interface WorldOnlyRoutePlanRequest {
  scope: "world-only";
  fromWorldNodeId: string;
  toWorldNodeId: string;
  strategy: RouteStrategy;
  mode: TravelMode;
}

export interface CrossMapRoutePlanRequest {
  scope: "cross-map";
  fromDestinationId: string;
  toDestinationId: string;
  fromLocalNodeId?: string;
  toLocalNodeId?: string;
  strategy: RouteStrategy;
  mode: TravelMode;
}

export type WorldRoutePlanRequest = WorldOnlyRoutePlanRequest | CrossMapRoutePlanRequest;

export interface WorldRoutePlanResponse {
  item: WorldRouteItinerary;
}

export interface WorldRoutePlanInvalidRequestRecord {
  error: string;
  code: "world_route_invalid_request";
  issues: string[];
}

export interface WorldRoutePlanDestinationNotFoundRecord {
  error: string;
  code: "world_route_destination_not_found";
  destinationId: string;
}

export interface WorldRoutePlanLocalNodeNotFoundRecord {
  error: string;
  code: "world_route_local_node_not_found";
  destinationId: string;
  localNodeId: string;
}

export interface WorldRoutePlanModeNotAllowedRecord {
  error: string;
  code: "world_route_mode_not_allowed";
  mode: TravelMode;
  allowedModes: TravelMode[];
}

export interface WorldRoutePlanPortalMisconfiguredRecord {
  error: string;
  code: "world_route_portal_misconfigured";
  portalId: string;
}

export type WorldRoutePlanErrorRecord =
  | WorldUnavailableRecord
  | WorldRoutePlanInvalidRequestRecord
  | WorldRoutePlanDestinationNotFoundRecord
  | WorldRoutePlanLocalNodeNotFoundRecord
  | WorldRoutePlanModeNotAllowedRecord
  | WorldRoutePlanPortalMisconfiguredRecord;

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

export interface JournalFeedQuery {
  destinationId?: string;
  userId?: string;
  viewerUserId?: string;
  cursor?: string;
  limit?: number;
}

export interface JournalCommentListQuery {
  journalId: string;
  cursor?: string;
  limit?: number;
}

export interface JournalCommentCreateInput {
  userId: string;
  body: string;
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
