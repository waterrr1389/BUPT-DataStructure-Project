import type {
  BuildingRecord,
  DestinationEdge,
  DestinationNode,
  DestinationRecord,
  DestinationType,
  FacilityCategory,
  FacilityRecord,
  FoodRecord,
  JournalRecord,
  SeedDataContract,
  SeedLookupsContract,
  TravelMode,
  UserRecord,
} from "./contracts";

const FACILITY_ROTATION: FacilityCategory[] = [
  "restroom",
  "clinic",
  "store",
  "charging",
  "info",
  "parking",
  "water",
  "atm",
  "security",
  "lounge",
];

const CUISINES = [
  "river grill",
  "spice street",
  "tea house",
  "noodle lab",
  "sea bowl",
  "bento craft",
  "forest roast",
  "campus comfort",
];

const DESTINATION_TAGS = [
  ["history", "museum", "family"],
  ["nature", "waterfront", "photography"],
  ["art", "nightscape", "design"],
  ["research", "learning", "architecture"],
  ["food", "market", "social"],
  ["wellness", "forest", "walking"],
];

const REGIONS = [
  "north belt",
  "river arc",
  "harbor line",
  "west ridge",
  "east loop",
  "central axis",
];

const SCENIC_ADJECTIVES = [
  "Amber",
  "Juniper",
  "Harbor",
  "Misty",
  "Velvet",
  "Lantern",
  "Silver",
  "Granite",
  "Maple",
  "Cedar",
];

const SCENIC_NOUNS = [
  "Bay",
  "Garden",
  "Terrace",
  "Reserve",
  "Promenade",
  "Cliff",
  "Harbor",
  "Museum Park",
  "Lookout",
  "Valley",
];

const CAMPUS_PREFIXES = [
  "North",
  "River",
  "Central",
  "Summit",
  "Harbor",
  "Pioneer",
  "Civic",
  "Lotus",
  "Atlas",
  "Vertex",
];

const CAMPUS_SUFFIXES = [
  "Institute",
  "Campus",
  "Polytechnic",
  "College",
  "Academy",
  "Research Park",
  "Learning Hub",
  "University Center",
];

type NodeKey =
  | "gate"
  | "plaza"
  | "gallery"
  | "garden"
  | "lake"
  | "market"
  | "hub"
  | "hall-entry"
  | "deck"
  | "hall-l1"
  | "elevator-l1"
  | "elevator-l2"
  | "archive"
  | "studio";

type Point = { x: number; y: number };

interface GraphEdgeSpec {
  from: NodeKey;
  to: NodeKey;
  congestion: number;
  link: "walkway" | "mobile" | "indoor";
}

interface GraphVariant {
  id: string;
  coordinates: Record<NodeKey, Point>;
  edges: GraphEdgeSpec[];
}

function createCoordinates(
  surface: Record<Exclude<NodeKey, "hall-l1" | "elevator-l1" | "elevator-l2" | "archive" | "studio">, Point>,
  indoor: {
    hallL1: Point;
    elevatorL1: Point;
    elevatorL2: Point;
    archive: Point;
    studio: Point;
  },
): Record<NodeKey, Point> {
  return {
    ...surface,
    "hall-l1": indoor.hallL1,
    "elevator-l1": indoor.elevatorL1,
    "elevator-l2": indoor.elevatorL2,
    archive: indoor.archive,
    studio: indoor.studio,
  };
}

const SCENIC_GRAPH_VARIANTS: GraphVariant[] = [
  {
    id: "scenic-harbor-loop",
    coordinates: createCoordinates(
      {
        gate: { x: 0, y: 0 },
        plaza: { x: 1.15, y: -0.05 },
        gallery: { x: 2.35, y: 0.25 },
        garden: { x: -0.2, y: 1.15 },
        lake: { x: 1.05, y: 1.25 },
        market: { x: 2.45, y: 1.35 },
        hub: { x: 0.15, y: 2.35 },
        "hall-entry": { x: 1.3, y: 2.5 },
        deck: { x: 2.65, y: 2.55 },
      },
      {
        hallL1: { x: 1.3, y: 2.82 },
        elevatorL1: { x: 1.62, y: 2.82 },
        elevatorL2: { x: 1.62, y: 3.68 },
        archive: { x: 1.02, y: 3.68 },
        studio: { x: 2.02, y: 3.68 },
      },
    ),
    edges: [
      { from: "gate", to: "plaza", congestion: 0.2, link: "walkway" },
      { from: "plaza", to: "gallery", congestion: 0.22, link: "walkway" },
      { from: "gate", to: "garden", congestion: 0.18, link: "walkway" },
      { from: "plaza", to: "lake", congestion: 0.34, link: "walkway" },
      { from: "gallery", to: "market", congestion: 0.28, link: "walkway" },
      { from: "garden", to: "lake", congestion: 0.24, link: "walkway" },
      { from: "lake", to: "market", congestion: 0.32, link: "walkway" },
      { from: "garden", to: "hub", congestion: 0.21, link: "walkway" },
      { from: "lake", to: "hall-entry", congestion: 0.36, link: "walkway" },
      { from: "market", to: "deck", congestion: 0.27, link: "walkway" },
      { from: "hub", to: "hall-entry", congestion: 0.17, link: "mobile" },
      { from: "hall-entry", to: "deck", congestion: 0.19, link: "mobile" },
      { from: "plaza", to: "garden", congestion: 0.29, link: "walkway" },
      { from: "plaza", to: "market", congestion: 0.35, link: "walkway" },
      { from: "hall-entry", to: "hall-l1", congestion: 0.12, link: "indoor" },
      { from: "hall-l1", to: "elevator-l1", congestion: 0.1, link: "indoor" },
      { from: "elevator-l1", to: "elevator-l2", congestion: 0.08, link: "indoor" },
      { from: "elevator-l2", to: "archive", congestion: 0.06, link: "indoor" },
      { from: "elevator-l2", to: "studio", congestion: 0.05, link: "indoor" },
    ],
  },
  {
    id: "scenic-ridge-spur",
    coordinates: createCoordinates(
      {
        gate: { x: 0, y: 0 },
        plaza: { x: 0.95, y: 0.45 },
        gallery: { x: 2.2, y: 0.2 },
        garden: { x: 0.35, y: 1.45 },
        lake: { x: 1.55, y: 1.6 },
        market: { x: 2.9, y: 1.2 },
        hub: { x: 0.8, y: 2.7 },
        "hall-entry": { x: 2.05, y: 2.55 },
        deck: { x: 3.2, y: 2.1 },
      },
      {
        hallL1: { x: 2.05, y: 2.9 },
        elevatorL1: { x: 2.37, y: 2.9 },
        elevatorL2: { x: 2.37, y: 3.74 },
        archive: { x: 1.74, y: 3.74 },
        studio: { x: 2.78, y: 3.74 },
      },
    ),
    edges: [
      { from: "gate", to: "plaza", congestion: 0.19, link: "walkway" },
      { from: "plaza", to: "gallery", congestion: 0.24, link: "walkway" },
      { from: "gate", to: "garden", congestion: 0.16, link: "walkway" },
      { from: "garden", to: "lake", congestion: 0.23, link: "walkway" },
      { from: "lake", to: "market", congestion: 0.3, link: "walkway" },
      { from: "market", to: "deck", congestion: 0.26, link: "walkway" },
      { from: "garden", to: "hub", congestion: 0.2, link: "walkway" },
      { from: "hub", to: "hall-entry", congestion: 0.18, link: "mobile" },
      { from: "lake", to: "hall-entry", congestion: 0.34, link: "walkway" },
      { from: "hall-entry", to: "deck", congestion: 0.17, link: "mobile" },
      { from: "plaza", to: "lake", congestion: 0.27, link: "walkway" },
      { from: "gallery", to: "lake", congestion: 0.29, link: "walkway" },
      { from: "lake", to: "deck", congestion: 0.31, link: "walkway" },
      { from: "hall-entry", to: "hall-l1", congestion: 0.11, link: "indoor" },
      { from: "hall-l1", to: "elevator-l1", congestion: 0.1, link: "indoor" },
      { from: "elevator-l1", to: "elevator-l2", congestion: 0.08, link: "indoor" },
      { from: "elevator-l2", to: "archive", congestion: 0.06, link: "indoor" },
      { from: "elevator-l2", to: "studio", congestion: 0.05, link: "indoor" },
    ],
  },
];

const CAMPUS_GRAPH_VARIANTS: GraphVariant[] = [
  {
    id: "campus-axis-loop",
    coordinates: createCoordinates(
      {
        gate: { x: 0, y: 0 },
        plaza: { x: 1.05, y: 0.05 },
        gallery: { x: 2.3, y: 0.1 },
        garden: { x: 0, y: 1 },
        lake: { x: 1.15, y: 1.05 },
        market: { x: 2.45, y: 1.15 },
        hub: { x: 0, y: 2 },
        "hall-entry": { x: 1, y: 2 },
        deck: { x: 2.55, y: 2.2 },
      },
      {
        hallL1: { x: 1, y: 2.32 },
        elevatorL1: { x: 1.32, y: 2.32 },
        elevatorL2: { x: 1.32, y: 3.16 },
        archive: { x: 0.98, y: 3.16 },
        studio: { x: 1.98, y: 3.16 },
      },
    ),
    edges: [
      { from: "gate", to: "plaza", congestion: 0.2, link: "walkway" },
      { from: "plaza", to: "gallery", congestion: 0.2, link: "walkway" },
      { from: "gate", to: "garden", congestion: 0.17, link: "walkway" },
      { from: "plaza", to: "lake", congestion: 0.3, link: "walkway" },
      { from: "gallery", to: "market", congestion: 0.25, link: "walkway" },
      { from: "garden", to: "lake", congestion: 0.22, link: "walkway" },
      { from: "lake", to: "market", congestion: 0.3, link: "walkway" },
      { from: "garden", to: "hub", congestion: 0.19, link: "walkway" },
      { from: "lake", to: "hall-entry", congestion: 0.33, link: "walkway" },
      { from: "market", to: "deck", congestion: 0.24, link: "walkway" },
      { from: "hub", to: "hall-entry", congestion: 0.14, link: "mobile" },
      { from: "hall-entry", to: "deck", congestion: 0.16, link: "mobile" },
      { from: "plaza", to: "garden", congestion: 0.27, link: "walkway" },
      { from: "plaza", to: "market", congestion: 0.31, link: "walkway" },
      { from: "hall-entry", to: "hall-l1", congestion: 0.11, link: "indoor" },
      { from: "hall-l1", to: "elevator-l1", congestion: 0.1, link: "indoor" },
      { from: "elevator-l1", to: "elevator-l2", congestion: 0.08, link: "indoor" },
      { from: "elevator-l2", to: "archive", congestion: 0.06, link: "indoor" },
      { from: "elevator-l2", to: "studio", congestion: 0.05, link: "indoor" },
    ],
  },
  {
    id: "campus-quad-cross",
    coordinates: createCoordinates(
      {
        gate: { x: 0, y: 0 },
        plaza: { x: 0.85, y: 0.6 },
        gallery: { x: 2.1, y: 0.5 },
        garden: { x: -0.1, y: 1.55 },
        lake: { x: 1.2, y: 1.85 },
        market: { x: 2.55, y: 1.65 },
        hub: { x: 0.35, y: 2.85 },
        "hall-entry": { x: 1.7, y: 3 },
        deck: { x: 3.05, y: 2.75 },
      },
      {
        hallL1: { x: 1.7, y: 3.34 },
        elevatorL1: { x: 2.02, y: 3.34 },
        elevatorL2: { x: 2.02, y: 4.18 },
        archive: { x: 1.38, y: 4.18 },
        studio: { x: 2.42, y: 4.18 },
      },
    ),
    edges: [
      { from: "gate", to: "plaza", congestion: 0.18, link: "walkway" },
      { from: "gate", to: "garden", congestion: 0.16, link: "walkway" },
      { from: "plaza", to: "gallery", congestion: 0.22, link: "walkway" },
      { from: "plaza", to: "lake", congestion: 0.28, link: "walkway" },
      { from: "gallery", to: "market", congestion: 0.24, link: "walkway" },
      { from: "garden", to: "hub", congestion: 0.2, link: "walkway" },
      { from: "hub", to: "hall-entry", congestion: 0.15, link: "mobile" },
      { from: "lake", to: "hall-entry", congestion: 0.31, link: "walkway" },
      { from: "market", to: "deck", congestion: 0.23, link: "walkway" },
      { from: "hall-entry", to: "deck", congestion: 0.16, link: "mobile" },
      { from: "lake", to: "market", congestion: 0.27, link: "walkway" },
      { from: "hub", to: "lake", congestion: 0.22, link: "walkway" },
      { from: "gallery", to: "deck", congestion: 0.29, link: "walkway" },
      { from: "hall-entry", to: "hall-l1", congestion: 0.11, link: "indoor" },
      { from: "hall-l1", to: "elevator-l1", congestion: 0.1, link: "indoor" },
      { from: "elevator-l1", to: "elevator-l2", congestion: 0.08, link: "indoor" },
      { from: "elevator-l2", to: "archive", congestion: 0.06, link: "indoor" },
      { from: "elevator-l2", to: "studio", congestion: 0.05, link: "indoor" },
    ],
  },
];

function pad(value: number): string {
  return value.toString().padStart(3, "0");
}

function ratingFor(index: number): number {
  return Number((3.8 + ((index * 5) % 12) / 10).toFixed(1));
}

function heatFor(index: number): number {
  return 58 + ((index * 7) % 41);
}

function createDestinationName(index: number, type: DestinationType): string {
  if (type === "scenic") {
    const adjective = SCENIC_ADJECTIVES[index % SCENIC_ADJECTIVES.length];
    const noun = SCENIC_NOUNS[(index * 3) % SCENIC_NOUNS.length];
    return `${adjective} ${noun}`;
  }
  const prefix = CAMPUS_PREFIXES[index % CAMPUS_PREFIXES.length];
  const suffix = CAMPUS_SUFFIXES[(index * 2) % CAMPUS_SUFFIXES.length];
  return `${prefix} ${suffix}`;
}

function selectGraphVariant(index: number, type: DestinationType): GraphVariant {
  const variants = type === "scenic" ? SCENIC_GRAPH_VARIANTS : CAMPUS_GRAPH_VARIANTS;
  return variants[Math.floor(index / 2) % variants.length];
}

function createNodes(destinationId: string, type: DestinationType, variant: GraphVariant): DestinationNode[] {
  const baseBuildingId = `${destinationId}-building-hall`;
  return [
    {
      id: `${destinationId}-gate`,
      name: "Main Gate",
      kind: "gate",
      floor: 0,
      x: variant.coordinates.gate.x,
      y: variant.coordinates.gate.y,
      keywords: ["entry", "arrival", "gate"],
    },
    {
      id: `${destinationId}-plaza`,
      name: type === "scenic" ? "Sun Plaza" : "Civic Plaza",
      kind: "plaza",
      floor: 0,
      x: variant.coordinates.plaza.x,
      y: variant.coordinates.plaza.y,
      keywords: ["plaza", "meeting", "landmark"],
    },
    {
      id: `${destinationId}-gallery`,
      name: type === "scenic" ? "Gallery Row" : "Library Court",
      kind: "building",
      floor: 0,
      x: variant.coordinates.gallery.x,
      y: variant.coordinates.gallery.y,
      buildingId: `${destinationId}-building-gallery`,
      keywords: ["gallery", "library", "culture"],
    },
    {
      id: `${destinationId}-garden`,
      name: type === "scenic" ? "Garden Walk" : "Research Garden",
      kind: "scenic",
      floor: 0,
      x: variant.coordinates.garden.x,
      y: variant.coordinates.garden.y,
      keywords: ["garden", "rest", "green"],
    },
    {
      id: `${destinationId}-lake`,
      name: type === "scenic" ? "Mirror Lake" : "Innovation Court",
      kind: "scenic",
      floor: 0,
      x: variant.coordinates.lake.x,
      y: variant.coordinates.lake.y,
      keywords: ["lake", "center", "festival"],
    },
    {
      id: `${destinationId}-market`,
      name: type === "scenic" ? "Night Market" : "Food Street",
      kind: "plaza",
      floor: 0,
      x: variant.coordinates.market.x,
      y: variant.coordinates.market.y,
      keywords: ["food", "market", "music"],
    },
    {
      id: `${destinationId}-hub`,
      name: type === "scenic" ? "Transit Terrace" : "Mobility Hub",
      kind: "junction",
      floor: 0,
      x: variant.coordinates.hub.x,
      y: variant.coordinates.hub.y,
      keywords: ["transit", "hub", "connection"],
    },
    {
      id: `${destinationId}-hall-entry`,
      name: type === "scenic" ? "Sky Hall Entry" : "Innovation Center Entry",
      kind: "building",
      floor: 0,
      x: variant.coordinates["hall-entry"].x,
      y: variant.coordinates["hall-entry"].y,
      buildingId: baseBuildingId,
      keywords: ["hall", "entry", "indoor"],
    },
    {
      id: `${destinationId}-deck`,
      name: type === "scenic" ? "Lookout Deck" : "Studio Square",
      kind: "plaza",
      floor: 0,
      x: variant.coordinates.deck.x,
      y: variant.coordinates.deck.y,
      keywords: ["view", "gathering", "event"],
    },
    {
      id: `${destinationId}-hall-l1`,
      name: "Hall Lobby",
      kind: "room",
      floor: 1,
      x: variant.coordinates["hall-l1"].x,
      y: variant.coordinates["hall-l1"].y,
      buildingId: baseBuildingId,
      keywords: ["lobby", "indoor", "info"],
    },
    {
      id: `${destinationId}-elevator-l1`,
      name: "East Elevator L1",
      kind: "elevator",
      floor: 1,
      x: variant.coordinates["elevator-l1"].x,
      y: variant.coordinates["elevator-l1"].y,
      buildingId: baseBuildingId,
      keywords: ["elevator", "vertical", "access"],
    },
    {
      id: `${destinationId}-elevator-l2`,
      name: "East Elevator L2",
      kind: "elevator",
      floor: 2,
      x: variant.coordinates["elevator-l2"].x,
      y: variant.coordinates["elevator-l2"].y,
      buildingId: baseBuildingId,
      keywords: ["elevator", "vertical", "access"],
    },
    {
      id: `${destinationId}-archive`,
      name: type === "scenic" ? "Archive Room" : "Media Lab",
      kind: "room",
      floor: 2,
      x: variant.coordinates.archive.x,
      y: variant.coordinates.archive.y,
      buildingId: baseBuildingId,
      keywords: ["archive", "lab", "study"],
    },
    {
      id: `${destinationId}-studio`,
      name: type === "scenic" ? "Light Studio" : "Idea Studio",
      kind: "room",
      floor: 2,
      x: variant.coordinates.studio.x,
      y: variant.coordinates.studio.y,
      buildingId: baseBuildingId,
      keywords: ["studio", "creative", "demo"],
    },
  ];
}

function createEdge(
  destinationId: string,
  nodesById: Map<string, DestinationNode>,
  from: string,
  to: string,
  roadType: DestinationEdge["roadType"],
  allowedModes: DestinationEdge["allowedModes"],
  congestion: number,
): DestinationEdge {
  const fromNode = nodesById.get(`${destinationId}-${from}`)!;
  const toNode = nodesById.get(`${destinationId}-${to}`)!;
  const scale = roadType === "indoor" ? 90 : 240;
  const distance = Math.round(Math.hypot(fromNode.x - toNode.x, fromNode.y - toNode.y) * scale);
  return {
    id: `${destinationId}-edge-${from}-${to}`,
    from: fromNode.id,
    to: toNode.id,
    distance,
    congestion,
    roadType,
    allowedModes,
  };
}

function createEdges(
  destinationId: string,
  type: DestinationType,
  nodes: DestinationNode[],
  variant: GraphVariant,
): DestinationEdge[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const mobileModes: TravelMode[] = type === "campus" ? ["walk", "bike"] : ["walk", "shuttle"];
  return variant.edges.map((edge) =>
    createEdge(
      destinationId,
      nodesById,
      edge.from,
      edge.to,
      edge.link === "mobile" ? (type === "campus" ? "bike-lane" : "shuttle-lane") : edge.link,
      edge.link === "mobile" ? mobileModes : ["walk"],
      edge.congestion,
    ),
  );
}

function createBuildings(destinationId: string, type: DestinationType): BuildingRecord[] {
  return [
    {
      id: `${destinationId}-building-hall`,
      destinationId,
      name: type === "scenic" ? "Sky Hall" : "Innovation Center",
      category: type === "scenic" ? "exhibition" : "teaching",
      entranceNodeId: `${destinationId}-hall-entry`,
      floors: 2,
      tags: ["indoor", "showcase", "demo"],
    },
    {
      id: `${destinationId}-building-gallery`,
      destinationId,
      name: type === "scenic" ? "Harbor Gallery" : "North Library",
      category: type === "scenic" ? "museum" : "library",
      entranceNodeId: `${destinationId}-gallery`,
      floors: 1,
      tags: ["culture", "quiet", "landmark"],
    },
    {
      id: `${destinationId}-building-hub`,
      destinationId,
      name: type === "scenic" ? "Transit Pavilion" : "Studio Commons",
      category: type === "scenic" ? "service" : "student-center",
      entranceNodeId: `${destinationId}-hub`,
      floors: 1,
      tags: ["services", "support", "rest"],
    },
  ];
}

function createFacilities(destinationId: string, index: number): FacilityRecord[] {
  const slots = [
    `${destinationId}-gate`,
    `${destinationId}-garden`,
    `${destinationId}-market`,
    `${destinationId}-hub`,
    `${destinationId}-hall-l1`,
  ];
  return slots.map((nodeId, offset) => {
    const category = FACILITY_ROTATION[(index + offset) % FACILITY_ROTATION.length];
    return {
      id: `${destinationId}-facility-${offset + 1}`,
      destinationId,
      nodeId,
      name: `${category} station ${offset + 1}`,
      category,
      openHours: offset === 1 ? "24/7" : "08:00-22:00",
    };
  });
}

function createFoods(destinationId: string, index: number, type: DestinationType): FoodRecord[] {
  const nodes = [
    `${destinationId}-market`,
    `${destinationId}-lake`,
    `${destinationId}-deck`,
    `${destinationId}-plaza`,
  ];
  return nodes.map((nodeId, offset) => {
    const cuisine = CUISINES[(index + offset) % CUISINES.length];
    return {
      id: `${destinationId}-food-${offset + 1}`,
      destinationId,
      nodeId,
      name: `${cuisine} ${type === "scenic" ? "kitchen" : "counter"} ${offset + 1}`,
      venue: type === "scenic" ? "harbor court" : "student lane",
      cuisine,
      rating: Number((4 + ((index + offset) % 10) / 10).toFixed(1)),
      heat: 55 + ((index * 9 + offset * 7) % 43),
      avgPrice: 16 + ((index + offset) % 6) * 4,
      keywords: [cuisine, type, offset % 2 === 0 ? "quick bite" : "signature"],
    };
  });
}

function createDestination(index: number): DestinationRecord {
  const type: DestinationType = index % 2 === 0 ? "scenic" : "campus";
  const id = `dest-${pad(index + 1)}`;
  const name = createDestinationName(index, type);
  const variant = selectGraphVariant(index, type);
  const nodes = createNodes(id, type, variant);
  const tagSet = DESTINATION_TAGS[index % DESTINATION_TAGS.length];
  return {
    id,
    name,
    type,
    region: REGIONS[index % REGIONS.length],
    description:
      type === "scenic"
        ? `${name} blends outdoor walks, elevated views, and indoor exhibits for short tourism loops.`
        : `${name} mixes teaching spaces, indoor labs, and food streets for campus touring and navigation demos.`,
    categories: [...tagSet, type],
    keywords: [...tagSet, type, index % 3 === 0 ? "featured" : "flexible", index % 5 === 0 ? "family" : "solo"],
    heat: heatFor(index),
    rating: ratingFor(index),
    featured: index < 6,
    graph: {
      nodes,
      edges: createEdges(id, type, nodes, variant),
    },
    buildings: createBuildings(id, type),
    facilities: createFacilities(id, index),
    foods: createFoods(id, index, type),
  };
}

function createUsers(destinations: DestinationRecord[]): UserRecord[] {
  const names = [
    "Ari Chen",
    "Mina Zhou",
    "Leo Hart",
    "Tao Lin",
    "Nia Park",
    "Jules Reed",
    "Demi Sun",
    "Kai Brook",
    "Iris Moon",
    "Owen Vale",
    "Lina Moss",
    "Rory Pike",
  ];
  return names.map((name, index) => ({
    id: `user-${index + 1}`,
    name,
    interests: DESTINATION_TAGS[index % DESTINATION_TAGS.length],
    dietaryPreferences: index % 2 === 0 ? ["tea house", "quick bite"] : ["sea bowl", "signature"],
    homeDestinationId: destinations[index].id,
  }));
}

function createJournals(destinations: DestinationRecord[], users: UserRecord[]): JournalRecord[] {
  return users.slice(0, 12).map((user, index) => {
    const destination = destinations[index * 3];
    const createdAt = `2026-03-${String(5 + index).padStart(2, "0")}T0${index % 6}:30:00.000Z`;
    const body =
      `Started at ${destination.name} and moved from the gate to the central plaza before checking the indoor hall. ` +
      `The route balanced walking and quick service stops, and the local food counter turned into the strongest memory. ` +
      `I would recommend this loop for visitors who like ${user.interests.join(", ")} experiences.`;
    return {
      id: `journal-${index + 1}`,
      userId: user.id,
      destinationId: destination.id,
      title: `${destination.name} field note ${index + 1}`,
      body,
      tags: [...destination.categories.slice(0, 2), ...user.interests.slice(0, 2)],
      media: [
        {
          type: "image",
          title: "Cover frame",
          source: `generated://cover/${destination.id}`,
          note: "Synthetic preview asset",
        },
        {
          type: "video",
          title: "Route clip",
          source: `generated://clip/${destination.id}`,
        },
      ],
      createdAt,
      updatedAt: createdAt,
      views: 40 + index * 9,
      ratings: [
        { userId: users[(index + 1) % users.length].id, score: 4 + (index % 2) },
        { userId: users[(index + 2) % users.length].id, score: 4 },
      ],
      recommendedFor: [users[(index + 3) % users.length].id],
    };
  });
}

function buildLookups(data: SeedDataContract): SeedLookupsContract {
  return {
    destinationById: new Map(data.destinations.map((destination) => [destination.id, destination])),
    userById: new Map(data.users.map((user) => [user.id, user])),
  };
}

const destinations = Array.from({ length: 220 }, (_, index) => createDestination(index));
const users = createUsers(destinations);
const journals = createJournals(destinations, users);

export const fallbackSeedData: SeedDataContract = {
  destinations,
  users,
  journals,
};

export const fallbackLookups = buildLookups(fallbackSeedData);

export function summarizeSeedData(data: SeedDataContract): Record<string, number> {
  return {
    destinations: data.destinations.length,
    buildings: data.destinations.reduce((sum, destination) => sum + destination.buildings.length, 0),
    facilityTypes: new Set(
      data.destinations.flatMap((destination) => destination.facilities.map((facility) => facility.category)),
    ).size,
    facilities: data.destinations.reduce((sum, destination) => sum + destination.facilities.length, 0),
    edges: data.destinations.reduce((sum, destination) => sum + destination.graph.edges.length, 0),
    users: data.users.length,
    journals: data.journals.length,
    foods: data.destinations.reduce((sum, destination) => sum + destination.foods.length, 0),
  };
}

export function createFallbackRuntime() {
  return {
    seedData: fallbackSeedData,
    lookups: fallbackLookups,
  };
}
