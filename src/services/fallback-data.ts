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
  "河畔烤物",
  "香料小街",
  "茶屋",
  "面食工坊",
  "海鲜碗",
  "便当工坊",
  "森林烘焙",
  "校园简餐",
];

const CUISINE_SEARCH_KEYWORDS = [
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
  "北部带",
  "河湾",
  "海港线",
  "西岭",
  "东环",
  "中轴",
];

const SCENIC_ADJECTIVES = [
  "青岚",
  "云麓",
  "海棠",
  "栖霞",
  "星湾",
  "竹溪",
  "锦澜",
  "松风",
  "月隐",
  "晴川",
];

const SCENIC_NOUNS = [
  "湖景区",
  "花园",
  "观景台",
  "湿地公园",
  "滨河步道",
  "山谷",
  "古渡",
  "博物苑",
  "云台",
  "溪谷",
];

const SCENIC_QUALIFIERS = [
  "水岸",
  "丹枫",
  "春晓",
  "云栖",
  "南山",
  "竹影",
  "石径",
  "芦湾",
  "远帆",
  "柳岸",
];

const SCENIC_NOUN_ALTERNATES = [
  "水湾",
  "林苑",
  "望台",
  "湿地",
  "步道",
  "峡谷",
  "港湾",
  "文博园",
  "高台",
  "溪畔",
];

const CAMPUS_PREFIXES = [
  "北辰",
  "河湾",
  "中庭",
  "云峰",
  "海韵",
  "启新",
  "博雅",
  "莲湖",
  "星图",
  "知行",
  "明德",
];

const CAMPUS_SUFFIXES = [
  "学院",
  "校区",
  "工学院",
  "书院",
  "研学中心",
  "科创园",
  "学习港",
  "大学中心",
  "艺术馆",
  "未来学校",
];

const FACILITY_NAMES: Record<FacilityCategory, string> = {
  restroom: "洗手间",
  clinic: "医疗点",
  store: "便利店",
  charging: "充电站",
  info: "问询台",
  parking: "停车点",
  water: "饮水点",
  atm: "自动取款机",
  security: "安保岗",
  lounge: "休息区",
};

const TAG_LABELS: Record<string, string> = {
  architecture: "建筑",
  art: "艺术",
  campus: "校园",
  design: "设计",
  family: "亲子",
  flexible: "灵活行程",
  food: "美食",
  forest: "森林",
  history: "历史",
  learning: "学习",
  market: "市集",
  museum: "博物馆",
  nature: "自然",
  nightscape: "夜景",
  photography: "摄影",
  research: "研学",
  scenic: "景区",
  social: "社交",
  walking: "步行",
  waterfront: "滨水",
  wellness: "康养",
};

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

function createIndoorEdgeSpecs(hallEntryCongestion: number): GraphEdgeSpec[] {
  return [
    { from: "hall-entry", to: "hall-l1", congestion: hallEntryCongestion, link: "indoor" },
    { from: "hall-l1", to: "elevator-l1", congestion: 0.1, link: "indoor" },
    { from: "elevator-l1", to: "elevator-l2", congestion: 0.08, link: "indoor" },
    { from: "elevator-l2", to: "archive", congestion: 0.06, link: "indoor" },
    { from: "elevator-l2", to: "studio", congestion: 0.05, link: "indoor" },
  ];
}

function createGraphVariant(
  coordinates: Record<NodeKey, Point>,
  surfaceEdges: GraphEdgeSpec[],
  hallEntryCongestion: number,
): GraphVariant {
  return {
    coordinates,
    edges: [...surfaceEdges, ...createIndoorEdgeSpecs(hallEntryCongestion)],
  };
}

const SCENIC_GRAPH_VARIANTS: GraphVariant[] = [
  createGraphVariant(
    createCoordinates(
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
    [
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
    ],
    0.12,
  ),
  createGraphVariant(
    createCoordinates(
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
    [
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
    ],
    0.11,
  ),
];

const CAMPUS_GRAPH_VARIANTS: GraphVariant[] = [
  createGraphVariant(
    createCoordinates(
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
    [
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
    ],
    0.11,
  ),
  createGraphVariant(
    createCoordinates(
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
    [
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
    ],
    0.11,
  ),
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
  const subIndex = Math.floor(index / 2);
  if (type === "scenic") {
    const adjective = SCENIC_ADJECTIVES[subIndex % SCENIC_ADJECTIVES.length];
    const nounIndex = (subIndex * 3) % SCENIC_NOUNS.length;
    const baseNoun = SCENIC_NOUNS[nounIndex];
    const noun =
      adjective.toLowerCase() === baseNoun.split(/\s+/)[0].toLowerCase()
        ? SCENIC_NOUN_ALTERNATES[nounIndex]
        : baseNoun;
    const cycleIndex = Math.floor(subIndex / SCENIC_ADJECTIVES.length);
    if (cycleIndex === 0) {
      return `${adjective}${noun}`;
    }
    const qualifier = SCENIC_QUALIFIERS[(cycleIndex - 1) % SCENIC_QUALIFIERS.length];
    return `${adjective}${qualifier}${noun}`;
  }
  const prefix = CAMPUS_PREFIXES[subIndex % CAMPUS_PREFIXES.length];
  const suffix = CAMPUS_SUFFIXES[(subIndex * 3) % CAMPUS_SUFFIXES.length];
  return `${prefix}${suffix}`;
}

function selectGraphVariant(index: number, type: DestinationType): GraphVariant {
  const variants = type === "scenic" ? SCENIC_GRAPH_VARIANTS : CAMPUS_GRAPH_VARIANTS;
  // Reuse a small layout set so fallback routes stay predictable while adjacent destinations still vary in metadata.
  return variants[Math.floor(index / 2) % variants.length];
}

function createNodes(destinationId: string, type: DestinationType, variant: GraphVariant): DestinationNode[] {
  const baseBuildingId = `${destinationId}-building-hall`;
  const { coordinates } = variant;
  return [
    {
      id: `${destinationId}-gate`,
      name: "主入口",
      kind: "gate",
      floor: 0,
      x: coordinates.gate.x,
      y: coordinates.gate.y,
      keywords: ["entry", "arrival", "gate"],
    },
    {
      id: `${destinationId}-plaza`,
      name: type === "scenic" ? "迎宾广场" : "中庭广场",
      kind: "plaza",
      floor: 0,
      x: coordinates.plaza.x,
      y: coordinates.plaza.y,
      keywords: ["plaza", "meeting", "landmark"],
    },
    {
      id: `${destinationId}-gallery`,
      name: type === "scenic" ? "展廊街" : "图书庭院",
      kind: "building",
      floor: 0,
      x: coordinates.gallery.x,
      y: coordinates.gallery.y,
      buildingId: `${destinationId}-building-gallery`,
      keywords: ["gallery", "library", "culture"],
    },
    {
      id: `${destinationId}-garden`,
      name: type === "scenic" ? "花径步道" : "研学花园",
      kind: "scenic",
      floor: 0,
      x: coordinates.garden.x,
      y: coordinates.garden.y,
      keywords: ["garden", "rest", "green"],
    },
    {
      id: `${destinationId}-lake`,
      name: type === "scenic" ? "镜湖" : "创新庭院",
      kind: "scenic",
      floor: 0,
      x: coordinates.lake.x,
      y: coordinates.lake.y,
      keywords: ["lake", "center", "festival"],
    },
    {
      id: `${destinationId}-market`,
      name: type === "scenic" ? "夜游市集" : "美食街",
      kind: "plaza",
      floor: 0,
      x: coordinates.market.x,
      y: coordinates.market.y,
      keywords: ["food", "market", "music"],
    },
    {
      id: `${destinationId}-hub`,
      name: type === "scenic" ? "换乘露台" : "交通枢纽",
      kind: "junction",
      floor: 0,
      x: coordinates.hub.x,
      y: coordinates.hub.y,
      keywords: ["transit", "hub", "connection"],
    },
    {
      id: `${destinationId}-hall-entry`,
      name: type === "scenic" ? "云厅入口" : "创新中心入口",
      kind: "building",
      floor: 0,
      x: coordinates["hall-entry"].x,
      y: coordinates["hall-entry"].y,
      buildingId: baseBuildingId,
      keywords: ["hall", "entry", "indoor"],
    },
    {
      id: `${destinationId}-deck`,
      name: type === "scenic" ? "观景平台" : "工作坊广场",
      kind: "plaza",
      floor: 0,
      x: coordinates.deck.x,
      y: coordinates.deck.y,
      keywords: ["view", "gathering", "event"],
    },
    {
      id: `${destinationId}-hall-l1`,
      name: "一层大厅",
      kind: "room",
      floor: 1,
      x: coordinates["hall-l1"].x,
      y: coordinates["hall-l1"].y,
      buildingId: baseBuildingId,
      keywords: ["lobby", "indoor", "info"],
    },
    {
      id: `${destinationId}-elevator-l1`,
      name: "东侧电梯一层",
      kind: "elevator",
      floor: 1,
      x: coordinates["elevator-l1"].x,
      y: coordinates["elevator-l1"].y,
      buildingId: baseBuildingId,
      keywords: ["elevator", "vertical", "access"],
    },
    {
      id: `${destinationId}-elevator-l2`,
      name: "东侧电梯二层",
      kind: "elevator",
      floor: 2,
      x: coordinates["elevator-l2"].x,
      y: coordinates["elevator-l2"].y,
      buildingId: baseBuildingId,
      keywords: ["elevator", "vertical", "access"],
    },
    {
      id: `${destinationId}-archive`,
      name: type === "scenic" ? "文献室" : "媒体实验室",
      kind: "room",
      floor: 2,
      x: coordinates.archive.x,
      y: coordinates.archive.y,
      buildingId: baseBuildingId,
      keywords: ["archive", "lab", "study"],
    },
    {
      id: `${destinationId}-studio`,
      name: type === "scenic" ? "光影工作室" : "创意工作室",
      kind: "room",
      floor: 2,
      x: coordinates.studio.x,
      y: coordinates.studio.y,
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
  // "Mobile" links become the destination-specific fast lane, while indoor and walkway links remain walk-only.
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
      name: type === "scenic" ? "云厅" : "创新中心",
      category: type === "scenic" ? "展陈" : "教学",
      entranceNodeId: `${destinationId}-hall-entry`,
      floors: 2,
      tags: ["indoor", "showcase", "demo"],
    },
    {
      id: `${destinationId}-building-gallery`,
      destinationId,
      name: type === "scenic" ? "海湾展馆" : "北区图书馆",
      category: type === "scenic" ? "博物馆" : "图书馆",
      entranceNodeId: `${destinationId}-gallery`,
      floors: 1,
      tags: ["culture", "quiet", "landmark"],
    },
    {
      id: `${destinationId}-building-hub`,
      destinationId,
      name: type === "scenic" ? "换乘亭" : "学生活动中心",
      category: type === "scenic" ? "服务" : "学生中心",
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
      name: `${FACILITY_NAMES[category]} ${offset + 1}`,
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
    const searchKeyword = CUISINE_SEARCH_KEYWORDS[(index + offset) % CUISINE_SEARCH_KEYWORDS.length];
    return {
      id: `${destinationId}-food-${offset + 1}`,
      destinationId,
      nodeId,
      name: `${cuisine}${type === "scenic" ? "厨房" : "档口"} ${offset + 1}`,
      venue: type === "scenic" ? "海湾庭院" : "学生巷",
      cuisine,
      rating: Number((4 + ((index + offset) % 10) / 10).toFixed(1)),
      heat: 55 + ((index * 9 + offset * 7) % 43),
      avgPrice: 16 + ((index + offset) % 6) * 4,
      keywords: [cuisine, searchKeyword, type, offset % 2 === 0 ? "quick bite" : "signature"],
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
        ? `${name}串联户外步道、观景平台和室内展陈，适合半日游览和轻量路线规划。`
        : `${name}融合教学空间、室内实验室和生活街区，适合校园参观与导航演示。`,
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
    "本地向导",
    "校园讲解员",
    "周末游客",
    "摄影爱好者",
    "亲子旅行者",
    "研学志愿者",
    "城市漫游者",
    "美食记录员",
    "骑行体验官",
    "夜游观察员",
    "路线体验员",
    "展馆志愿者",
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
  const journalPlans = [
    {
      destinationIndex: 0,
      title: "半日慢游记录",
      body:
        "上午从主入口进入，先沿着花径步道走到镜湖，再回到展廊街看完一组临展。整条路线节奏不赶，适合第一次来的人先熟悉动线。",
      userIndex: 0,
    },
    {
      destinationIndex: 1,
      title: "室内路线备忘",
      body:
        "北辰学院的室内动线比想象中清楚：主入口到中庭广场，再接创新中心和媒体实验室。下雨天也能完成一条比较完整的参观路线。",
      userIndex: 1,
    },
    {
      destinationIndex: 4,
      title: "傍晚市集和水岸",
      body:
        "海棠古渡傍晚更适合停留。先看水岸，再去夜游市集吃点东西，最后从观景平台回望海港线，路线短但层次很完整。",
      userIndex: 2,
    },
    {
      destinationIndex: 7,
      title: "校园参观小结",
      body:
        "云峰未来学校的学习空间和生活区连得很自然。图书庭院、研学花园和美食街都在一条轻松步行线上，适合做校园开放日示范。",
      userIndex: 5,
    },
  ];

  return journalPlans.map((plan, index) => {
    const destination = destinations[plan.destinationIndex];
    const user = users[plan.userIndex];
    const createdAt = `2026-03-${String(5 + index).padStart(2, "0")}T0${index % 6}:30:00.000Z`;
    return {
      id: `journal-${index + 1}`,
      userId: user.id,
      destinationId: destination.id,
      title: `${destination.name}${plan.title}`,
      body: plan.body,
      tags: [...destination.categories.slice(0, 2), ...user.interests.slice(0, 2)],
      media: [
        {
          type: "image",
          title: "封面照片",
          source: `generated://cover/${destination.id}`,
          note: "系统生成的预览素材",
        },
        {
          type: "video",
          title: "路线短片",
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

// Materialize the fallback catalog once so every runtime sees the same deterministic ids, graphs, and lookup maps.
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
