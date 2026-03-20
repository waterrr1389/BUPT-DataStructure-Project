import { WeightedGraph, findShortestPath } from "../algorithms/graph";
import type {
  CrossMapRouteFailureLegs,
  CrossMapRouteItinerary,
  CrossMapRoutePlanRequest,
  CrossMapRouteSuccessLegs,
  CrossMapRouteUnreachableItinerary,
  CrossMapRouteWorldLeg,
  DestinationPortalRecord,
  DestinationRecord,
  RouteStrategy,
  TravelMode,
  WorldOnlyRouteItinerary,
  WorldOnlyRoutePlanRequest,
  WorldRouteFailure,
  WorldRouteItinerary,
  WorldRouteLeg,
  WorldRoutePlanDestinationNotFoundRecord,
  WorldRoutePlanErrorRecord,
  WorldRoutePlanInvalidRequestRecord,
  WorldRoutePlanLocalNodeNotFoundRecord,
  WorldRoutePlanModeNotAllowedRecord,
  WorldRoutePlanPortalMisconfiguredRecord,
  WorldRoutePlanRequest,
  WorldRoutePortalSelection,
  WorldRoutePortalEntryTransferStep,
  WorldRoutePortalExitTransferStep,
  WorldRouteLocalStep,
  WorldRouteSummary,
  WorldRouteWorldEdgeStep,
  WorldUnavailableRecord,
  WorldMapRecord,
} from "./contracts";
import { WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER } from "./contracts";
import type { ResolvedRuntime } from "./runtime";

const WORLD_UNAVAILABLE_MESSAGE = "World mode is unavailable.";
const INVALID_WORLD_ROUTE_MESSAGE = "Invalid world route request.";
const MODE_NOT_ALLOWED_MESSAGE = "Route mode is not allowed by selected edges or portals.";
const DESTINATION_NOT_FOUND_MESSAGE = "Destination was not found.";
const LOCAL_NODE_NOT_FOUND_MESSAGE = "Local node was not found in destination.";
const PORTAL_MISCONFIGURED_MESSAGE = "Portal binding is misconfigured.";

const TRAVEL_MODE_VALUES = ["walk", "bike", "shuttle", "mixed"] as const;
const ROUTE_STRATEGY_VALUES = ["distance", "time", "mixed"] as const;

const TRAVEL_MODE_SET = new Set<string>(TRAVEL_MODE_VALUES);
const ROUTE_STRATEGY_SET = new Set<string>(ROUTE_STRATEGY_VALUES);

type WorldRouteErrorPayload = WorldUnavailableRecord | WorldRoutePlanErrorRecord;

interface ParsedWorldRouteRequest {
  issues: string[];
  request?: WorldRoutePlanRequest;
}

interface PlannedWorldPath {
  reachable: boolean;
  worldNodeIds: string[];
  steps: WorldRouteWorldEdgeStep[];
  distance: number;
  cost: number;
}

interface PlannedLocalLeg {
  reachable: boolean;
  leg: {
    scope: "destination";
    destinationId: string;
    localNodeIds: string[];
    distance: number;
    cost: number;
    steps: WorldRouteLocalStep[];
  };
}

interface ModePortal {
  portal: DestinationPortalRecord;
  mode: TravelMode;
}

interface CandidateSuccess {
  entry: ModePortal;
  exit: ModePortal;
  originLocal: PlannedLocalLeg;
  destinationLocal: PlannedLocalLeg;
  worldPath: PlannedWorldPath;
}

interface CandidateDestinationFailure {
  entry: ModePortal;
  exit: ModePortal;
  originLocal: PlannedLocalLeg;
  worldPath: PlannedWorldPath;
}

interface CandidateWorldFailure {
  entry: ModePortal;
  exit: ModePortal;
  originLocal: PlannedLocalLeg;
}

interface CandidateOriginFailure {
  entry: ModePortal;
  exit: ModePortal;
}

interface WorldGraphStepMeta {
  edgeId: string;
  roadType: WorldRouteWorldEdgeStep["roadType"];
  distance: number;
  congestion: number;
  mode: TravelMode;
}

export class WorldRouteServiceError extends Error {
  readonly payload: WorldRouteErrorPayload;
  readonly statusCode: number;

  constructor(statusCode: number, payload: WorldRouteErrorPayload) {
    super(payload.error);
    this.name = "WorldRouteServiceError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export function isWorldRouteServiceError(error: unknown): error is WorldRouteServiceError {
  return error instanceof WorldRouteServiceError;
}

function createUnavailableRecord(): WorldUnavailableRecord {
  return {
    error: WORLD_UNAVAILABLE_MESSAGE,
    code: "world_unavailable",
  };
}

function createInvalidRequestRecord(issues: string[]): WorldRoutePlanInvalidRequestRecord {
  return {
    error: INVALID_WORLD_ROUTE_MESSAGE,
    code: "world_route_invalid_request",
    issues,
  };
}

function createDestinationNotFoundRecord(destinationId: string): WorldRoutePlanDestinationNotFoundRecord {
  return {
    error: DESTINATION_NOT_FOUND_MESSAGE,
    code: "world_route_destination_not_found",
    destinationId,
  };
}

function createLocalNodeNotFoundRecord(
  destinationId: string,
  localNodeId: string,
): WorldRoutePlanLocalNodeNotFoundRecord {
  return {
    error: LOCAL_NODE_NOT_FOUND_MESSAGE,
    code: "world_route_local_node_not_found",
    destinationId,
    localNodeId,
  };
}

function createModeNotAllowedRecord(
  mode: TravelMode,
  allowedModes: TravelMode[],
): WorldRoutePlanModeNotAllowedRecord {
  return {
    error: MODE_NOT_ALLOWED_MESSAGE,
    code: "world_route_mode_not_allowed",
    mode,
    allowedModes,
  };
}

function createPortalMisconfiguredRecord(portalId: string): WorldRoutePlanPortalMisconfiguredRecord {
  return {
    error: PORTAL_MISCONFIGURED_MESSAGE,
    code: "world_route_portal_misconfigured",
    portalId,
  };
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function worldEdgeCost(distance: number, congestion: number): number {
  return roundMetric(distance * (1 + congestion));
}

function compareNumber(left: number, right: number): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function comparePortal(left: DestinationPortalRecord, right: DestinationPortalRecord): number {
  const priorityDiff = compareNumber(right.priority, left.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return compareString(left.id, right.id);
}

function comparePortalPairPriority(
  leftEntry: ModePortal,
  leftExit: ModePortal,
  rightEntry: ModePortal,
  rightExit: ModePortal,
): number {
  return (
    compareNumber(rightEntry.portal.priority, leftEntry.portal.priority) ||
    compareNumber(rightExit.portal.priority, leftExit.portal.priority)
  );
}

function comparePortalPairId(
  leftEntry: ModePortal,
  leftExit: ModePortal,
  rightEntry: ModePortal,
  rightExit: ModePortal,
): number {
  return (
    compareString(leftEntry.portal.id, rightEntry.portal.id) ||
    compareString(leftExit.portal.id, rightExit.portal.id)
  );
}

function portalTransferCost(entry: ModePortal, exit: ModePortal): number {
  return entry.portal.transferCost + exit.portal.transferCost;
}

function uniqueModes(modes: Iterable<TravelMode>): TravelMode[] {
  const found = new Set<TravelMode>();
  for (const mode of modes) {
    found.add(mode);
  }
  return TRAVEL_MODE_VALUES.filter((mode) => found.has(mode));
}

function collectAllowedModes(portals: DestinationPortalRecord[]): TravelMode[] {
  const modes = new Set<TravelMode>();
  for (const portal of portals) {
    for (const mode of portal.allowedModes) {
      modes.add(mode);
    }
  }
  return uniqueModes(modes);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readStringField(
  input: Record<string, unknown>,
  key: string,
  issues: string[],
): string | undefined {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`"${key}" must be a non-empty string.`);
    return undefined;
  }
  return value.trim();
}

function readOptionalStringField(
  input: Record<string, unknown>,
  key: string,
  issues: string[],
): string | undefined {
  if (!(key in input) || input[key] === undefined || input[key] === null) {
    return undefined;
  }
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`"${key}" must be a non-empty string when provided.`);
    return undefined;
  }
  return value.trim();
}

function readModeField(
  input: Record<string, unknown>,
  key: string,
  issues: string[],
): TravelMode | undefined {
  const value = readStringField(input, key, issues);
  if (!value) {
    return undefined;
  }
  if (!TRAVEL_MODE_SET.has(value)) {
    issues.push(`"${key}" must be one of ${TRAVEL_MODE_VALUES.join(", ")}.`);
    return undefined;
  }
  return value as TravelMode;
}

function readStrategyField(
  input: Record<string, unknown>,
  key: string,
  issues: string[],
): RouteStrategy | undefined {
  const value = readStringField(input, key, issues);
  if (!value) {
    return undefined;
  }
  if (!ROUTE_STRATEGY_SET.has(value)) {
    issues.push(`"${key}" must be one of ${ROUTE_STRATEGY_VALUES.join(", ")}.`);
    return undefined;
  }
  return value as RouteStrategy;
}

function parseWorldRoutePlanRequest(input: unknown): ParsedWorldRouteRequest {
  const body = asRecord(input);
  const issues: string[] = [];

  if (!body) {
    return {
      issues: ["Request body must be a JSON object."],
    };
  }

  const scope = readStringField(body, "scope", issues);
  if (!scope) {
    return { issues };
  }

  if (scope === "world-only") {
    const fromWorldNodeId = readStringField(body, "fromWorldNodeId", issues);
    const toWorldNodeId = readStringField(body, "toWorldNodeId", issues);
    const strategy = readStrategyField(body, "strategy", issues);
    const mode = readModeField(body, "mode", issues);
    if (issues.length > 0 || !fromWorldNodeId || !toWorldNodeId || !strategy || !mode) {
      return { issues };
    }
    return {
      issues,
      request: {
        scope,
        fromWorldNodeId,
        toWorldNodeId,
        strategy,
        mode,
      },
    };
  }

  if (scope === "cross-map") {
    const fromDestinationId = readStringField(body, "fromDestinationId", issues);
    const toDestinationId = readStringField(body, "toDestinationId", issues);
    const fromLocalNodeId = readOptionalStringField(body, "fromLocalNodeId", issues);
    const toLocalNodeId = readOptionalStringField(body, "toLocalNodeId", issues);
    const strategy = readStrategyField(body, "strategy", issues);
    const mode = readModeField(body, "mode", issues);
    if (issues.length > 0 || !fromDestinationId || !toDestinationId || !strategy || !mode) {
      return { issues };
    }
    return {
      issues,
      request: {
        scope,
        fromDestinationId,
        toDestinationId,
        fromLocalNodeId,
        toLocalNodeId,
        strategy,
        mode,
      },
    };
  }

  issues.push(`"scope" must be "world-only" or "cross-map".`);
  return { issues };
}

function resolveMode(allowedModes: readonly TravelMode[], requestedMode: TravelMode): TravelMode | null {
  if (requestedMode === "mixed") {
    if (allowedModes.includes("shuttle")) {
      return "shuttle";
    }
    if (allowedModes.includes("bike")) {
      return "bike";
    }
    if (allowedModes.includes("walk")) {
      return "walk";
    }
    if (allowedModes.includes("mixed")) {
      return "mixed";
    }
    return null;
  }

  return allowedModes.includes(requestedMode) ? requestedMode : null;
}

function allowsPortalDirection(portal: DestinationPortalRecord, direction: "local-to-world" | "world-to-local"): boolean {
  if (portal.direction === "bidirectional") {
    return true;
  }
  if (direction === "local-to-world") {
    return portal.direction === "outbound";
  }
  return portal.direction === "inbound";
}

function buildWorldPath(world: WorldMapRecord, fromWorldNodeId: string, toWorldNodeId: string, mode: TravelMode): PlannedWorldPath {
  if (fromWorldNodeId === toWorldNodeId) {
    return {
      reachable: true,
      worldNodeIds: [fromWorldNodeId],
      steps: [],
      distance: 0,
      cost: 0,
    };
  }

  const graph = new WeightedGraph<TravelMode, undefined, WorldGraphStepMeta>();
  for (const node of world.graph.nodes) {
    graph.addNode({ id: node.id });
  }
  for (const edge of world.graph.edges) {
    const effectiveMode = resolveMode(edge.allowedModes, mode);
    if (!effectiveMode) {
      continue;
    }
    graph.addEdge({
      from: edge.from,
      to: edge.to,
      bidirectional: edge.bidirectional,
      distance: worldEdgeCost(edge.distance, edge.congestion),
      metadata: {
        edgeId: edge.id,
        roadType: edge.roadType,
        distance: edge.distance,
        congestion: edge.congestion,
        mode: effectiveMode,
      },
    });
  }

  const result = findShortestPath(graph, fromWorldNodeId, toWorldNodeId);
  if (!result.reachable) {
    return {
      reachable: false,
      worldNodeIds: [],
      steps: [],
      distance: 0,
      cost: 0,
    };
  }

  const steps: WorldRouteWorldEdgeStep[] = result.steps.map((step) => {
    const metadata = step.metadata as WorldGraphStepMeta;
    return {
      kind: "world-edge",
      edgeId: metadata.edgeId,
      fromWorldNodeId: step.from,
      toWorldNodeId: step.to,
      roadType: metadata.roadType,
      mode: metadata.mode,
      distance: metadata.distance,
      congestion: metadata.congestion,
      cost: worldEdgeCost(metadata.distance, metadata.congestion),
    };
  });

  const distance = roundMetric(steps.reduce((sum, step) => sum + step.distance, 0));
  const cost = roundMetric(steps.reduce((sum, step) => sum + step.cost, 0));

  return {
    reachable: true,
    worldNodeIds: result.nodes,
    steps,
    distance,
    cost,
  };
}

function planLocalLeg(
  runtime: ResolvedRuntime,
  destination: DestinationRecord,
  startNodeId: string,
  endNodeId: string,
  strategy: RouteStrategy,
  mode: TravelMode,
): PlannedLocalLeg {
  if (startNodeId === endNodeId) {
    return {
      reachable: true,
      leg: {
        scope: "destination",
        destinationId: destination.id,
        localNodeIds: [startNodeId],
        distance: 0,
        cost: 0,
        steps: [],
      },
    };
  }

  const route = runtime.algorithms.routing.shortestPath({
    destination,
    startNodeId,
    endNodeId,
    strategy,
    mode,
  });

  if (!route.reachable) {
    return {
      reachable: false,
      leg: {
        scope: "destination",
        destinationId: destination.id,
        localNodeIds: [],
        distance: 0,
        cost: 0,
        steps: [],
      },
    };
  }

  return {
    reachable: true,
    leg: {
      scope: "destination",
      destinationId: destination.id,
      localNodeIds: route.nodeIds,
      distance: route.totalDistance,
      cost: route.totalCost,
      steps: route.steps.map((step) => ({
        kind: "local-edge",
        destinationId: destination.id,
        edgeId: step.edgeId,
        fromLocalNodeId: step.from,
        toLocalNodeId: step.to,
        mode: step.mode,
        distance: step.distance,
        cost: step.cost,
      })),
    },
  };
}

function assertPortalBindings(
  portals: DestinationPortalRecord[],
  worldNodeById: Map<string, WorldMapRecord["graph"]["nodes"][number]>,
  destinationNodeIds: Map<string, Set<string>>,
): void {
  for (const portal of portals) {
    const worldNode = worldNodeById.get(portal.worldNodeId);
    if (!worldNode || worldNode.kind !== "portal") {
      throw new WorldRouteServiceError(409, createPortalMisconfiguredRecord(portal.id));
    }
    if (worldNode.destinationId && worldNode.destinationId !== portal.destinationId) {
      throw new WorldRouteServiceError(409, createPortalMisconfiguredRecord(portal.id));
    }
    const localNodes = destinationNodeIds.get(portal.destinationId);
    if (!localNodes || !localNodes.has(portal.localNodeId)) {
      throw new WorldRouteServiceError(409, createPortalMisconfiguredRecord(portal.id));
    }
  }
}

function buildPortalSelection(
  entryPortalId: string,
  exitPortalId: string,
  candidatePairCount: number,
): WorldRoutePortalSelection {
  return {
    ruleVersion: "v1",
    candidatePairCount,
    entryPortalId,
    exitPortalId,
    tieBreakOrder: [...WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER],
  };
}

function buildTransferStep(
  portal: DestinationPortalRecord,
  transferDirection: "local-to-world",
  mode: TravelMode,
): WorldRoutePortalEntryTransferStep;
function buildTransferStep(
  portal: DestinationPortalRecord,
  transferDirection: "world-to-local",
  mode: TravelMode,
): WorldRoutePortalExitTransferStep;
function buildTransferStep(
  portal: DestinationPortalRecord,
  transferDirection: "local-to-world" | "world-to-local",
  mode: TravelMode,
): WorldRoutePortalEntryTransferStep | WorldRoutePortalExitTransferStep {
  return {
    kind: "portal-transfer",
    portalId: portal.id,
    transferDirection,
    destinationId: portal.destinationId,
    localNodeId: portal.localNodeId,
    worldNodeId: portal.worldNodeId,
    mode,
    transferDistance: portal.transferDistance,
    transferCost: portal.transferCost,
    distance: portal.transferDistance,
    cost: portal.transferCost,
  };
}

function buildCrossMapWorldLeg(entry: ModePortal, exit: ModePortal, worldPath: PlannedWorldPath): CrossMapRouteWorldLeg {
  const entryStep = buildTransferStep(entry.portal, "local-to-world", entry.mode);
  const exitStep = buildTransferStep(exit.portal, "world-to-local", exit.mode);
  return {
    scope: "world",
    entryPortalId: entry.portal.id,
    exitPortalId: exit.portal.id,
    worldNodeIds: worldPath.worldNodeIds,
    distance: roundMetric(worldPath.distance + entry.portal.transferDistance + exit.portal.transferDistance),
    cost: roundMetric(worldPath.cost + entry.portal.transferCost + exit.portal.transferCost),
    steps: [entryStep, ...worldPath.steps, exitStep],
  };
}

function createSummary(
  destinationDistance: number,
  worldDistance: number,
  transferDistance: number,
  destinationCost: number,
  worldCost: number,
  transferCost: number,
): WorldRouteSummary {
  return {
    destinationDistance: roundMetric(destinationDistance),
    worldDistance: roundMetric(worldDistance),
    transferDistance: roundMetric(transferDistance),
    destinationCost: roundMetric(destinationCost),
    worldCost: roundMetric(worldCost),
    transferCost: roundMetric(transferCost),
  };
}

function summaryTotals(summary: WorldRouteSummary): { totalCost: number; totalDistance: number } {
  return {
    totalDistance: roundMetric(summary.destinationDistance + summary.worldDistance + summary.transferDistance),
    totalCost: roundMetric(summary.destinationCost + summary.worldCost + summary.transferCost),
  };
}

function usedModesFromLegs(legs: WorldRouteLeg[]): TravelMode[] {
  const modes = new Set<TravelMode>();
  for (const leg of legs) {
    for (const step of leg.steps) {
      modes.add(step.mode);
    }
  }
  return uniqueModes(modes);
}

function findDestination(runtime: ResolvedRuntime, destinationId: string): DestinationRecord {
  const destination = runtime.lookups.destinationById.get(destinationId);
  if (!destination) {
    throw new WorldRouteServiceError(404, createDestinationNotFoundRecord(destinationId));
  }
  return destination;
}

function assertLocalNodeExists(destination: DestinationRecord, localNodeId: string): void {
  const localNodeIds = new Set(destination.graph.nodes.map((node) => node.id));
  if (!localNodeIds.has(localNodeId)) {
    throw new WorldRouteServiceError(404, createLocalNodeNotFoundRecord(destination.id, localNodeId));
  }
}

function planWorldOnlyRoute(world: WorldMapRecord, request: WorldOnlyRoutePlanRequest): WorldOnlyRouteItinerary {
  const worldNodeIds = new Set(world.graph.nodes.map((node) => node.id));
  const issues: string[] = [];

  if (!worldNodeIds.has(request.fromWorldNodeId)) {
    issues.push(`Unknown fromWorldNodeId: "${request.fromWorldNodeId}".`);
  }
  if (!worldNodeIds.has(request.toWorldNodeId)) {
    issues.push(`Unknown toWorldNodeId: "${request.toWorldNodeId}".`);
  }
  if (issues.length > 0) {
    throw new WorldRouteServiceError(400, createInvalidRequestRecord(issues));
  }

  const path = buildWorldPath(world, request.fromWorldNodeId, request.toWorldNodeId, request.mode);
  if (!path.reachable) {
    const leg = {
      scope: "world" as const,
      worldNodeIds: [request.fromWorldNodeId],
      distance: 0,
      cost: 0,
      steps: [],
    };
    const summary = createSummary(0, 0, 0, 0, 0, 0);
    const totals = summaryTotals(summary);
    return {
      reachable: false,
      scope: "world-only",
      strategy: request.strategy,
      mode: request.mode,
      legs: [leg],
      summary,
      totalDistance: totals.totalDistance,
      totalCost: totals.totalCost,
      usedModes: [],
      failure: {
        stage: "world",
        reason: "world_disconnected",
        code: "world_segment_unreachable",
        blockedFrom: request.fromWorldNodeId,
        blockedTo: request.toWorldNodeId,
      },
    };
  }

  const leg = {
    scope: "world" as const,
    worldNodeIds: path.worldNodeIds,
    distance: path.distance,
    cost: path.cost,
    steps: path.steps,
  };
  const summary = createSummary(0, path.distance, 0, 0, path.cost, 0);
  const totals = summaryTotals(summary);
  return {
    reachable: true,
    scope: "world-only",
    strategy: request.strategy,
    mode: request.mode,
    legs: [leg],
    summary,
    totalDistance: totals.totalDistance,
    totalCost: totals.totalCost,
    usedModes: uniqueModes(path.steps.map((step) => step.mode)),
  };
}

function compareSuccessCandidate(left: CandidateSuccess, right: CandidateSuccess): number {
  const leftLocalCost = left.originLocal.leg.cost + left.destinationLocal.leg.cost;
  const rightLocalCost = right.originLocal.leg.cost + right.destinationLocal.leg.cost;
  return (
    comparePortalPairPriority(left.entry, left.exit, right.entry, right.exit) ||
    compareNumber(leftLocalCost, rightLocalCost) ||
    compareNumber(portalTransferCost(left.entry, left.exit), portalTransferCost(right.entry, right.exit)) ||
    comparePortalPairId(left.entry, left.exit, right.entry, right.exit)
  );
}

function compareDestinationFailure(left: CandidateDestinationFailure, right: CandidateDestinationFailure): number {
  return (
    comparePortalPairPriority(left.entry, left.exit, right.entry, right.exit) ||
    compareNumber(left.originLocal.leg.cost, right.originLocal.leg.cost) ||
    compareNumber(portalTransferCost(left.entry, left.exit), portalTransferCost(right.entry, right.exit)) ||
    comparePortalPairId(left.entry, left.exit, right.entry, right.exit)
  );
}

function compareWorldFailure(left: CandidateWorldFailure, right: CandidateWorldFailure): number {
  return (
    comparePortalPairPriority(left.entry, left.exit, right.entry, right.exit) ||
    compareNumber(left.originLocal.leg.cost, right.originLocal.leg.cost) ||
    compareNumber(portalTransferCost(left.entry, left.exit), portalTransferCost(right.entry, right.exit)) ||
    comparePortalPairId(left.entry, left.exit, right.entry, right.exit)
  );
}

function compareOriginFailure(left: CandidateOriginFailure, right: CandidateOriginFailure): number {
  return (
    comparePortalPairPriority(left.entry, left.exit, right.entry, right.exit) ||
    compareNumber(portalTransferCost(left.entry, left.exit), portalTransferCost(right.entry, right.exit)) ||
    comparePortalPairId(left.entry, left.exit, right.entry, right.exit)
  );
}

function fallbackPair(
  entryPortals: ModePortal[],
  exitPortals: ModePortal[],
): { entry: ModePortal; exit: ModePortal } | null {
  if (entryPortals.length === 0 || exitPortals.length === 0) {
    return null;
  }
  const sortedEntries = [...entryPortals].sort((left, right) => comparePortal(left.portal, right.portal));
  const sortedExits = [...exitPortals].sort((left, right) => comparePortal(left.portal, right.portal));
  return {
    entry: sortedEntries[0],
    exit: sortedExits[0],
  };
}

function crossMapFailure(
  request: CrossMapRoutePlanRequest,
  legs: CrossMapRouteFailureLegs,
  failure: WorldRouteFailure,
  portalSelection: WorldRoutePortalSelection,
  summary: WorldRouteSummary,
): CrossMapRouteUnreachableItinerary {
  const totals = summaryTotals(summary);
  return {
    reachable: false,
    scope: "cross-map",
    strategy: request.strategy,
    mode: request.mode,
    legs,
    summary,
    totalDistance: totals.totalDistance,
    totalCost: totals.totalCost,
    usedModes: usedModesFromLegs(legs),
    portalSelection,
    failure,
  };
}

function planCrossMapRoute(runtime: ResolvedRuntime, world: WorldMapRecord, request: CrossMapRoutePlanRequest): CrossMapRouteItinerary {
  const originDestination = findDestination(runtime, request.fromDestinationId);
  const targetDestination = findDestination(runtime, request.toDestinationId);

  if (request.fromLocalNodeId) {
    assertLocalNodeExists(originDestination, request.fromLocalNodeId);
  }
  if (request.toLocalNodeId) {
    assertLocalNodeExists(targetDestination, request.toLocalNodeId);
  }

  const originPortals = world.portals.filter((portal) => portal.destinationId === originDestination.id);
  const targetPortals = world.portals.filter((portal) => portal.destinationId === targetDestination.id);
  if (originPortals.length === 0) {
    throw new WorldRouteServiceError(409, createPortalMisconfiguredRecord(`missing-portal:${originDestination.id}`));
  }
  if (targetPortals.length === 0) {
    throw new WorldRouteServiceError(409, createPortalMisconfiguredRecord(`missing-portal:${targetDestination.id}`));
  }

  const worldNodeById = new Map(world.graph.nodes.map((node) => [node.id, node]));
  const destinationNodeIds = new Map<string, Set<string>>([
    [originDestination.id, new Set(originDestination.graph.nodes.map((node) => node.id))],
    [targetDestination.id, new Set(targetDestination.graph.nodes.map((node) => node.id))],
  ]);
  assertPortalBindings([...originPortals, ...targetPortals], worldNodeById, destinationNodeIds);

  const originDirectional = originPortals.filter((portal) => allowsPortalDirection(portal, "local-to-world"));
  const targetDirectional = targetPortals.filter((portal) => allowsPortalDirection(portal, "world-to-local"));

  if (originDirectional.length === 0 || targetDirectional.length === 0) {
    const fallbackEntry = [...originPortals].sort(comparePortal)[0];
    const fallbackExit = [...targetPortals].sort(comparePortal)[0];
    const failure = originDirectional.length === 0
      ? {
          stage: "origin-portal" as const,
          reason: "direction_not_allowed" as const,
          code: "origin_portal_unavailable" as const,
        }
      : {
          stage: "destination-portal" as const,
          reason: "direction_not_allowed" as const,
          code: "destination_portal_unavailable" as const,
        };
    return crossMapFailure(
      request,
      [],
      failure,
      buildPortalSelection(fallbackEntry.id, fallbackExit.id, 0),
      createSummary(0, 0, 0, 0, 0, 0),
    );
  }

  const originModePortals: ModePortal[] = originDirectional
    .map((portal) => ({ portal, mode: resolveMode(portal.allowedModes, request.mode) }))
    .filter((entry): entry is ModePortal => entry.mode !== null);
  const targetModePortals: ModePortal[] = targetDirectional
    .map((portal) => ({ portal, mode: resolveMode(portal.allowedModes, request.mode) }))
    .filter((entry): entry is ModePortal => entry.mode !== null);

  if (originModePortals.length === 0) {
    throw new WorldRouteServiceError(422, createModeNotAllowedRecord(request.mode, collectAllowedModes(originDirectional)));
  }
  if (targetModePortals.length === 0) {
    throw new WorldRouteServiceError(422, createModeNotAllowedRecord(request.mode, collectAllowedModes(targetDirectional)));
  }

  const originLocalByPortalId = new Map<string, PlannedLocalLeg>();
  for (const entry of originModePortals) {
    const originLocalStartNode = request.fromLocalNodeId ?? entry.portal.localNodeId;
    originLocalByPortalId.set(
      entry.portal.id,
      planLocalLeg(
        runtime,
        originDestination,
        originLocalStartNode,
        entry.portal.localNodeId,
        request.strategy,
        request.mode,
      ),
    );
  }

  const targetLocalByPortalId = new Map<string, PlannedLocalLeg>();
  for (const exit of targetModePortals) {
    const destinationLocalEndNode = request.toLocalNodeId ?? exit.portal.localNodeId;
    targetLocalByPortalId.set(
      exit.portal.id,
      planLocalLeg(
        runtime,
        targetDestination,
        exit.portal.localNodeId,
        destinationLocalEndNode,
        request.strategy,
        request.mode,
      ),
    );
  }

  const orderedEntries = [...originModePortals].sort((left, right) => comparePortal(left.portal, right.portal));
  const orderedExits = [...targetModePortals].sort((left, right) => comparePortal(left.portal, right.portal));

  const successes: CandidateSuccess[] = [];
  const destinationFailures: CandidateDestinationFailure[] = [];
  const worldFailures: CandidateWorldFailure[] = [];
  const originFailures: CandidateOriginFailure[] = [];
  let worldConnectedPairCount = 0;

  for (const entry of orderedEntries) {
    const originLocal = originLocalByPortalId.get(entry.portal.id)!;
    for (const exit of orderedExits) {
      if (!originLocal.reachable) {
        originFailures.push({ entry, exit });
        continue;
      }

      const worldPath = buildWorldPath(world, entry.portal.worldNodeId, exit.portal.worldNodeId, request.mode);
      if (!worldPath.reachable) {
        worldFailures.push({ entry, exit, originLocal });
        continue;
      }

      worldConnectedPairCount += 1;
      const destinationLocal = targetLocalByPortalId.get(exit.portal.id)!;
      if (!destinationLocal.reachable) {
        destinationFailures.push({ entry, exit, originLocal, worldPath });
        continue;
      }

      successes.push({
        entry,
        exit,
        originLocal,
        destinationLocal,
        worldPath,
      });
    }
  }

  if (successes.length > 0) {
    const selected = [...successes].sort(compareSuccessCandidate)[0];
    const worldLeg = buildCrossMapWorldLeg(selected.entry, selected.exit, selected.worldPath);
    const legs: CrossMapRouteSuccessLegs = [selected.originLocal.leg, worldLeg, selected.destinationLocal.leg];
    const summary = createSummary(
      selected.originLocal.leg.distance + selected.destinationLocal.leg.distance,
      selected.worldPath.distance,
      selected.entry.portal.transferDistance + selected.exit.portal.transferDistance,
      selected.originLocal.leg.cost + selected.destinationLocal.leg.cost,
      selected.worldPath.cost,
      selected.entry.portal.transferCost + selected.exit.portal.transferCost,
    );
    const totals = summaryTotals(summary);
    return {
      reachable: true,
      scope: "cross-map",
      strategy: request.strategy,
      mode: request.mode,
      legs,
      summary,
      totalDistance: totals.totalDistance,
      totalCost: totals.totalCost,
      usedModes: usedModesFromLegs(legs),
      portalSelection: buildPortalSelection(
        selected.entry.portal.id,
        selected.exit.portal.id,
        worldConnectedPairCount,
      ),
    };
  }

  if (destinationFailures.length > 0) {
    const selected = [...destinationFailures].sort(compareDestinationFailure)[0];
    const worldLeg = buildCrossMapWorldLeg(selected.entry, selected.exit, selected.worldPath);
    return crossMapFailure(
      request,
      [selected.originLocal.leg, worldLeg],
      {
        stage: "destination-local",
        reason: "unreachable",
        code: "destination_local_unreachable",
        blockedFrom: selected.exit.portal.localNodeId,
        blockedTo: request.toLocalNodeId ?? selected.exit.portal.localNodeId,
      },
      buildPortalSelection(selected.entry.portal.id, selected.exit.portal.id, worldConnectedPairCount),
      createSummary(
        selected.originLocal.leg.distance,
        selected.worldPath.distance,
        selected.entry.portal.transferDistance + selected.exit.portal.transferDistance,
        selected.originLocal.leg.cost,
        selected.worldPath.cost,
        selected.entry.portal.transferCost + selected.exit.portal.transferCost,
      ),
    );
  }

  if (worldFailures.length > 0) {
    const selected = [...worldFailures].sort(compareWorldFailure)[0];
    return crossMapFailure(
      request,
      [selected.originLocal.leg],
      {
        stage: "world",
        reason: "world_disconnected",
        code: "world_segment_unreachable",
        blockedFrom: selected.entry.portal.worldNodeId,
        blockedTo: selected.exit.portal.worldNodeId,
      },
      buildPortalSelection(selected.entry.portal.id, selected.exit.portal.id, worldConnectedPairCount),
      createSummary(
        selected.originLocal.leg.distance,
        0,
        0,
        selected.originLocal.leg.cost,
        0,
        0,
      ),
    );
  }

  if (originFailures.length > 0) {
    const selected = [...originFailures].sort(compareOriginFailure)[0];
    return crossMapFailure(
      request,
      [],
      {
        stage: "origin-portal",
        reason: "unreachable",
        code: "origin_local_unreachable",
        blockedFrom: request.fromLocalNodeId ?? selected.entry.portal.localNodeId,
        blockedTo: selected.entry.portal.localNodeId,
      },
      buildPortalSelection(selected.entry.portal.id, selected.exit.portal.id, worldConnectedPairCount),
      createSummary(0, 0, 0, 0, 0, 0),
    );
  }

  const fallback = fallbackPair(orderedEntries, orderedExits);
  if (!fallback) {
    throw new WorldRouteServiceError(422, createModeNotAllowedRecord(request.mode, []));
  }

  return crossMapFailure(
    request,
    [],
    {
      stage: "world",
      reason: "world_disconnected",
      code: "world_segment_unreachable",
      blockedFrom: fallback.entry.portal.worldNodeId,
      blockedTo: fallback.exit.portal.worldNodeId,
    },
    buildPortalSelection(fallback.entry.portal.id, fallback.exit.portal.id, worldConnectedPairCount),
    createSummary(0, 0, 0, 0, 0, 0),
  );
}

function routeOrThrow(
  runtime: ResolvedRuntime,
  request: WorldRoutePlanRequest,
): WorldRouteItinerary {
  const world = runtime.seedData.world;
  if (!runtime.world.available || !world) {
    throw new WorldRouteServiceError(409, createUnavailableRecord());
  }

  if (request.scope === "world-only") {
    return planWorldOnlyRoute(world, request);
  }
  return planCrossMapRoute(runtime, world, request);
}

export interface WorldRouteService {
  plan(input: unknown): WorldRouteItinerary;
}

export function createWorldRouteService(runtime: ResolvedRuntime): WorldRouteService {
  return {
    plan(input: unknown) {
      const parsed = parseWorldRoutePlanRequest(input);
      if (!parsed.request || parsed.issues.length > 0) {
        throw new WorldRouteServiceError(400, createInvalidRequestRecord(parsed.issues));
      }
      return routeOrThrow(runtime, parsed.request);
    },
  };
}
