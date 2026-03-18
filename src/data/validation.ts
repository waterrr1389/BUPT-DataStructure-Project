import type {
  Building,
  Destination,
  DestinationEdge,
  DestinationNode,
  Facility,
  FacilityCategory,
  FoodVenue,
  JournalEntry,
  SeedData,
  UserProfile,
} from "../domain/models";

export const MINIMUM_COUNTS = {
  destinations: 200,
  users: 10,
  buildings: 20,
  facilityCategories: 10,
  facilities: 50,
  edges: 200,
} as const;

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
