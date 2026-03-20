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

export interface Building {
  id: string;
  destinationId: string;
  name: string;
  category: string;
  entranceNodeId: string;
  floors: number;
  tags: string[];
}

export interface Facility {
  id: string;
  destinationId: string;
  nodeId: string;
  name: string;
  category: FacilityCategory;
  openHours: string;
}

export interface FoodVenue {
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

export interface Destination {
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
  buildings: Building[];
  facilities: Facility[];
  foods: FoodVenue[];
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

export interface WorldRegionRecord {
  id: string;
  name: string;
  polygon: Array<[number, number]>;
  tags: string[];
}

export interface WorldDestinationPlacement extends Coordinates {
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
  distance: number;
  roadType: WorldRoadType;
  allowedModes: TravelMode[];
  congestion: number;
  bidirectional: boolean;
}

export interface WorldGraphRecord {
  nodes: WorldNodeRecord[];
  edges: WorldEdgeRecord[];
}

export interface DestinationPortalRecord {
  id: string;
  destinationId: string;
  worldNodeId: string;
  localNodeId: string;
  portalType: string;
  label: string;
  priority: number;
  allowedModes: TravelMode[];
  direction: string;
  transferDistance: number;
  transferCost: number;
}

export interface WorldMapRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundImage: string;
  regions: WorldRegionRecord[];
  destinations: WorldDestinationPlacement[];
  graph: WorldGraphRecord;
  portals: DestinationPortalRecord[];
}

export interface UserProfile {
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

export interface JournalEntry {
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

export interface FacilityCategoryDefinition {
  id: FacilityCategory;
  label: string;
  summary: string;
  keywords: string[];
}

export interface SeedData {
  version: string;
  generatedAt: string;
  facilityCategories: FacilityCategoryDefinition[];
  destinations: Destination[];
  users: UserProfile[];
  journals: JournalEntry[];
  world?: WorldMapRecord;
}

export interface SeedLookups {
  destinationById: Map<string, Destination>;
  userById: Map<string, UserProfile>;
  facilityCategoryById: Map<FacilityCategory, FacilityCategoryDefinition>;
  world?: WorldMapRecord;
}

export type DestinationRecord = Destination;
export type BuildingRecord = Building;
export type FacilityRecord = Facility;
export type FoodRecord = FoodVenue;
export type UserRecord = UserProfile;
export type JournalRecord = JournalEntry;
export type WorldRecord = WorldMapRecord;
