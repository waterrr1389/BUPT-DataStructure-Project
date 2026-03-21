import type {
  Building,
  DestinationPortalRecord,
  Destination,
  DestinationEdge,
  DestinationNode,
  Facility,
  FacilityCategory,
  FoodVenue,
  JournalEntry,
  SeedData,
  TravelMode,
  UserProfile,
  WorldDestinationPlacement,
  WorldEdgeRecord,
  WorldMapRecord,
  WorldNodeKind,
  WorldNodeRecord,
  WorldRoadType,
  WorldRegionRecord,
} from "../domain/models";
import { WORLD_ROUTE_LIMITS } from "../services/contracts";

export const MINIMUM_COUNTS = {
  destinations: 200,
  users: 10,
  buildings: 20,
  facilityCategories: 10,
  facilities: 50,
  edges: 200,
} as const;

const TRAVEL_MODE_DOMAIN = ["walk", "bike", "shuttle", "mixed"] as const satisfies readonly TravelMode[];
const WORLD_NODE_KIND_DOMAIN = [
  "portal",
  "junction",
  "hub",
  "region-center",
] as const satisfies readonly WorldNodeKind[];
const WORLD_ROAD_TYPE_DOMAIN = [
  "road",
  "rail",
  "trail",
  "ferry",
  "tunnel",
  "airlift",
  "bridge",
] as const satisfies readonly WorldRoadType[];
const WORLD_PORTAL_DIRECTION_DOMAIN = ["inbound", "outbound", "bidirectional"] as const;

const TRAVEL_MODE_SET = new Set<string>(TRAVEL_MODE_DOMAIN);
const WORLD_NODE_KIND_SET = new Set<string>(WORLD_NODE_KIND_DOMAIN);
const WORLD_ROAD_TYPE_SET = new Set<string>(WORLD_ROAD_TYPE_DOMAIN);
const WORLD_PORTAL_DIRECTION_SET = new Set<string>(WORLD_PORTAL_DIRECTION_DOMAIN);

export interface SeedMetrics {
  destinations: number;
  buildings: number;
  facilityCategories: number;
  facilities: number;
  edges: number;
  users: number;
  journals: number;
  foods: number;
}

export interface SeedValidationResult {
  ok: boolean;
  issues: string[];
  metrics: SeedMetrics;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidDateString(value: string): boolean {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function ensureUniqueIds<T extends { id: string }>(
  entries: readonly T[],
  label: string,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isNonEmptyString(entry.id)) {
      issues.push(`${label} has a missing id`);
      continue;
    }
    if (seen.has(entry.id)) {
      issues.push(`${label} id "${entry.id}" is duplicated`);
      continue;
    }
    seen.add(entry.id);
  }
}

function validateTravelModes(
  modes: readonly string[],
  label: string,
  issues: string[],
): void {
  if (!Array.isArray(modes) || modes.length === 0) {
    issues.push(`${label} must include at least one travel mode`);
    return;
  }
  if (!hasUniqueStrings([...modes])) {
    issues.push(`${label} includes duplicate travel modes`);
  }
  for (const mode of modes) {
    if (!TRAVEL_MODE_SET.has(mode)) {
      issues.push(`${label} includes unsupported travel mode "${mode}"`);
    }
  }
}

function validateStringArray(
  values: readonly string[],
  label: string,
  issues: string[],
  minLength = 1,
): void {
  if (!Array.isArray(values) || values.length < minLength) {
    const shortageMessage =
      minLength === 0
        ? `${label} must be an array`
        : `${label} must include at least ${minLength} value${minLength === 1 ? "" : "s"}`;
    issues.push(shortageMessage);
    return;
  }
  if (!values.every(isNonEmptyString)) {
    issues.push(`${label} must only include non-empty strings`);
  }
  if (!hasUniqueStrings([...values])) {
    issues.push(`${label} includes duplicate values`);
  }
}

function validateWorldCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  issues: string[],
): void {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    issues.push(`${label} has invalid coordinates`);
    return;
  }
  if (x < 0 || x > width || y < 0 || y > height) {
    issues.push(`${label} must stay within world bounds`);
  }
}

function validateWorldRegion(
  region: WorldRegionRecord,
  world: WorldMapRecord,
  issues: string[],
): void {
  if (!isNonEmptyString(region.name)) {
    issues.push(`world region "${region.id}" is missing a name`);
  }
  if (!Array.isArray(region.polygon) || region.polygon.length < 3) {
    issues.push(`world region "${region.id}" must include a polygon with at least 3 points`);
  } else {
    for (const [index, point] of region.polygon.entries()) {
      if (!Array.isArray(point) || point.length !== 2) {
        issues.push(`world region "${region.id}" polygon point ${index} is invalid`);
        continue;
      }
      validateWorldCoordinates(
        point[0],
        point[1],
        world.width,
        world.height,
        `world region "${region.id}" polygon point ${index}`,
        issues,
      );
    }
  }
  validateStringArray(region.tags, `world region "${region.id}" tags`, issues, 0);
}

function validateWorldPlacement(
  placement: WorldDestinationPlacement,
  world: WorldMapRecord,
  destinationIds: Set<string>,
  regionIds: Set<string>,
  issues: string[],
): void {
  if (!destinationIds.has(placement.destinationId)) {
    issues.push(
      `world destination placement "${placement.destinationId}" references unknown destination "${placement.destinationId}"`,
    );
  }
  if (!isNonEmptyString(placement.label)) {
    issues.push(`world destination placement "${placement.destinationId}" is missing a label`);
  }
  validateWorldCoordinates(
    placement.x,
    placement.y,
    world.width,
    world.height,
    `world destination placement "${placement.destinationId}"`,
    issues,
  );
  if (!isFiniteNumber(placement.radius) || placement.radius <= 0) {
    issues.push(
      `world destination placement "${placement.destinationId}" must have a positive radius`,
    );
  }
  if (!regionIds.has(placement.regionId)) {
    issues.push(
      `world destination placement "${placement.destinationId}" references unknown region "${placement.regionId}"`,
    );
  }
  validateStringArray(
    placement.portalIds,
    `world destination placement "${placement.destinationId}" portalIds`,
    issues,
  );
  if (!isNonEmptyString(placement.iconType)) {
    issues.push(`world destination placement "${placement.destinationId}" is missing an iconType`);
  }
}

function validateWorldNode(
  node: WorldNodeRecord,
  world: WorldMapRecord,
  destinationIds: Set<string>,
  issues: string[],
): void {
  if (!isNonEmptyString(node.label)) {
    issues.push(`world node "${node.id}" is missing a label`);
  }
  if (!WORLD_NODE_KIND_SET.has(node.kind)) {
    issues.push(`world node "${node.id}" has unsupported kind "${node.kind}"`);
  }
  validateWorldCoordinates(node.x, node.y, world.width, world.height, `world node "${node.id}"`, issues);
  validateStringArray(node.tags, `world node "${node.id}" tags`, issues, 0);
  if (node.destinationId && !destinationIds.has(node.destinationId)) {
    issues.push(`world node "${node.id}" references unknown destination "${node.destinationId}"`);
  }
  if (node.kind === "portal" && !isNonEmptyString(node.destinationId)) {
    issues.push(`world node "${node.id}" with kind "portal" must include a destinationId`);
  }
}

function validateWorldEdge(
  edge: WorldEdgeRecord,
  nodeIds: Set<string>,
  issues: string[],
): void {
  if (!nodeIds.has(edge.from)) {
    issues.push(`world edge "${edge.id}" references missing from node "${edge.from}"`);
  }
  if (!nodeIds.has(edge.to)) {
    issues.push(`world edge "${edge.id}" references missing to node "${edge.to}"`);
  }
  if (!isFiniteNumber(edge.distance) || edge.distance < WORLD_ROUTE_LIMITS.distance.min) {
    issues.push(
      `world edge "${edge.id}" must use a distance >= ${WORLD_ROUTE_LIMITS.distance.min}`,
    );
  } else if (edge.distance > WORLD_ROUTE_LIMITS.distance.max) {
    issues.push(
      `world edge "${edge.id}" exceeds distance max ${WORLD_ROUTE_LIMITS.distance.max}`,
    );
  }
  if (!isFiniteNumber(edge.congestion) || edge.congestion < 0 || edge.congestion > 1) {
    issues.push(`world edge "${edge.id}" has invalid congestion ${edge.congestion}`);
  }
  if (!WORLD_ROAD_TYPE_SET.has(edge.roadType)) {
    issues.push(`world edge "${edge.id}" has unsupported roadType "${edge.roadType}"`);
  }
  validateTravelModes(edge.allowedModes, `world edge "${edge.id}"`, issues);
  if (typeof edge.bidirectional !== "boolean") {
    issues.push(`world edge "${edge.id}" must define bidirectional as a boolean`);
  }
}

function validateWorldPortal(
  portal: DestinationPortalRecord,
  destinationIds: Set<string>,
  destinationNodeIds: Map<string, Set<string>>,
  worldNodeById: Map<string, WorldNodeRecord>,
  issues: string[],
): void {
  if (!destinationIds.has(portal.destinationId)) {
    issues.push(`world portal "${portal.id}" references unknown destination "${portal.destinationId}"`);
  }
  if (!isNonEmptyString(portal.worldNodeId)) {
    issues.push(`world portal "${portal.id}" is missing a worldNodeId`);
  }
  if (!isNonEmptyString(portal.localNodeId)) {
    issues.push(`world portal "${portal.id}" is missing a localNodeId`);
  }
  if (!isNonEmptyString(portal.portalType)) {
    issues.push(`world portal "${portal.id}" is missing a portalType`);
  }
  if (!isNonEmptyString(portal.label)) {
    issues.push(`world portal "${portal.id}" is missing a label`);
  }
  if (!Number.isInteger(portal.priority) || portal.priority < 0) {
    issues.push(`world portal "${portal.id}" must use a non-negative integer priority`);
  }
  validateTravelModes(portal.allowedModes, `world portal "${portal.id}"`, issues);
  if (!isNonEmptyString(portal.direction)) {
    issues.push(`world portal "${portal.id}" is missing a direction`);
  } else if (!WORLD_PORTAL_DIRECTION_SET.has(portal.direction)) {
    issues.push(`world portal "${portal.id}" has unsupported direction "${portal.direction}"`);
  }
  if (!isFiniteNumber(portal.transferDistance) || portal.transferDistance < 0) {
    issues.push(`world portal "${portal.id}" must use a non-negative transferDistance`);
  } else if (portal.transferDistance > WORLD_ROUTE_LIMITS.transferDistance.max) {
    issues.push(
      `world portal "${portal.id}" exceeds transferDistance max ${WORLD_ROUTE_LIMITS.transferDistance.max}`,
    );
  }
  if (!isFiniteNumber(portal.transferCost) || portal.transferCost < 0) {
    issues.push(`world portal "${portal.id}" must use a non-negative transferCost`);
  } else if (portal.transferCost > WORLD_ROUTE_LIMITS.transferCost.max) {
    issues.push(
      `world portal "${portal.id}" exceeds transferCost max ${WORLD_ROUTE_LIMITS.transferCost.max}`,
    );
  }

  const worldNode = worldNodeById.get(portal.worldNodeId);
  if (!worldNode) {
    issues.push(`world portal "${portal.id}" references unknown world node "${portal.worldNodeId}"`);
  } else {
    if (worldNode.kind !== "portal") {
      issues.push(
        `world portal "${portal.id}" references world node "${portal.worldNodeId}" that is not kind "portal"`,
      );
    }
    if (worldNode.destinationId && worldNode.destinationId !== portal.destinationId) {
      issues.push(
        `world portal "${portal.id}" destination "${portal.destinationId}" does not match world node destination "${worldNode.destinationId}"`,
      );
    }
  }

  const localNodeIds = destinationNodeIds.get(portal.destinationId);
  if (!localNodeIds || !localNodeIds.has(portal.localNodeId)) {
    issues.push(
      `world portal "${portal.id}" references unknown local node "${portal.localNodeId}" in destination "${portal.destinationId}"`,
    );
  }
}

function validateWorld(
  world: WorldMapRecord,
  destinationIds: Set<string>,
  destinationNodeIds: Map<string, Set<string>>,
): string[] {
  const issues: string[] = [];

  if (!isNonEmptyString(world.id)) {
    issues.push("world map has a missing id");
  }
  if (!isNonEmptyString(world.name)) {
    issues.push(`world map "${world.id}" is missing a name`);
  }
  if (!isFiniteNumber(world.width) || world.width <= 0) {
    issues.push(`world map "${world.id}" must have a positive width`);
  }
  if (!isFiniteNumber(world.height) || world.height <= 0) {
    issues.push(`world map "${world.id}" must have a positive height`);
  }
  if (!isNonEmptyString(world.backgroundImage)) {
    issues.push(`world map "${world.id}" is missing a backgroundImage`);
  }
  if (!Array.isArray(world.regions) || world.regions.length === 0) {
    issues.push(`world map "${world.id}" must include regions`);
    return issues;
  }
  if (!Array.isArray(world.destinations) || world.destinations.length === 0) {
    issues.push(`world map "${world.id}" must include destinations`);
    return issues;
  }
  if (!world.graph || !Array.isArray(world.graph.nodes) || !Array.isArray(world.graph.edges)) {
    issues.push(`world map "${world.id}" must include a graph with nodes and edges`);
    return issues;
  }
  if (world.graph.nodes.length === 0) {
    issues.push(`world map "${world.id}" must include world graph nodes`);
  }
  if (world.graph.edges.length === 0) {
    issues.push(`world map "${world.id}" must include world graph edges`);
  }
  if (!Array.isArray(world.portals) || world.portals.length === 0) {
    issues.push(`world map "${world.id}" must include portals`);
    return issues;
  }

  ensureUniqueIds(world.regions, "world region", issues);
  ensureUniqueIds(world.graph.nodes, "world node", issues);
  ensureUniqueIds(world.graph.edges, "world edge", issues);
  ensureUniqueIds(world.portals, "world portal", issues);

  const placementIds = world.destinations.map((placement) => placement.destinationId);
  if (!hasUniqueStrings(placementIds)) {
    issues.push("world destination placements must use unique destinationId values");
  }

  const regionIds = new Set(world.regions.map((region) => region.id));
  const worldNodeIds = new Set(world.graph.nodes.map((node) => node.id));
  const worldNodeById = new Map(world.graph.nodes.map((node) => [node.id, node]));
  const portalById = new Map(world.portals.map((portal) => [portal.id, portal]));
  const placementByDestinationId = new Map(
    world.destinations.map((placement) => [placement.destinationId, placement]),
  );

  for (const region of world.regions) {
    validateWorldRegion(region, world, issues);
  }

  for (const placement of world.destinations) {
    validateWorldPlacement(placement, world, destinationIds, regionIds, issues);
  }

  for (const node of world.graph.nodes) {
    validateWorldNode(node, world, destinationIds, issues);
  }

  for (const edge of world.graph.edges) {
    validateWorldEdge(edge, worldNodeIds, issues);
  }

  for (const portal of world.portals) {
    validateWorldPortal(portal, destinationIds, destinationNodeIds, worldNodeById, issues);
  }

  for (const placement of world.destinations) {
    for (const portalId of placement.portalIds) {
      const portal = portalById.get(portalId);
      if (!portal) {
        issues.push(
          `world destination placement "${placement.destinationId}" references unknown portal "${portalId}"`,
        );
        continue;
      }
      if (portal.destinationId !== placement.destinationId) {
        issues.push(
          `world destination placement "${placement.destinationId}" references portal "${portalId}" for destination "${portal.destinationId}"`,
        );
      }
    }
  }

  const portalNodeIds = world.graph.nodes
    .filter((node) => node.kind === "portal")
    .map((node) => node.id);
  for (const portalNodeId of portalNodeIds) {
    if (!world.portals.some((portal) => portal.worldNodeId === portalNodeId)) {
      issues.push(`world node "${portalNodeId}" with kind "portal" must map to a world portal`);
    }
  }

  for (const portal of world.portals) {
    if (!placementByDestinationId.has(portal.destinationId)) {
      issues.push(
        `world portal "${portal.id}" references destination "${portal.destinationId}" without a world destination placement`,
      );
    }
  }

  return issues;
}

function validateNode(
  node: DestinationNode,
  destinationId: string,
  buildingIds: Set<string>,
  issues: string[],
): void {
  if (!isNonEmptyString(node.name)) {
    issues.push(`node "${node.id}" is missing a name`);
  }
  if (!isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
    issues.push(`node "${node.id}" has invalid coordinates`);
  }
  if (!Number.isInteger(node.floor)) {
    issues.push(`node "${node.id}" must use an integer floor`);
  }
  if (!Array.isArray(node.keywords) || node.keywords.length === 0) {
    issues.push(`node "${node.id}" must include keywords`);
  }
  if (node.buildingId && !buildingIds.has(node.buildingId)) {
    issues.push(
      `node "${node.id}" references unknown building "${node.buildingId}" in destination "${destinationId}"`,
    );
  }
}

function validateEdge(
  edge: DestinationEdge,
  nodeIds: Set<string>,
  nodeById: Map<string, DestinationNode>,
  issues: string[],
): void {
  if (!nodeIds.has(edge.from)) {
    issues.push(`edge "${edge.id}" references missing from node "${edge.from}"`);
  }
  if (!nodeIds.has(edge.to)) {
    issues.push(`edge "${edge.id}" references missing to node "${edge.to}"`);
  }
  if (!isFiniteNumber(edge.distance) || edge.distance <= 0) {
    issues.push(`edge "${edge.id}" must have a positive distance`);
  }
  if (!isFiniteNumber(edge.congestion) || edge.congestion <= 0 || edge.congestion > 1) {
    issues.push(`edge "${edge.id}" has invalid congestion ${edge.congestion}`);
  }

  validateTravelModes(edge.allowedModes, `edge "${edge.id}"`, issues);

  const fromNode = nodeById.get(edge.from);
  const toNode = nodeById.get(edge.to);
  if (!fromNode || !toNode) {
    return;
  }

  if (edge.roadType === "walkway" || edge.roadType === "indoor") {
    if (edge.allowedModes.some((mode) => mode !== "walk")) {
      issues.push(`edge "${edge.id}" with roadType "${edge.roadType}" can only allow walk`);
    }
  }

  if (edge.roadType === "bike-lane") {
    if (!edge.allowedModes.includes("bike")) {
      issues.push(`edge "${edge.id}" with roadType "bike-lane" must allow bike`);
    }
    if (edge.allowedModes.some((mode) => mode !== "walk" && mode !== "bike")) {
      issues.push(`edge "${edge.id}" with roadType "bike-lane" can only allow walk or bike`);
    }
  }

  if (edge.roadType === "shuttle-lane") {
    if (!edge.allowedModes.includes("shuttle")) {
      issues.push(`edge "${edge.id}" with roadType "shuttle-lane" must allow shuttle`);
    }
    if (edge.allowedModes.some((mode) => mode !== "walk" && mode !== "shuttle")) {
      issues.push(
        `edge "${edge.id}" with roadType "shuttle-lane" can only allow walk or shuttle`,
      );
    }
  }

  if (edge.roadType === "indoor") {
    if (
      fromNode.buildingId &&
      toNode.buildingId &&
      fromNode.buildingId !== toNode.buildingId
    ) {
      issues.push(`edge "${edge.id}" with roadType "indoor" must stay inside one building`);
    }
  }
}

function validateBuilding(
  building: Building,
  destinationId: string,
  nodeById: Map<string, DestinationNode>,
  issues: string[],
): void {
  if (building.destinationId !== destinationId) {
    issues.push(`building "${building.id}" must reference destination "${destinationId}"`);
  }
  if (!isNonEmptyString(building.name)) {
    issues.push(`building "${building.id}" is missing a name`);
  }
  if (!isNonEmptyString(building.category)) {
    issues.push(`building "${building.id}" is missing a category`);
  }
  if (!isPositiveInteger(building.floors)) {
    issues.push(`building "${building.id}" must use a positive integer floors value`);
  }
  if (!Array.isArray(building.tags) || building.tags.length === 0) {
    issues.push(`building "${building.id}" must include tags`);
  }

  const entranceNode = nodeById.get(building.entranceNodeId);
  if (!entranceNode) {
    issues.push(
      `building "${building.id}" references missing entrance node "${building.entranceNodeId}"`,
    );
    return;
  }
  if (entranceNode.buildingId && entranceNode.buildingId !== building.id) {
    issues.push(
      `building "${building.id}" entrance node "${building.entranceNodeId}" points to another building`,
    );
  }
}

function validateFacility(
  facility: Facility,
  destinationId: string,
  nodeIds: Set<string>,
  categoryIds: Set<FacilityCategory>,
  issues: string[],
): void {
  if (facility.destinationId !== destinationId) {
    issues.push(`facility "${facility.id}" must reference destination "${destinationId}"`);
  }
  if (!isNonEmptyString(facility.name)) {
    issues.push(`facility "${facility.id}" is missing a name`);
  }
  if (!nodeIds.has(facility.nodeId)) {
    issues.push(`facility "${facility.id}" references missing node "${facility.nodeId}"`);
  }
  if (!categoryIds.has(facility.category)) {
    issues.push(
      `facility "${facility.id}" references unknown category "${facility.category}"`,
    );
  }
  if (!isNonEmptyString(facility.openHours)) {
    issues.push(`facility "${facility.id}" is missing openHours`);
  }
}

function validateFood(
  food: FoodVenue,
  destinationId: string,
  nodeIds: Set<string>,
  issues: string[],
): void {
  if (food.destinationId !== destinationId) {
    issues.push(`food "${food.id}" must reference destination "${destinationId}"`);
  }
  if (!nodeIds.has(food.nodeId)) {
    issues.push(`food "${food.id}" references missing node "${food.nodeId}"`);
  }
  if (!isNonEmptyString(food.name)) {
    issues.push(`food "${food.id}" is missing a name`);
  }
  if (!isNonEmptyString(food.venue)) {
    issues.push(`food "${food.id}" is missing a venue`);
  }
  if (!isNonEmptyString(food.cuisine)) {
    issues.push(`food "${food.id}" is missing a cuisine`);
  }
  if (!isFiniteNumber(food.rating) || food.rating < 0 || food.rating > 5) {
    issues.push(`food "${food.id}" has invalid rating ${food.rating}`);
  }
  if (!isFiniteNumber(food.heat) || food.heat < 0 || food.heat > 100) {
    issues.push(`food "${food.id}" has invalid heat ${food.heat}`);
  }
  if (!isFiniteNumber(food.avgPrice) || food.avgPrice <= 0) {
    issues.push(`food "${food.id}" must have a positive avgPrice`);
  }
  if (!Array.isArray(food.keywords) || food.keywords.length === 0) {
    issues.push(`food "${food.id}" must include keywords`);
  }
}

function validateDestination(destination: Destination, categoryIds: Set<FacilityCategory>): string[] {
  const issues: string[] = [];

  if (!isNonEmptyString(destination.id)) {
    issues.push("destination has a missing id");
  }
  if (!isNonEmptyString(destination.name)) {
    issues.push(`destination "${destination.id}" is missing a name`);
  }
  if (!isNonEmptyString(destination.region)) {
    issues.push(`destination "${destination.id}" is missing a region`);
  }
  if (!isNonEmptyString(destination.description)) {
    issues.push(`destination "${destination.id}" is missing a description`);
  }
  if (!Array.isArray(destination.categories) || destination.categories.length === 0) {
    issues.push(`destination "${destination.id}" must include categories`);
  }
  if (!Array.isArray(destination.keywords) || destination.keywords.length === 0) {
    issues.push(`destination "${destination.id}" must include keywords`);
  }
  if (!isFiniteNumber(destination.heat) || destination.heat < 0 || destination.heat > 100) {
    issues.push(`destination "${destination.id}" has invalid heat ${destination.heat}`);
  }
  if (!isFiniteNumber(destination.rating) || destination.rating < 0 || destination.rating > 5) {
    issues.push(`destination "${destination.id}" has invalid rating ${destination.rating}`);
  }

  ensureUniqueIds(destination.graph.nodes, "node", issues);
  ensureUniqueIds(destination.graph.edges, "edge", issues);
  ensureUniqueIds(destination.buildings, "building", issues);
  ensureUniqueIds(destination.facilities, "facility", issues);
  ensureUniqueIds(destination.foods, "food", issues);

  if (destination.graph.nodes.length === 0) {
    issues.push(`destination "${destination.id}" must include graph nodes`);
  }
  if (destination.graph.edges.length === 0) {
    issues.push(`destination "${destination.id}" must include graph edges`);
  }
  if (destination.buildings.length === 0) {
    issues.push(`destination "${destination.id}" must include buildings`);
  }
  if (destination.facilities.length === 0) {
    issues.push(`destination "${destination.id}" must include facilities`);
  }
  if (destination.foods.length === 0) {
    issues.push(`destination "${destination.id}" must include foods`);
  }

  const buildingIds = new Set(destination.buildings.map((building) => building.id));
  const nodeIds = new Set(destination.graph.nodes.map((node) => node.id));
  const nodeById = new Map(destination.graph.nodes.map((node) => [node.id, node]));

  for (const node of destination.graph.nodes) {
    validateNode(node, destination.id, buildingIds, issues);
  }

  for (const edge of destination.graph.edges) {
    validateEdge(edge, nodeIds, nodeById, issues);
  }

  for (const building of destination.buildings) {
    validateBuilding(building, destination.id, nodeById, issues);
  }

  for (const facility of destination.facilities) {
    validateFacility(facility, destination.id, nodeIds, categoryIds, issues);
  }

  for (const food of destination.foods) {
    validateFood(food, destination.id, nodeIds, issues);
  }

  return issues;
}

function validateUser(
  user: UserProfile,
  destinationIds: Set<string>,
  issues: string[],
): void {
  if (!isNonEmptyString(user.name)) {
    issues.push(`user "${user.id}" is missing a name`);
  }
  if (!Array.isArray(user.interests) || user.interests.length === 0) {
    issues.push(`user "${user.id}" must include interests`);
  }
  if (!Array.isArray(user.dietaryPreferences)) {
    issues.push(`user "${user.id}" must include dietaryPreferences`);
  }
  if (!destinationIds.has(user.homeDestinationId)) {
    issues.push(
      `user "${user.id}" references unknown home destination "${user.homeDestinationId}"`,
    );
  }
}

function validateJournal(
  journal: JournalEntry,
  userIds: Set<string>,
  destinationIds: Set<string>,
  issues: string[],
): void {
  if (!userIds.has(journal.userId)) {
    issues.push(`journal "${journal.id}" references unknown user "${journal.userId}"`);
  }
  if (!destinationIds.has(journal.destinationId)) {
    issues.push(
      `journal "${journal.id}" references unknown destination "${journal.destinationId}"`,
    );
  }
  if (!isNonEmptyString(journal.title)) {
    issues.push(`journal "${journal.id}" is missing a title`);
  }
  if (!isNonEmptyString(journal.body)) {
    issues.push(`journal "${journal.id}" is missing a body`);
  }
  if (!Array.isArray(journal.tags) || journal.tags.length === 0) {
    issues.push(`journal "${journal.id}" must include tags`);
  }
  if (!isValidDateString(journal.createdAt)) {
    issues.push(`journal "${journal.id}" has invalid createdAt`);
  }
  if (!isValidDateString(journal.updatedAt)) {
    issues.push(`journal "${journal.id}" has invalid updatedAt`);
  }
  if (!Number.isInteger(journal.views) || journal.views < 0) {
    issues.push(`journal "${journal.id}" must use a non-negative integer views value`);
  }
  if (!Array.isArray(journal.media)) {
    issues.push(`journal "${journal.id}" must include a media array`);
  } else {
    for (const media of journal.media) {
      if (!isNonEmptyString(media.title)) {
        issues.push(`journal "${journal.id}" contains media with a missing title`);
      }
      if (!isNonEmptyString(media.source)) {
        issues.push(`journal "${journal.id}" contains media with a missing source`);
      }
    }
  }

  if (!Array.isArray(journal.ratings)) {
    issues.push(`journal "${journal.id}" must include a ratings array`);
  } else {
    const ratingUserIds = new Set<string>();
    for (const rating of journal.ratings) {
      if (!userIds.has(rating.userId)) {
        issues.push(
          `journal "${journal.id}" contains rating by unknown user "${rating.userId}"`,
        );
      }
      if (ratingUserIds.has(rating.userId)) {
        issues.push(`journal "${journal.id}" contains duplicate rating by "${rating.userId}"`);
      }
      ratingUserIds.add(rating.userId);
      if (!Number.isInteger(rating.score) || rating.score < 1 || rating.score > 5) {
        issues.push(
          `journal "${journal.id}" has invalid rating score ${rating.score} for user "${rating.userId}"`,
        );
      }
    }
  }

  if (!Array.isArray(journal.recommendedFor)) {
    issues.push(`journal "${journal.id}" must include a recommendedFor array`);
  } else {
    for (const userId of journal.recommendedFor) {
      if (!userIds.has(userId)) {
        issues.push(
          `journal "${journal.id}" recommends to unknown user "${userId}"`,
        );
      }
    }
  }
}

export function summarizeSeedData(seedData: SeedData): SeedMetrics {
  return {
    destinations: seedData.destinations.length,
    buildings: seedData.destinations.reduce(
      (sum, destination) => sum + destination.buildings.length,
      0,
    ),
    facilityCategories: seedData.facilityCategories.length,
    facilities: seedData.destinations.reduce(
      (sum, destination) => sum + destination.facilities.length,
      0,
    ),
    edges: seedData.destinations.reduce(
      (sum, destination) => sum + destination.graph.edges.length,
      0,
    ),
    users: seedData.users.length,
    journals: seedData.journals.length,
    foods: seedData.destinations.reduce(
      (sum, destination) => sum + destination.foods.length,
      0,
    ),
  };
}

export function collectSeedDataIssues(seedData: SeedData): string[] {
  if (!seedData || typeof seedData !== "object") {
    return ["seedData must be an object"];
  }

  const issues: string[] = [];
  const metrics = summarizeSeedData(seedData);

  if (!isNonEmptyString(seedData.version)) {
    issues.push("seedData.version must be a non-empty string");
  }
  if (!isValidDateString(seedData.generatedAt)) {
    issues.push("seedData.generatedAt must be a valid ISO-like timestamp");
  }
  if (!Array.isArray(seedData.destinations)) {
    issues.push("seedData.destinations must be an array");
    return issues;
  }
  if (!Array.isArray(seedData.facilityCategories)) {
    issues.push("seedData.facilityCategories must be an array");
    return issues;
  }
  if (!Array.isArray(seedData.users)) {
    issues.push("seedData.users must be an array");
    return issues;
  }
  if (!Array.isArray(seedData.journals)) {
    issues.push("seedData.journals must be an array");
    return issues;
  }

  ensureUniqueIds(seedData.destinations, "destination", issues);
  ensureUniqueIds(seedData.facilityCategories, "facility category", issues);
  ensureUniqueIds(seedData.users, "user", issues);
  ensureUniqueIds(seedData.journals, "journal", issues);

  if (metrics.destinations < MINIMUM_COUNTS.destinations) {
    issues.push(
      `seedData has ${metrics.destinations} destinations; expected at least ${MINIMUM_COUNTS.destinations}`,
    );
  }
  if (metrics.users < MINIMUM_COUNTS.users) {
    issues.push(
      `seedData has ${metrics.users} users; expected at least ${MINIMUM_COUNTS.users}`,
    );
  }
  if (metrics.buildings < MINIMUM_COUNTS.buildings) {
    issues.push(
      `seedData has ${metrics.buildings} buildings; expected at least ${MINIMUM_COUNTS.buildings}`,
    );
  }
  if (metrics.facilityCategories < MINIMUM_COUNTS.facilityCategories) {
    issues.push(
      `seedData has ${metrics.facilityCategories} facility categories; expected at least ${MINIMUM_COUNTS.facilityCategories}`,
    );
  }
  if (metrics.facilities < MINIMUM_COUNTS.facilities) {
    issues.push(
      `seedData has ${metrics.facilities} facilities; expected at least ${MINIMUM_COUNTS.facilities}`,
    );
  }
  if (metrics.edges < MINIMUM_COUNTS.edges) {
    issues.push(`seedData has ${metrics.edges} edges; expected at least ${MINIMUM_COUNTS.edges}`);
  }

  for (const category of seedData.facilityCategories) {
    if (!isNonEmptyString(category.label)) {
      issues.push(`facility category "${category.id}" is missing a label`);
    }
    if (!isNonEmptyString(category.summary)) {
      issues.push(`facility category "${category.id}" is missing a summary`);
    }
    if (!Array.isArray(category.keywords) || category.keywords.length === 0) {
      issues.push(`facility category "${category.id}" must include keywords`);
    }
  }

  const destinationIds = new Set(seedData.destinations.map((destination) => destination.id));
  const categoryIds = new Set(seedData.facilityCategories.map((category) => category.id));
  const destinationNodeIds = new Map(
    seedData.destinations.map((destination) => [
      destination.id,
      new Set(destination.graph.nodes.map((node) => node.id)),
    ]),
  );

  for (const destination of seedData.destinations) {
    issues.push(...validateDestination(destination, categoryIds));
  }

  const flattenedBuildings = seedData.destinations.flatMap((destination) => destination.buildings);
  const flattenedFacilities = seedData.destinations.flatMap((destination) => destination.facilities);
  const flattenedFoods = seedData.destinations.flatMap((destination) => destination.foods);
  const flattenedNodes = seedData.destinations.flatMap((destination) => destination.graph.nodes);
  const flattenedEdges = seedData.destinations.flatMap((destination) => destination.graph.edges);

  ensureUniqueIds(flattenedBuildings, "building", issues);
  ensureUniqueIds(flattenedFacilities, "facility", issues);
  ensureUniqueIds(flattenedFoods, "food", issues);
  ensureUniqueIds(flattenedNodes, "node", issues);
  ensureUniqueIds(flattenedEdges, "edge", issues);

  for (const user of seedData.users) {
    validateUser(user, destinationIds, issues);
  }

  const userIds = new Set(seedData.users.map((user) => user.id));
  for (const journal of seedData.journals) {
    validateJournal(journal, userIds, destinationIds, issues);
  }

  if (seedData.world !== undefined) {
    issues.push(...validateWorld(seedData.world, destinationIds, destinationNodeIds));
  }

  return issues;
}

export function validateSeedData(seedData: SeedData): SeedValidationResult {
  const issues = collectSeedDataIssues(seedData);
  return {
    ok: issues.length === 0,
    issues,
    metrics: summarizeSeedData(seedData),
  };
}

export function assertValidSeedData(seedData: SeedData): void {
  const result = validateSeedData(seedData);
  if (result.ok) {
    return;
  }

  const preview = result.issues.slice(0, 20).map((issue) => `- ${issue}`).join("\n");
  const suffix =
    result.issues.length > 20
      ? `\n... ${result.issues.length - 20} more validation issues`
      : "";

  throw new Error(
    `Seed data validation failed with ${result.issues.length} issue(s):\n${preview}${suffix}`,
  );
}
