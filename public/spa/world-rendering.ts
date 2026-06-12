// @ts-nocheck

import {
  appCopy,
  displayLabel,
  displayDestinationTagLabel,
  displayWorldRegionLabel,
  modeLabels,
  portalTransferSummary,
  strategyLabels,
  worldEdgeSummary,
  worldRouteScopeLabels,
} from "./copy.js";
import {
  createRouteContextHref,
  emptyStateMarkup,
  escapeHtml,
  resultMetaMarkup,
  resolveRouteActor,
  safeArray,
  text,
} from "./lib.js";

const LEAFLET_CSS_PATH = "/vendor/leaflet/leaflet.css";
const LEAFLET_SCRIPT_PATH = "/vendor/leaflet/leaflet.js";
const REGION_STYLES = [
  { fill: "rgba(249, 115, 22, 0.12)", stroke: "rgba(154, 90, 42, 0.34)" },
  { fill: "rgba(14, 165, 233, 0.11)", stroke: "rgba(42, 105, 126, 0.32)" },
  { fill: "rgba(15, 118, 110, 0.1)", stroke: "rgba(54, 102, 88, 0.32)" },
  { fill: "rgba(84, 107, 66, 0.1)", stroke: "rgba(86, 103, 74, 0.3)" },
];
const DESTINATION_MARKER_COLORS = {
  "campus-commons": "#e85d2a",
  "campus-research": "#0f766e",
  "campus-waterfront": "#2c7da0",
  "scenic-harbor": "#a34831",
  "scenic-historic": "#8a5a3c",
  "scenic-lookout": "#607a49",
  "scenic-market": "#b45322",
};
const WORLD_ROAD_STYLES = {
  airlift: { color: "#6d5bd0", dashArray: "2 12", opacity: 0.48, weight: 2.5 },
  bridge: { color: "#d77a2d", dashArray: "", opacity: 0.72, weight: 3.5 },
  ferry: { color: "#2c7da0", dashArray: "12 8 2 8", opacity: 0.52, weight: 2.5 },
  rail: { color: "#334155", dashArray: "9 7", opacity: 0.54, weight: 2.5 },
  road: { color: "#64748b", dashArray: "", opacity: 0.5, weight: 2.75 },
  trail: { color: "#0f766e", dashArray: "2 7", opacity: 0.52, weight: 2 },
  tunnel: { color: "#475569", dashArray: "2 9", opacity: 0.44, weight: 2.5 },
};
const WORLD_ROAD_FALLBACK_STYLE = { color: "#65717b", dashArray: "4 7", opacity: 0.46, weight: 2.5 };
const WORLD_NODE_STYLES = {
  hub: { color: "#ffffff", fillColor: "#0f2433", fillOpacity: 0.88, radius: 5.5, weight: 2 },
  junction: { color: "#ffffff", fillColor: "#eaa23b", fillOpacity: 0.86, radius: 4, weight: 1.5 },
  portal: { color: "#ffffff", fillColor: "#2c6e91", fillOpacity: 0.9, radius: 4.5, weight: 1.75 },
  "region-center": { color: "#ffffff", fillColor: "#607a49", fillOpacity: 0.88, radius: 5, weight: 1.75 },
};
const WORLD_NODE_FALLBACK_STYLE = { color: "#ffffff", fillColor: "#64748b", fillOpacity: 0.82, radius: 4, weight: 1.5 };
const WORLD_ROUTE_STRATEGIES = ["distance", "time", "mixed"];
const WORLD_ROUTE_MODES = ["walk", "bike", "shuttle", "mixed"];
const PORTAL_DIRECTION_BY_ENDPOINT = {
  from: new Set(["bidirectional", "local-to-world", "exit"]),
  to: new Set(["bidirectional", "world-to-local", "entry"]),
};

let leafletPromise = null;

/**
 * Checks whether a candidate object exposes the Leaflet API shape needed by world mode.
 */
function hasLeafletApi(candidate) {
  return Boolean(candidate && candidate.CRS?.Simple && typeof candidate.map === "function");
}

/**
 * Injects the shared Leaflet stylesheet once for the browser world map.
 */
function ensureLeafletStylesheet() {
  if (document.querySelector("link[data-world-leaflet='true']")) {
    return;
  }

  const target = document.head || document.body;
  if (!target) {
    return;
  }

  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", LEAFLET_CSS_PATH);
  link.setAttribute("data-world-leaflet", "true");
  target.appendChild(link);
}

/**
 * Lazy-loads Leaflet and preserves the existing singleton loading behavior.
 */
function ensureLeaflet() {
  if (hasLeafletApi(globalThis.L)) {
    return Promise.resolve(globalThis.L);
  }

  if (leafletPromise) {
    return leafletPromise;
  }

  const target = document.head || document.body;
  if (!target || typeof document.createElement !== "function") {
    return Promise.reject(new Error("Leaflet failed to load."));
  }

  ensureLeafletStylesheet();
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("src", LEAFLET_SCRIPT_PATH);
    script.setAttribute("data-world-leaflet", "true");
    script.addEventListener("load", () => {
      if (hasLeafletApi(globalThis.L)) {
        resolve(globalThis.L);
        return;
      }
      leafletPromise = null;
      reject(new Error("Leaflet failed to load."));
    });
    script.addEventListener("error", () => {
      leafletPromise = null;
      reject(new Error("Leaflet failed to load."));
    });
    target.appendChild(script);
  });

  return leafletPromise;
}

/**
 * Extracts the world payload whether it is nested under `world` or already unwrapped.
 */
function extractWorld(payload) {
  if (payload && typeof payload === "object" && payload.world && typeof payload.world === "object") {
    return payload.world;
  }
  return payload;
}

/**
 * Checks whether a candidate value is a plain record and not an array.
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Detects non-empty strings used by world-payload validation.
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parses numeric-like input and returns null for invalid values.
 */
function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts an `[x, y]` point into Leaflet's `[lat, lng]` ordering.
 */
function toLatLngPair(point) {
  if (!Array.isArray(point) || point.length < 2) {
    return null;
  }

  const x = Number(point[0]);
  const y = Number(point[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return [y, x];
}

/**
 * Derives the Leaflet image bounds from the world canvas dimensions.
 */
function createWorldBounds(world) {
  const width = toFiniteNumber(world?.width);
  const height = toFiniteNumber(world?.height);
  if (width == null || height == null || width <= 0 || height <= 0) {
    return null;
  }
  return [
    [0, 0],
    [height, width],
  ];
}

/**
 * Cycles through the shared region overlay palette.
 */
function regionStyleAt(index) {
  return REGION_STYLES[index % REGION_STYLES.length];
}

/**
 * Resolves the destination marker color with a stable fallback.
 */
function markerColorFor(destination) {
  return DESTINATION_MARKER_COLORS[text(destination?.iconType)] || "#d95d1e";
}

/**
 * Clamps the rendered destination marker radius into the supported range.
 */
function markerRadiusFor(destination) {
  const radius = toFiniteNumber(destination?.radius);
  if (radius == null) {
    return 11;
  }
  return Math.max(9, Math.min(radius, 13));
}

/**
 * Resolves a catalog-first destination label with the world placement label as fallback.
 */
function destinationDisplayLabel(app, destination) {
  const destinationId = text(destination?.destinationId);
  const catalogLabel = destinationId && typeof app?.getDestinationName === "function"
    ? text(app.getDestinationName(destinationId))
    : "";
  return text(catalogLabel && catalogLabel !== destinationId ? catalogLabel : destination?.label, destinationId);
}

/**
 * Resolves a compact region label for world destination detail and selectors.
 */
function worldDestinationRegionLabel(world, destination) {
  const regionId = text(destination?.regionId);
  const region = safeArray(world?.regions).find((candidate) => text(candidate?.id) === regionId);
  const regionName = text(region?.name, regionId);
  const idLabel = regionId ? displayWorldRegionLabel(regionId, "") : "";
  return idLabel && idLabel !== regionId ? idLabel : displayWorldRegionLabel(regionName);
}

/**
 * Creates the label shown in destination selectors and endpoint summaries.
 */
function destinationRouteLabel(app, world, destination) {
  const label = destinationDisplayLabel(app, destination);
  const region = worldDestinationRegionLabel(world, destination);
  const regionId = text(destination?.regionId);
  const regionRecord = safeArray(world?.regions).find((candidate) => text(candidate?.id) === regionId);
  const regionName = text(regionRecord?.name);
  if (!region || label.includes(`· ${region}`) || (regionName && label.includes(`· ${regionName}`))) {
    return label;
  }
  return region ? `${label} · ${region}` : label;
}

/**
 * Returns the destination placement for a stable destination id.
 */
function findWorldDestination(world, destinationId) {
  const id = text(destinationId);
  return safeArray(world?.destinations).find((destination) => text(destination?.destinationId) === id) || null;
}

/**
 * Returns a portal by id from world details.
 */
function findWorldPortal(world, portalId) {
  const id = text(portalId);
  return safeArray(world?.portals).find((portal) => text(portal?.id) === id) || null;
}

/**
 * Returns a world graph node by id.
 */
function findWorldNode(world, nodeId) {
  const id = text(nodeId);
  return safeArray(world?.graph?.nodes).find((node) => text(node?.id) === id) || null;
}

/**
 * Selects the default portal for a destination endpoint.
 */
function defaultPortalForDestination(world, destinationId, mode, endpoint = "from") {
  const destination = findWorldDestination(world, destinationId);
  if (!destination) {
    return null;
  }

  const allowedDirections = PORTAL_DIRECTION_BY_ENDPOINT[endpoint] || PORTAL_DIRECTION_BY_ENDPOINT.from;
  const portalIds = safeArray(destination?.portalIds).map((portalId) => text(portalId)).filter(Boolean);
  const portals = portalIds
    .map((portalId) => findWorldPortal(world, portalId))
    .filter(Boolean)
    .filter((portal) => text(portal?.destinationId) === text(destinationId));
  const modeFiltered = portals.filter((portal) => {
    const allowedModes = safeArray(portal?.allowedModes).map((value) => text(value)).filter(Boolean);
    return !mode || allowedModes.includes(mode) || allowedModes.includes("mixed");
  });
  const directionFiltered = modeFiltered.filter((portal) => {
    const direction = text(portal?.direction, "bidirectional");
    return allowedDirections.has(direction);
  });
  const candidates = directionFiltered.length ? directionFiltered : modeFiltered.length ? modeFiltered : portals;

  return candidates
    .slice()
    .sort((left, right) => {
      const priorityDifference = (toFiniteNumber(right?.priority) ?? 0) - (toFiniteNumber(left?.priority) ?? 0);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
      return text(left?.id).localeCompare(text(right?.id));
    })[0] || null;
}

/**
 * Resolves the portal world node id selected by the destination-driven world-only flow.
 */
function defaultPortalWorldNodeId(world, destinationId, mode, endpoint) {
  return text(defaultPortalForDestination(world, destinationId, mode, endpoint)?.worldNodeId);
}

/**
 * Builds a compact detail panel action URL for opening a destination map.
 */
function createDestinationHandoffHref(destinationId, route) {
  return createRouteContextHref("/map", { destinationId: text(destinationId) }, route);
}

/**
 * Renders the selected endpoint summary inside the route planner.
 */
function routeEndpointSummaryMarkup(app, world, endpointSelection) {
  const copy = appCopy.worldMap.planner.endpointSummary;
  const fromDestination = findWorldDestination(world, endpointSelection.fromDestinationId);
  const toDestination = findWorldDestination(world, endpointSelection.toDestinationId);
  const fromLabel = fromDestination ? destinationRouteLabel(app, world, fromDestination) : copy.emptyOrigin;
  const toLabel = toDestination ? destinationRouteLabel(app, world, toDestination) : copy.emptyDestination;

  return `
    <div class="world-route-endpoint-summary" data-world-route-endpoint-summary="true">
      <div data-world-route-endpoint="origin">
        <span class="section-tag">${escapeHtml(copy.origin)}</span>
        <strong>${escapeHtml(fromLabel)}</strong>
      </div>
      <div data-world-route-endpoint="destination">
        <span class="section-tag">${escapeHtml(copy.destination)}</span>
        <strong>${escapeHtml(toLabel)}</strong>
      </div>
    </div>
  `;
}

/**
 * Renders the selected destination detail panel shown beside the world map.
 */
function destinationDetailPanelMarkup(app, world, destination, route, mode) {
  const copy = appCopy.worldMap.detailPanel;
  if (!destination) {
    return `
      <aside class="world-destination-panel is-empty" data-world-destination-panel="empty">
        <p class="section-tag">${escapeHtml(copy.tag)}</p>
        <h3>${escapeHtml(copy.emptyTitle)}</h3>
        <p class="muted">${escapeHtml(copy.emptyBody)}</p>
      </aside>
    `;
  }

  const destinationId = text(destination?.destinationId);
  const portal = defaultPortalForDestination(world, destinationId, mode, "from");
  const portalNode = findWorldNode(world, portal?.worldNodeId);
  const region = worldDestinationRegionLabel(world, destination);
  const regionRecord = safeArray(world?.regions).find((candidate) => text(candidate?.id) === text(destination?.regionId));
  const tags = safeArray(destination?.tags).concat(safeArray(regionRecord?.tags)).map(displayDestinationTagLabel).filter(Boolean);
  const uniqueTags = Array.from(new Set(tags)).slice(0, 6);
  const portalLabel = portal
    ? `${text(portal?.label, text(portal?.id))}${portalNode ? ` · ${text(portalNode?.label, text(portal?.worldNodeId))}` : ""}`
    : copy.portalFallback;

  return `
    <aside class="world-destination-panel" data-world-destination-panel="${escapeHtml(destinationId)}">
      <p class="section-tag">${escapeHtml(copy.tag)}</p>
      <h3>${escapeHtml(destinationDisplayLabel(app, destination))}</h3>
      <dl class="world-destination-facts">
        <div>
          <dt>${escapeHtml(copy.labels.region)}</dt>
          <dd>${escapeHtml(region)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(copy.labels.portal)}</dt>
          <dd>${escapeHtml(portalLabel)}</dd>
        </div>
      </dl>
      <div class="tag-row">
        ${
          uniqueTags.length
            ? uniqueTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")
            : `<span class="tag">${escapeHtml(copy.noTags)}</span>`
        }
      </div>
      <div class="button-row">
        <button type="button" data-world-route-set-origin="${escapeHtml(destinationId)}">${escapeHtml(copy.buttons.setOrigin)}</button>
        <button type="button" class="secondary" data-world-route-set-destination="${escapeHtml(destinationId)}">${escapeHtml(copy.buttons.setDestination)}</button>
        <a class="inline-link" href="${createDestinationHandoffHref(destinationId, route)}" data-nav="true" data-world-open-local="${escapeHtml(destinationId)}">${escapeHtml(copy.buttons.openLocal)}</a>
      </div>
    </aside>
  `;
}

/**
 * Resolves baseline road-network styling by world graph road type.
 */
function roadStyleFor(edge) {
  const roadType = text(edge?.roadType, "road");
  const style = WORLD_ROAD_STYLES[roadType] || WORLD_ROAD_FALLBACK_STYLE;
  return {
    ...style,
    className: `world-road world-road-${roadType}`,
    interactive: false,
    lineCap: "round",
    lineJoin: "round",
    worldLayer: "baseline-road",
    worldRoadType: roadType,
  };
}

/**
 * Resolves graph-node styling without competing with destination markers.
 */
function nodeStyleFor(node) {
  const kind = text(node?.kind, "junction");
  const style = WORLD_NODE_STYLES[kind] || WORLD_NODE_FALLBACK_STYLE;
  return {
    ...style,
    className: `world-graph-node world-graph-node-${kind}`,
    interactive: false,
    worldLayer: "graph-node",
    worldNodeKind: kind,
  };
}

/**
 * Confirms projected destination coordinates fall within the world canvas.
 */
function isCoordinateWithinBounds(x, y, width, height) {
  return x >= 0 && x <= width && y >= 0 && y <= height;
}

/**
 * Validates the world details payload before the map controller consumes it.
 */
function collectWorldDetailsIssues(world) {
  const issues = [];
  if (!isRecord(world)) {
    issues.push("world details payload is missing a world object.");
    return issues;
  }

  const worldId = text(world.id, "unknown-world");
  const width = toFiniteNumber(world.width);
  const height = toFiniteNumber(world.height);
  if (width == null || height == null || width <= 0 || height <= 0) {
    issues.push(`world "${worldId}" has invalid bounds.`);
    return issues;
  }

  if (!isNonEmptyString(world.name)) {
    issues.push(`world "${worldId}" is missing a name.`);
  }
  if (!isNonEmptyString(world.backgroundImage)) {
    issues.push(`world "${worldId}" is missing a background image.`);
  }

  const regions = safeArray(world.regions);
  if (!regions.length) {
    issues.push(`world "${worldId}" must include regions.`);
  }
  const regionIds = new Set();
  regions.forEach((region, index) => {
    const regionId = text(region?.id, `region-${index}`);
    if (!isNonEmptyString(region?.id) || regionIds.has(regionId)) {
      issues.push(`world region "${regionId}" has an invalid or duplicate id.`);
    }
    regionIds.add(regionId);
    if (!isNonEmptyString(region?.name)) {
      issues.push(`world region "${regionId}" is missing a name.`);
    }
    const polygon = safeArray(region?.polygon);
    if (polygon.length < 3) {
      issues.push(`world region "${regionId}" must include a polygon with at least 3 points.`);
      return;
    }
    polygon.forEach((point, pointIndex) => {
      if (!Array.isArray(point) || point.length !== 2) {
        issues.push(`world region "${regionId}" polygon point ${pointIndex} is invalid.`);
        return;
      }
      const x = toFiniteNumber(point[0]);
      const y = toFiniteNumber(point[1]);
      if (x == null || y == null || !isCoordinateWithinBounds(x, y, width, height)) {
        issues.push(`world region "${regionId}" polygon point ${pointIndex} is out of bounds.`);
      }
    });
  });

  const destinations = safeArray(world.destinations);
  if (!destinations.length) {
    issues.push(`world "${worldId}" must include destination markers.`);
  }
  const destinationIds = new Set();
  destinations.forEach((destination, index) => {
    const destinationId = text(destination?.destinationId, `destination-${index}`);
    if (!isNonEmptyString(destination?.destinationId) || destinationIds.has(destinationId)) {
      issues.push(`world destination "${destinationId}" has an invalid or duplicate id.`);
    }
    destinationIds.add(destinationId);
    if (!isNonEmptyString(destination?.label)) {
      issues.push(`world destination "${destinationId}" is missing a label.`);
    }
    if (!isNonEmptyString(destination?.iconType)) {
      issues.push(`world destination "${destinationId}" is missing an iconType.`);
    }
    if (!isNonEmptyString(destination?.regionId) || !regionIds.has(text(destination.regionId))) {
      issues.push(`world destination "${destinationId}" references an unknown region.`);
    }
    const x = toFiniteNumber(destination?.x);
    const y = toFiniteNumber(destination?.y);
    if (x == null || y == null || !isCoordinateWithinBounds(x, y, width, height)) {
      issues.push(`world destination "${destinationId}" has invalid marker coordinates.`);
    }
    const radius = toFiniteNumber(destination?.radius);
    if (radius == null || radius <= 0) {
      issues.push(`world destination "${destinationId}" must include a positive radius.`);
    }
    const portalIds = safeArray(destination?.portalIds).map((value) => text(value)).filter(Boolean);
    if (!portalIds.length) {
      issues.push(`world destination "${destinationId}" must include portal ids.`);
    }
  });

  const graph = world.graph;
  const nodes = safeArray(graph?.nodes);
  const edges = safeArray(graph?.edges);
  if (!nodes.length || !edges.length) {
    issues.push(`world "${worldId}" must include route-relevant graph nodes and edges.`);
  }

  const worldNodeIds = new Set();
  nodes.forEach((node, index) => {
    const nodeId = text(node?.id, `world-node-${index}`);
    if (!isNonEmptyString(node?.id) || worldNodeIds.has(nodeId)) {
      issues.push(`world node "${nodeId}" has an invalid or duplicate id.`);
    }
    worldNodeIds.add(nodeId);
    if (!isNonEmptyString(node?.label)) {
      issues.push(`world node "${nodeId}" is missing a label.`);
    }
    const x = toFiniteNumber(node?.x);
    const y = toFiniteNumber(node?.y);
    if (x == null || y == null || !isCoordinateWithinBounds(x, y, width, height)) {
      issues.push(`world node "${nodeId}" has invalid coordinates.`);
    }
  });

  edges.forEach((edge, index) => {
    const edgeId = text(edge?.id, `world-edge-${index}`);
    if (!isNonEmptyString(edge?.id)) {
      issues.push(`world edge "${edgeId}" is missing an id.`);
    }
    const from = text(edge?.from);
    const to = text(edge?.to);
    if (!from || !to || !worldNodeIds.has(from) || !worldNodeIds.has(to)) {
      issues.push(`world edge "${edgeId}" references an unknown node.`);
    }
    const distance = toFiniteNumber(edge?.distance);
    if (distance == null || distance < 0) {
      issues.push(`world edge "${edgeId}" has invalid distance.`);
    }
    const congestion = toFiniteNumber(edge?.congestion);
    if (congestion == null || congestion < 0 || congestion > 1) {
      issues.push(`world edge "${edgeId}" has invalid congestion.`);
    }
    const allowedModes = safeArray(edge?.allowedModes).map((mode) => text(mode)).filter(Boolean);
    if (!allowedModes.length) {
      issues.push(`world edge "${edgeId}" must define allowed modes.`);
    }
    if (typeof edge?.bidirectional !== "boolean") {
      issues.push(`world edge "${edgeId}" must define bidirectional as a boolean.`);
    }
  });

  const portals = safeArray(world.portals);
  if (!portals.length) {
    issues.push(`world "${worldId}" must include destination portals.`);
  }

  const portalIds = new Set();
  portals.forEach((portal, index) => {
    const portalId = text(portal?.id, `portal-${index}`);
    if (!isNonEmptyString(portal?.id) || portalIds.has(portalId)) {
      issues.push(`world portal "${portalId}" has an invalid or duplicate id.`);
    }
    portalIds.add(portalId);
    if (!isNonEmptyString(portal?.destinationId) || !destinationIds.has(text(portal.destinationId))) {
      issues.push(`world portal "${portalId}" references an unknown destination.`);
    }
    if (!isNonEmptyString(portal?.worldNodeId) || !worldNodeIds.has(text(portal.worldNodeId))) {
      issues.push(`world portal "${portalId}" references an unknown world node.`);
    }
    if (!isNonEmptyString(portal?.localNodeId)) {
      issues.push(`world portal "${portalId}" is missing a local node id.`);
    }
    if (!isNonEmptyString(portal?.label) || !isNonEmptyString(portal?.portalType)) {
      issues.push(`world portal "${portalId}" is missing metadata.`);
    }
    const transferDistance = toFiniteNumber(portal?.transferDistance);
    if (transferDistance == null || transferDistance < 0) {
      issues.push(`world portal "${portalId}" has invalid transferDistance.`);
    }
    const transferCost = toFiniteNumber(portal?.transferCost);
    if (transferCost == null || transferCost < 0) {
      issues.push(`world portal "${portalId}" has invalid transferCost.`);
    }
    if (!Number.isInteger(portal?.priority) || portal.priority < 0) {
      issues.push(`world portal "${portalId}" has invalid priority.`);
    }
    const allowedModes = safeArray(portal?.allowedModes).map((mode) => text(mode)).filter(Boolean);
    if (!allowedModes.length) {
      issues.push(`world portal "${portalId}" must define allowed modes.`);
    }
    if (!isNonEmptyString(portal?.direction)) {
      issues.push(`world portal "${portalId}" is missing a direction.`);
    }
  });

  destinations.forEach((destination, index) => {
    const destinationId = text(destination?.destinationId, `destination-${index}`);
    safeArray(destination?.portalIds).forEach((portalIdRaw) => {
      const portalId = text(portalIdRaw);
      if (!portalId || !portalIds.has(portalId)) {
        issues.push(`world destination "${destinationId}" references an unknown portal.`);
        return;
      }
      const portal = portals.find((candidate) => text(candidate?.id) === portalId);
      if (text(portal?.destinationId) !== destinationId) {
        issues.push(`world destination "${destinationId}" references a portal from another destination.`);
      }
    });
  });

  return issues;
}

/**
 * Extracts the ordered world-node path from either leg metadata or step fallbacks.
 */
function extractWorldRouteNodeIds(itinerary) {
  const legs = safeArray(itinerary?.legs);
  const worldLeg = legs.find((leg) => text(leg?.scope) === "world");
  if (!worldLeg) {
    return [];
  }

  const worldNodeIds = safeArray(worldLeg?.worldNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  if (worldNodeIds.length >= 2) {
    return worldNodeIds;
  }

  const fallback = [];
  safeArray(worldLeg?.steps).forEach((step) => {
    if (text(step?.kind) === "world-edge") {
      const from = text(step?.fromWorldNodeId);
      const to = text(step?.toWorldNodeId);
      if (from) {
        fallback.push(from);
      }
      if (to) {
        fallback.push(to);
      }
      return;
    }
    if (text(step?.kind) === "portal-transfer") {
      const worldNodeId = text(step?.worldNodeId);
      if (worldNodeId) {
        fallback.push(worldNodeId);
      }
    }
  });

  return fallback.filter((nodeId, index, list) => index === 0 || nodeId !== list[index - 1]);
}

/**
 * Projects a world itinerary into Leaflet polyline coordinates.
 */
function worldRoutePoints(world, itinerary) {
  const nodeById = new Map(
    safeArray(world?.graph?.nodes).map((node) => [text(node?.id), node]),
  );
  return extractWorldRouteNodeIds(itinerary)
    .map((nodeId) => nodeById.get(nodeId))
    .filter(Boolean)
    .map((node) => [Number(node.y), Number(node.x)])
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

/**
 * Formats the itinerary scope label used by the world route summary.
 */
function itineraryScopeLabel(scope) {
  return displayLabel(worldRouteScopeLabels, scope, appCopy.worldMap.routeResult.handoffLinks.world);
}

/**
 * Summarizes a destination leg using destination and local-node ids.
 */
function destinationLegLabel(app, world, leg) {
  const destinationId = text(leg?.destinationId, "destination");
  const destination = findWorldDestination(world, destinationId);
  const destinationLabel = destination ? destinationDisplayLabel(app, destination) : destinationId;
  const localNodeIds = safeArray(leg?.localNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  return appCopy.worldMap.labels.destinationLeg(
    destinationLabel,
    localNodeIds[0],
    localNodeIds[localNodeIds.length - 1],
  );
}

/**
 * Summarizes the world leg using the first and last world-node ids.
 */
function worldLegLabel(world, leg) {
  const worldNodeIds = safeArray(leg?.worldNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  const fromNode = findWorldNode(world, worldNodeIds[0]);
  const toNode = findWorldNode(world, worldNodeIds[worldNodeIds.length - 1]);
  return appCopy.worldMap.labels.worldLeg(
    text(fromNode?.label, worldNodeIds[0]),
    text(toNode?.label, worldNodeIds[worldNodeIds.length - 1]),
  );
}

/**
 * Converts a failed itinerary response into a readable summary line.
 */
function itineraryFailureSummary(itinerary) {
  const failure = itinerary?.failure;
  if (!isRecord(failure)) {
    return "";
  }
  const failureCopy = appCopy.worldMap.failure;
  const stage = displayLabel(failureCopy.stages, failure.stage, failureCopy.fallbackStage);
  const reason = displayLabel(failureCopy.reasons, failure.reason, failureCopy.fallbackReason);
  const code = displayLabel(failureCopy.codes, failure.code, failureCopy.fallbackCode);
  const blockedFrom = text(failure.blockedFrom);
  const blockedTo = text(failure.blockedTo);
  const blockedSegment = blockedFrom && blockedTo ? `（${blockedFrom} → ${blockedTo}）` : "";
  return appCopy.worldMap.labels.failureSummary(stage, reason, code, blockedSegment);
}

/**
 * Formats numeric route metrics without losing whole-number readability.
 */
function formatMetricValue(value) {
  const metric = toFiniteNumber(value);
  if (metric == null) {
    return "0";
  }
  if (Number.isInteger(metric)) {
    return String(metric);
  }
  return metric.toFixed(2);
}

/**
 * Resolves readable local graph node names for world-route explanation copy.
 */
async function createLocalNodeLabelResolver(app, itinerary) {
  const destinationIds = new Set();
  safeArray(itinerary?.legs).forEach((leg) => {
    const legDestinationId = text(leg?.destinationId);
    if (legDestinationId) {
      destinationIds.add(legDestinationId);
    }
    safeArray(leg?.steps).forEach((step) => {
      const stepDestinationId = text(step?.destinationId);
      if (stepDestinationId) {
        destinationIds.add(stepDestinationId);
      }
    });
  });
  const labelsByDestination = new Map();

  await Promise.all(Array.from(destinationIds).map(async (destinationId) => {
    if (typeof app?.ensureDestinationDetails !== "function") {
      return;
    }
    try {
      const details = await app.ensureDestinationDetails(destinationId);
      const labelsByNode = new Map();
      safeArray(details?.graph?.nodes).forEach((node) => {
        const nodeId = text(node?.id);
        const label = text(node?.name || node?.label);
        if (nodeId && label && label !== nodeId) {
          labelsByNode.set(nodeId, label);
        }
      });
      labelsByDestination.set(destinationId, labelsByNode);
    } catch {
      labelsByDestination.set(destinationId, new Map());
    }
  }));

  return (destinationId, localNodeId) => {
    const id = text(localNodeId);
    if (!id) {
      return "";
    }
    return text(labelsByDestination.get(text(destinationId))?.get(id));
  };
}

/**
 * Flattens itinerary steps into ordered explanation strings for the UI.
 */
function worldRouteExplanationSegments(app, world, itinerary, localNodeLabelFor) {
  const segments = [];
  safeArray(itinerary?.legs).forEach((leg, legIndex) => {
    safeArray(leg?.steps).forEach((step, stepIndex) => {
      const kind = text(step?.kind);
      const order = segments.length + 1;

      if (kind === "world-edge") {
        const fromNode = findWorldNode(world, step?.fromWorldNodeId);
        const toNode = findWorldNode(world, step?.toWorldNodeId);
        segments.push({
          kind,
          order,
          summary: worldEdgeSummary({
            ...step,
            order,
            edgeId: step?.edgeId ?? `world-edge-${legIndex}-${stepIndex}`,
            fromWorldNodeLabel: fromNode?.label,
            toWorldNodeLabel: toNode?.label,
          }),
        });
        return;
      }

      if (kind === "portal-transfer") {
        const portal = findWorldPortal(world, step?.portalId);
        const destination = findWorldDestination(world, step?.destinationId);
        const worldNode = findWorldNode(world, step?.worldNodeId);
        segments.push({
          kind,
          order,
          summary: portalTransferSummary({
            ...step,
            order,
            portalId: step?.portalId ?? `portal-transfer-${legIndex}-${stepIndex}`,
            portalLabel: portal?.label,
            destinationLabel: destination ? destinationDisplayLabel(app, destination) : "",
            localNodeLabel: localNodeLabelFor?.(step?.destinationId, step?.localNodeId),
            worldNodeLabel: worldNode?.label,
          }),
        });
      }
    });
  });
  return segments;
}

/**
 * Renders the ordered route-explanation list or an empty-state fallback.
 */
function worldRouteExplanationMarkup(app, world, itinerary, localNodeLabelFor) {
  const segments = worldRouteExplanationSegments(app, world, itinerary, localNodeLabelFor);
  if (!segments.length) {
    return `
      <p class="muted" data-route-world-explanation-empty="true">
        ${escapeHtml(appCopy.worldMap.routeResult.explanationEmpty)}
      </p>
    `;
  }

  return `
    <ol class="world-route-explanation-list" data-route-world-explanation="true">
      ${segments
        .map(
          (segment) =>
            `<li data-route-world-explanation-segment="${escapeHtml(segment.kind)}" data-route-world-explanation-order="${segment.order}">${escapeHtml(segment.summary)}</li>`,
        )
        .join("")}
    </ol>
  `;
}

/**
 * Builds the local-map handoff URL for a destination leg in a world itinerary.
 */
function createWorldRouteLocalHref(leg, itinerary, route) {
  const destinationId = text(leg?.destinationId);
  if (!destinationId) {
    return "";
  }
  const localNodeIds = safeArray(leg?.localNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  return createRouteContextHref(
    "/map",
    {
      destinationId,
      from: localNodeIds[0] || "",
      to: localNodeIds[localNodeIds.length - 1] || "",
      strategy: text(itinerary?.strategy),
      mode: text(itinerary?.mode),
    },
    route,
  );
}

/**
 * Renders the pending world-route state while the request is in flight.
 */
function worldRoutePendingMarkup() {
  const copy = appCopy.worldMap.routeResult;
  return `
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="pending">
      <p class="section-tag">${escapeHtml(copy.tag)}</p>
      <h3>${escapeHtml(copy.pendingTitle)}</h3>
      <p class="muted">${escapeHtml(copy.pendingBody)}</p>
    </article>
  `;
}

/**
 * Renders the empty world-route state before any plan request has been made.
 */
function worldRouteEmptyMarkup() {
  const copy = appCopy.worldMap.routeResult;
  return `
    <div class="world-route-result-shell">
      ${emptyStateMarkup({
        body: copy.emptyBody,
        title: copy.emptyTitle,
      })}
    </div>
  `;
}

/**
 * Renders the failure card for world-route planning errors.
 */
function worldRouteFailureMarkup(message) {
  const copy = appCopy.worldMap.routeResult;
  return `
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="error">
      <p class="section-tag">${escapeHtml(copy.tag)}</p>
      <h3>${escapeHtml(copy.failureTitle)}</h3>
      <p>${escapeHtml(text(message, copy.failureFallback))}</p>
    </article>
  `;
}

/**
 * Renders the completed world-route summary and local/world handoff links.
 */
function worldRouteResultMarkup(app, world, itinerary, route, localNodeLabelFor) {
  const legs = safeArray(itinerary?.legs);
  const worldViewHref = createRouteContextHref("/map", { view: "world" }, route);
  const destinationLegs = legs.filter((leg) => text(leg?.scope) === "destination");
  const fromLocalLeg = text(itinerary?.scope) === "cross-map" ? destinationLegs[0] || null : null;
  const toLocalLeg =
    text(itinerary?.scope) === "cross-map" && destinationLegs.length > 1
      ? destinationLegs[destinationLegs.length - 1]
      : null;
  const fromLocalHref = fromLocalLeg ? createWorldRouteLocalHref(fromLocalLeg, itinerary, route) : "";
  const toLocalHref = toLocalLeg ? createWorldRouteLocalHref(toLocalLeg, itinerary, route) : "";
  const summary = itinerary?.summary;
  const legTags = legs
    .map((leg) => {
      if (text(leg?.scope) === "destination") {
        return destinationLegLabel(app, world, leg);
      }
      if (text(leg?.scope) === "world") {
        return worldLegLabel(world, leg);
      }
      return "";
    })
    .filter(Boolean);

  const summaryTone = itinerary?.reachable ? "success" : "neutral";
  const copy = appCopy.worldMap.routeResult;
  const itineraryStatus = itinerary?.reachable ? copy.availableStatus : copy.incompleteStatus;
  const failureSummary = itinerary?.reachable ? "" : itineraryFailureSummary(itinerary);

  return `
    <article
      class="surface-card route-summary-card route-stage-shell"
      data-route-world-result-state="${escapeHtml(summaryTone)}"
      data-route-world-scope="${escapeHtml(text(itinerary?.scope, "world-only"))}"
    >
      <p class="section-tag">${escapeHtml(copy.tag)}</p>
      <h3>${escapeHtml(itineraryScopeLabel(text(itinerary?.scope)))}</h3>
      ${resultMetaMarkup([
        displayLabel(strategyLabels, itinerary?.strategy, text(itinerary?.strategy, "distance")),
        displayLabel(modeLabels, itinerary?.mode, text(itinerary?.mode, "walk")),
        copy.meters(itinerary?.totalDistance),
        copy.cost(itinerary?.totalCost),
      ])}
      <p>${escapeHtml(itineraryStatus)}</p>
      ${
        failureSummary
          ? `<p class="muted" data-route-world-failure="true">${escapeHtml(failureSummary)}</p>`
          : `<p class="muted">${escapeHtml(copy.summary(summary?.destinationDistance, summary?.worldDistance, summary?.transferDistance))}</p>`
      }
    </article>
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="details">
      <p class="section-tag">${escapeHtml(copy.handoffTag)}</p>
      <h3>${escapeHtml(copy.handoffTitle)}</h3>
      <div class="world-route-handoff-links" data-route-handoff-chain="local-world-local">
        ${
          fromLocalHref
            ? `<a href="${fromLocalHref}" data-nav="true" data-route-handoff="local-origin">${escapeHtml(copy.handoffLinks.localOrigin)}</a>`
            : `<span data-route-handoff="local-origin">${escapeHtml(copy.handoffLinks.localOriginUnavailable)}</span>`
        }
        <a href="${worldViewHref}" data-nav="true" data-route-handoff="world">${escapeHtml(copy.handoffLinks.world)}</a>
        ${
          toLocalHref
            ? `<a href="${toLocalHref}" data-nav="true" data-route-handoff="local-destination">${escapeHtml(copy.handoffLinks.localDestination)}</a>`
            : `<span data-route-handoff="local-destination">${escapeHtml(copy.handoffLinks.localDestinationUnavailable)}</span>`
        }
      </div>
      <div class="tag-row">
        ${
          legTags.length
            ? legTags.map((label) => `<span class="tag" data-route-world-leg="true">${escapeHtml(label)}</span>`).join("")
            : `<span class='tag'>${escapeHtml(copy.noSegments)}</span>`
        }
      </div>
      <div class="world-route-explanation-shell">
        <p class="section-tag">${escapeHtml(copy.explanationTag)}</p>
        <h4>${escapeHtml(copy.explanationTitle)}</h4>
        ${worldRouteExplanationMarkup(app, world, itinerary, localNodeLabelFor)}
      </div>
    </article>
  `;
}

/**
 * Mounts the Leaflet world map and returns cleanup plus route-render hooks.
 */
async function mountWorldMap(container, world, options = {}) {
  const L = await ensureLeaflet();
  const bounds = createWorldBounds(world);
  if (!bounds) {
    throw new Error("World geometry is invalid.");
  }

  const map = L.map(container, {
    attributionControl: false,
    crs: L.CRS.Simple,
    maxZoom: 2,
    minZoom: -2,
    zoomControl: true,
    zoomSnap: 0.25,
  });

  if (typeof L.imageOverlay === "function" && text(world?.backgroundImage)) {
    L.imageOverlay(text(world.backgroundImage), bounds, { interactive: false }).addTo(map);
  }

  safeArray(world?.regions).forEach((region, index) => {
    const polygon = safeArray(region?.polygon).map(toLatLngPair).filter(Boolean);
    if (polygon.length < 3 || typeof L.polygon !== "function") {
      return;
    }

    const styles = regionStyleAt(index);
    const layer = L.polygon(polygon, {
      className: "world-region-overlay",
      color: styles.stroke,
      fillColor: styles.fill,
      fillOpacity: 0.72,
      interactive: false,
      weight: 1.4,
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      const regionId = text(region?.id);
      const idLabel = regionId ? displayWorldRegionLabel(regionId, "") : "";
      const tooltipLabel = idLabel && idLabel !== regionId ? idLabel : displayWorldRegionLabel(region?.name);
      layer.bindTooltip(tooltipLabel, { sticky: true });
    }
  });

  const nodeById = new Map(
    safeArray(world?.graph?.nodes).map((node) => [text(node?.id), node]),
  );
  safeArray(world?.graph?.edges).forEach((edge) => {
    if (typeof L.polyline !== "function") {
      return;
    }

    const fromNode = nodeById.get(text(edge?.from));
    const toNode = nodeById.get(text(edge?.to));
    const fromPoint = fromNode ? toLatLngPair([fromNode.x, fromNode.y]) : null;
    const toPoint = toNode ? toLatLngPair([toNode.x, toNode.y]) : null;
    if (!fromPoint || !toPoint) {
      return;
    }

    const layer = L.polyline([fromPoint, toPoint], roadStyleFor(edge)).addTo(map);
    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(edge?.roadType, "road"), { sticky: true });
    }
  });

  safeArray(world?.graph?.nodes).forEach((node) => {
    if (typeof L.circleMarker !== "function") {
      return;
    }

    const x = Number(node?.x);
    const y = Number(node?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const layer = L.circleMarker([y, x], nodeStyleFor(node)).addTo(map);
    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(node?.label, text(node?.id)), { direction: "top" });
    }
  });

  const destinationMarkerLayers = new Map();
  safeArray(world?.destinations).forEach((destination) => {
    if (typeof L.circleMarker !== "function") {
      return;
    }

    const x = Number(destination?.x);
    const y = Number(destination?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const destinationId = text(destination?.destinationId);
    const markerBaseStyle = {
      color: "#ffffff",
      fillColor: markerColorFor(destination),
      fillOpacity: 0.95,
      interactive: true,
      radius: markerRadiusFor(destination),
      weight: 2,
      worldDestinationId: destinationId,
      worldLayer: "destination-marker",
    };
    const layer = L.circleMarker([y, x], {
      ...markerBaseStyle,
      className: "world-destination-marker",
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(destination?.label, destinationId), { direction: "top" });
    }

    if (destinationId && typeof layer.on === "function") {
      layer.on("click", () => {
        options.onDestinationSelect?.(destinationId);
      });
    }

    if (destinationId) {
      destinationMarkerLayers.set(destinationId, { baseStyle: markerBaseStyle, layer });
    }
  });

  let activeRouteLayer = null;
  const selectedEndpointState = {
    fromDestinationId: "",
    selectedDestinationId: "",
    toDestinationId: "",
  };

  function updateDestinationMarkers(selection = {}) {
    selectedEndpointState.fromDestinationId = text(selection.fromDestinationId);
    selectedEndpointState.toDestinationId = text(selection.toDestinationId);
    selectedEndpointState.selectedDestinationId = text(selection.selectedDestinationId);
    destinationMarkerLayers.forEach(({ baseStyle, layer }, destinationId) => {
      const endpointClasses = [];
      if (destinationId === selectedEndpointState.fromDestinationId) {
        endpointClasses.push("is-route-origin");
      }
      if (destinationId === selectedEndpointState.toDestinationId) {
        endpointClasses.push("is-route-destination");
      }
      if (destinationId === selectedEndpointState.selectedDestinationId) {
        endpointClasses.push("is-selected");
      }
      const isEndpoint = endpointClasses.length > 0;
      const style = {
        ...baseStyle,
        className: ["world-destination-marker", ...endpointClasses].join(" "),
        color: isEndpoint ? "#ffffff" : baseStyle.color,
        fillOpacity: isEndpoint ? 1 : baseStyle.fillOpacity,
        radius: isEndpoint ? Number(baseStyle.radius) + 3 : baseStyle.radius,
        weight: isEndpoint ? 3 : baseStyle.weight,
        worldRouteEndpoint: endpointClasses.join(" "),
      };
      if (typeof layer.setStyle === "function") {
        layer.setStyle(style);
      } else {
        layer.options = { ...(layer.options || {}), ...style };
      }
    });
  }

  function clearRouteLayer() {
    if (!activeRouteLayer) {
      return;
    }
    if (typeof map.removeLayer === "function") {
      map.removeLayer(activeRouteLayer);
    } else if (typeof activeRouteLayer.remove === "function") {
      activeRouteLayer.remove();
    }
    activeRouteLayer = null;
  }

  function renderRoute(itinerary) {
    clearRouteLayer();
    if (typeof L.polyline !== "function") {
      return;
    }
    const points = worldRoutePoints(world, itinerary);
    if (points.length < 2) {
      return;
    }
    activeRouteLayer = L.polyline(points, {
      color: "#d95d1e",
      className: "world-active-route",
      lineCap: "round",
      lineJoin: "round",
      opacity: 0.92,
      weight: 5,
      worldLayer: "active-route",
    }).addTo(map);
    if (typeof activeRouteLayer.bringToFront === "function") {
      activeRouteLayer.bringToFront();
    }
  }

  if (typeof map.setMaxBounds === "function") {
    map.setMaxBounds(bounds);
  }
  if (typeof map.fitBounds === "function") {
    map.fitBounds(bounds, { padding: [24, 24] });
  }

  return {
    destroy() {
      clearRouteLayer();
      if (typeof map.remove === "function") {
        map.remove();
      }
    },
    renderRoute,
    updateDestinationMarkers,
  };
}

/**
 * Renders the compact world metadata strip shown above the planner.
 */
function worldMetaMarkup(summary, world) {
  const copy = appCopy.worldMap.meta;
  const worldName = escapeHtml(text(world?.name || summary?.world?.name, copy.worldFallback));
  const regionCount = safeArray(world?.regions).length || safeArray(summary?.regions).length;
  const destinationCount =
    safeArray(world?.destinations).length || safeArray(summary?.destinations).length;

  return `
    <div class="world-map-meta">
      <div>
        <span class="section-tag">${escapeHtml(copy.world)}</span>
        <strong>${worldName}</strong>
      </div>
      <div>
        <span class="section-tag">${escapeHtml(copy.region)}</span>
        <strong>${regionCount}</strong>
      </div>
      <div>
        <span class="section-tag">${escapeHtml(copy.destination)}</span>
        <strong>${destinationCount}</strong>
      </div>
    </div>
  `;
}

/**
 * Renders the unavailable-state shell when world data cannot be loaded.
 */
function worldUnavailableMarkup(title, body, route) {
  return `
    <article class="surface-card world-map-shell world-map-shell-unavailable">
      ${emptyStateMarkup({
        actionHref: createRouteContextHref("/explore", {}, route),
        actionLabel: appCopy.worldMap.unavailable.actionLabel,
        body,
        title,
      })}
    </article>
  `;
}

/**
 * Renders the world map route planner with lazy Leaflet loading and stale-render protection.
 */
export async function renderWorldMapView(app, route, root) {
  const copy = appCopy.worldMap;
  app.setDocumentTitle(copy.documentTitle);

  const returnToExploreHref = createRouteContextHref("/explore", {}, route);

  root.innerHTML = `
    <section class="route-hero route-hero-map world-route-hero">
      <div class="route-hero-copy">
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1>${escapeHtml(copy.hero.title)}</h1>
        <p class="route-lede">
          ${escapeHtml(copy.hero.lede)}
        </p>
        <div class="hero-actions">
          <a class="inline-link" href="${returnToExploreHref}" data-nav="true">${escapeHtml(copy.hero.returnToExplore)}</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${escapeHtml(copy.hero.panelTag)}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="world-map-layout">
      <aside class="world-map-sidebar">
        <article class="surface-card world-map-overview-card">
          <div class="section-head">
            <div>
              <p class="section-tag">${escapeHtml(copy.sidebar.tag)}</p>
              <h2>${escapeHtml(copy.sidebar.heading)}</h2>
            </div>
          </div>
          <p class="world-map-copy">
            ${escapeHtml(copy.sidebar.copy)}
          </p>
          <div id="world-map-meta">
            ${worldMetaMarkup(null, null)}
          </div>
        </article>
        <article class="surface-card route-stage-shell world-route-controls-shell">
          <p class="section-tag">${escapeHtml(copy.planner.tag)}</p>
          <h3>${escapeHtml(copy.planner.heading)}</h3>
          <form id="world-route-form" class="control-grid world-route-form">
            <div id="world-route-endpoints" class="span-all">
              ${routeEndpointSummaryMarkup(app, null, {})}
            </div>
            <label class="span-all">
              ${escapeHtml(copy.planner.labels.scope)}
              <select id="world-route-scope" data-route-world-scope-select="true">
                <option value="world-only">${escapeHtml(displayLabel(worldRouteScopeLabels, "world-only", copy.routeResult.handoffLinks.world))}</option>
                <option value="cross-map">${escapeHtml(displayLabel(worldRouteScopeLabels, "cross-map", "cross-map"))}</option>
              </select>
            </label>
            <div class="control-grid span-all world-route-destination-panel">
              <label>
                ${escapeHtml(copy.planner.labels.fromDestination)}
                <select id="world-route-from-destination"></select>
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.toDestination)}
                <select id="world-route-to-destination"></select>
              </label>
            </div>
            <details class="advanced-panel span-all world-route-advanced" id="world-route-advanced">
              <summary>${escapeHtml(copy.planner.advancedSummary)}</summary>
              <div class="control-grid world-route-scope-panel" data-route-world-scope-panel="world-only">
                <label>
                  ${escapeHtml(copy.planner.labels.fromWorldNode)}
                  <select id="world-route-from-world-node"></select>
                </label>
                <label>
                  ${escapeHtml(copy.planner.labels.toWorldNode)}
                  <select id="world-route-to-world-node"></select>
                </label>
              </div>
              <div class="control-grid world-route-scope-panel" data-route-world-scope-panel="cross-map" hidden>
                <label>
                  ${escapeHtml(copy.planner.labels.fromLocalNode)}
                  <input id="world-route-from-local-node" type="text" placeholder="${escapeHtml(copy.planner.placeholders.localNode)}" />
                </label>
                <label>
                  ${escapeHtml(copy.planner.labels.toLocalNode)}
                  <input id="world-route-to-local-node" type="text" placeholder="${escapeHtml(copy.planner.placeholders.localNode)}" />
                </label>
              </div>
            </details>
            <div class="control-grid span-all">
              <label>
                ${escapeHtml(copy.planner.labels.strategy)}
                <select id="world-route-strategy">
                  ${WORLD_ROUTE_STRATEGIES.map((strategy) => `<option value="${escapeHtml(strategy)}">${escapeHtml(displayLabel(strategyLabels, strategy, strategy))}</option>`).join("")}
                </select>
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.mode)}
                <select id="world-route-mode">
                  ${WORLD_ROUTE_MODES.map((mode) => `<option value="${escapeHtml(mode)}">${escapeHtml(displayLabel(modeLabels, mode, mode))}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="button-row span-all">
              <button type="submit" data-route-world-submit="true">${escapeHtml(copy.planner.buttons.plan)}</button>
              <button type="button" id="world-route-reset" class="ghost">${escapeHtml(copy.planner.buttons.reset)}</button>
            </div>
          </form>
          <div id="world-route-result">
            ${worldRouteEmptyMarkup()}
          </div>
        </article>
      </aside>
      <div id="world-map-stage">
        <article class="surface-card world-map-shell">
          <div class="world-map-frame">
            <div id="world-map-canvas" class="world-map-canvas" aria-label="${escapeHtml(copy.planner.ariaLabel)}"></div>
            <div id="world-destination-panel-host" class="world-destination-panel-host">
              ${destinationDetailPanelMarkup(app, null, null, route, text(route.params?.mode, "walk"))}
            </div>
            <div class="world-map-legend" aria-label="世界地图图层">
              <span class="world-map-legend-item"><span class="world-map-legend-road world-map-legend-road-main"></span>道路</span>
              <span class="world-map-legend-item"><span class="world-map-legend-road world-map-legend-road-rail"></span>轨道</span>
              <span class="world-map-legend-item"><span class="world-map-legend-road world-map-legend-road-trail"></span>步道</span>
              <span class="world-map-legend-item"><span class="world-map-legend-node world-map-legend-node-hub"></span>枢纽</span>
              <span class="world-map-legend-item"><span class="world-map-legend-node world-map-legend-node-portal"></span>入口</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  `;

  const stage = root.querySelector("#world-map-stage");
  const meta = root.querySelector("#world-map-meta");
  const canvas = root.querySelector("#world-map-canvas");
  const routeForm = root.querySelector("#world-route-form");
  const routeResult = root.querySelector("#world-route-result");
  const scopeSelect = root.querySelector("#world-route-scope");
  const fromWorldNodeSelect = root.querySelector("#world-route-from-world-node");
  const toWorldNodeSelect = root.querySelector("#world-route-to-world-node");
  const fromDestinationSelect = root.querySelector("#world-route-from-destination");
  const toDestinationSelect = root.querySelector("#world-route-to-destination");
  const fromLocalNodeInput = root.querySelector("#world-route-from-local-node");
  const toLocalNodeInput = root.querySelector("#world-route-to-local-node");
  const strategySelect = root.querySelector("#world-route-strategy");
  const modeSelect = root.querySelector("#world-route-mode");
  const clearRouteButton = root.querySelector("#world-route-reset");
  const endpointsHost = root.querySelector("#world-route-endpoints");
  const detailPanelHost = root.querySelector("#world-destination-panel-host");
  const scopePanels = Array.from(root.querySelectorAll("[data-route-world-scope-panel]"));
  let disposed = false;
  let mapController = null;
  let world = null;
  let routeFormEnabled = false;
  const endpointSelection = {
    fromDestinationId: "",
    selectedDestinationId: "",
    toDestinationId: "",
  };
  let nextMarkerEndpoint = "from";
  const initialRenderToken = app.state?.renderToken;

  function worldRouteFields() {
    if (!routeForm) {
      return [];
    }
    return Array.from(routeForm.querySelectorAll("input, select, button, textarea"));
  }

  const requestedStrategy = text(route.params?.strategy);
  const requestedMode = text(route.params?.mode);
  if (WORLD_ROUTE_STRATEGIES.includes(requestedStrategy) && strategySelect) {
    strategySelect.value = requestedStrategy;
  }
  if (WORLD_ROUTE_MODES.includes(requestedMode) && modeSelect) {
    modeSelect.value = requestedMode;
  }
  setRouteFormEnabled(false);

  function renderUnavailable(title, body) {
    if (stage) {
      stage.innerHTML = worldUnavailableMarkup(title, body, route);
    }
    if (routeResult) {
      routeResult.innerHTML = worldRouteFailureMarkup(copy.status.controlsUnavailable);
    }
  }

  function setRouteFormEnabled(enabled) {
    routeFormEnabled = enabled;
    worldRouteFields().forEach((element) => {
      element.disabled = !enabled;
    });
  }

  function selectOptionsMarkup(options, selectedValue, blankLabel = "") {
    const list = [];
    if (blankLabel) {
      const selected = text(selectedValue) ? "" : " selected";
      list.push(`<option value=""${selected}>${escapeHtml(blankLabel)}</option>`);
    }
    options.forEach((option) => {
      const optionId = text(option?.id);
      const selected = optionId === text(selectedValue) ? " selected" : "";
      list.push(`<option value="${escapeHtml(optionId)}"${selected}>${escapeHtml(text(option?.label, optionId))}</option>`);
    });
    return list.join("");
  }

  function syncScopePanels() {
    const scope = text(scopeSelect?.value, "world-only");
    scopePanels.forEach((panel) => {
      const panelScope = text(panel.getAttribute("data-route-world-scope-panel"));
      const isActive = panelScope === scope;
      panel.hidden = !isActive;
      panel
        .querySelectorAll("input, select, button, textarea")
        .forEach((field) => {
          field.disabled = !routeFormEnabled || !isActive;
        });
    });
  }

  function syncEndpointSummary() {
    if (endpointsHost) {
      endpointsHost.innerHTML = routeEndpointSummaryMarkup(app, world, endpointSelection);
    }
  }

  function syncDestinationDetailPanel() {
    if (!detailPanelHost) {
      return;
    }
    detailPanelHost.innerHTML = destinationDetailPanelMarkup(
      app,
      world,
      findWorldDestination(world, endpointSelection.selectedDestinationId),
      route,
      text(modeSelect?.value, "walk"),
    );
  }

  function syncAdvancedWorldNodeControls() {
    if (!world) {
      return;
    }
    const mode = text(modeSelect?.value, "walk");
    const fromWorldNodeId = defaultPortalWorldNodeId(world, endpointSelection.fromDestinationId, mode, "from");
    const toWorldNodeId = defaultPortalWorldNodeId(world, endpointSelection.toDestinationId, mode, "to");
    if (fromWorldNodeId && fromWorldNodeSelect) {
      fromWorldNodeSelect.value = fromWorldNodeId;
    }
    if (toWorldNodeId && toWorldNodeSelect) {
      toWorldNodeSelect.value = toWorldNodeId;
    }
  }

  function syncSelectValue(select, selectedValue) {
    if (!select) {
      return;
    }
    const normalizedValue = text(selectedValue);
    select.value = normalizedValue;
    Array.from(select.querySelectorAll("option")).forEach((option) => {
      if (text(option.getAttribute("value")) === normalizedValue) {
        option.setAttribute("selected", "");
      } else {
        option.removeAttribute("selected");
      }
    });
  }

  function syncEndpointControls() {
    syncSelectValue(fromDestinationSelect, endpointSelection.fromDestinationId);
    syncSelectValue(toDestinationSelect, endpointSelection.toDestinationId);
    syncAdvancedWorldNodeControls();
    syncEndpointSummary();
    syncDestinationDetailPanel();
    mapController?.updateDestinationMarkers(endpointSelection);
  }

  function setRouteEndpoint(endpoint, destinationId) {
    const id = text(destinationId);
    if (!id || !findWorldDestination(world, id)) {
      return;
    }
    if (endpoint === "from") {
      endpointSelection.fromDestinationId = id;
      if (endpointSelection.toDestinationId === id) {
        endpointSelection.toDestinationId = "";
      }
      nextMarkerEndpoint = "to";
    } else {
      endpointSelection.toDestinationId = id;
      if (endpointSelection.fromDestinationId === id) {
        endpointSelection.fromDestinationId = "";
      }
      nextMarkerEndpoint = "from";
    }
    endpointSelection.selectedDestinationId = id;
    syncEndpointControls();
  }

  function selectDestinationFromMarker(destinationId) {
    const id = text(destinationId);
    if (!id || !findWorldDestination(world, id)) {
      return;
    }
    endpointSelection.selectedDestinationId = id;
    if (nextMarkerEndpoint === "from" || !endpointSelection.fromDestinationId) {
      endpointSelection.fromDestinationId = id;
      if (endpointSelection.toDestinationId === id) {
        endpointSelection.toDestinationId = "";
      }
      nextMarkerEndpoint = "to";
    } else if (id !== endpointSelection.fromDestinationId) {
      endpointSelection.toDestinationId = id;
      nextMarkerEndpoint = "from";
    }
    syncEndpointControls();
  }

  function resetEndpointSelection() {
    endpointSelection.fromDestinationId = "";
    endpointSelection.toDestinationId = "";
    endpointSelection.selectedDestinationId = "";
    nextMarkerEndpoint = "from";
    if (fromLocalNodeInput) {
      fromLocalNodeInput.value = "";
    }
    if (toLocalNodeInput) {
      toLocalNodeInput.value = "";
    }
    syncEndpointControls();
  }

  function destroyMountedMap() {
    if (!mapController) {
      return;
    }
    mapController.destroy();
    mapController = null;
  }

  function isActiveRender() {
    return app.state?.renderToken === initialRenderToken;
  }

  function ensureActiveRender() {
    if (isActiveRender()) {
      return true;
    }
    disposed = true;
    destroyMountedMap();
    return false;
  }

  function clearWorldRoute() {
    if (!routeResult) {
      return;
    }
    routeResult.innerHTML = worldRouteEmptyMarkup();
    mapController?.renderRoute(null);
  }

  function resetWorldRouteState() {
    clearWorldRoute();
    resetEndpointSelection();
  }

  function buildWorldRoutePayload() {
    const scope = text(scopeSelect?.value, "world-only") === "cross-map" ? "cross-map" : "world-only";
    const strategy = text(strategySelect?.value, "distance");
    const mode = text(modeSelect?.value, "walk");
    const fromDestinationId = text(endpointSelection.fromDestinationId);
    const toDestinationId = text(endpointSelection.toDestinationId);

    if (scope === "cross-map") {
      const payload = {
        scope,
        fromDestinationId,
        toDestinationId,
        strategy,
        mode,
      };
      const fromLocalNodeId = text(fromLocalNodeInput?.value);
      const toLocalNodeId = text(toLocalNodeInput?.value);
      if (fromLocalNodeId) {
        payload.fromLocalNodeId = fromLocalNodeId;
      }
      if (toLocalNodeId) {
        payload.toLocalNodeId = toLocalNodeId;
      }
      return payload;
    }

    const fromWorldNodeId =
      defaultPortalWorldNodeId(world, fromDestinationId, mode, "from") || text(fromWorldNodeSelect?.value);
    const toWorldNodeId =
      defaultPortalWorldNodeId(world, toDestinationId, mode, "to") || text(toWorldNodeSelect?.value);

    return {
      scope,
      fromWorldNodeId,
      toWorldNodeId,
      strategy,
      mode,
    };
  }

  try {
    const summary = await app.requestJson("/api/world");
    if (!ensureActiveRender()) {
      return;
    }
    if (disposed) {
      return () => {};
    }

    if (summary?.enabled !== true) {
      if (meta) {
        meta.innerHTML = worldMetaMarkup(summary, null);
      }
      renderUnavailable(
        copy.unavailable.worldTitle,
        copy.unavailable.worldBody,
      );
      app.setStatus(copy.status.unavailable, "neutral");
      return () => {};
    }

    const detailsPayload = await app.requestJson("/api/world/details");
    if (!ensureActiveRender()) {
      return;
    }
    if (disposed) {
      return () => {};
    }

    world = extractWorld(detailsPayload);
    const issues = collectWorldDetailsIssues(world);
    if (issues.length > 0) {
      renderUnavailable(
        copy.unavailable.detailsTitle,
        copy.unavailable.invalidDetailsBody,
      );
      app.setStatus(copy.status.invalidDetails, "error");
      return () => {};
    }

    if (!world) {
      renderUnavailable(
        copy.unavailable.detailsTitle,
        copy.unavailable.missingDetailsBody,
      );
      app.setStatus(copy.status.detailsUnavailable, "error");
      return () => {};
    }

    if (meta) {
      meta.innerHTML = worldMetaMarkup(summary, world);
    }
    mapController = await mountWorldMap(canvas, world, {
      onDestinationSelect(destinationId) {
        selectDestinationFromMarker(destinationId);
      },
    });
    if (!ensureActiveRender()) {
      return;
    }

    const nodeOptions = safeArray(world.graph?.nodes).map((node) => ({
      id: text(node?.id),
      label: text(node?.label, text(node?.id)),
    }));
    const destinationOptions = safeArray(world.destinations).map((destination) => ({
      id: text(destination?.destinationId),
      label: destinationRouteLabel(app, world, destination),
    }));
    endpointSelection.fromDestinationId = text(destinationOptions[0]?.id);
    endpointSelection.toDestinationId = text(destinationOptions[1]?.id || destinationOptions[0]?.id);

    if (fromWorldNodeSelect) {
      fromWorldNodeSelect.innerHTML = selectOptionsMarkup(nodeOptions, nodeOptions[0]?.id);
      fromWorldNodeSelect.value = text(nodeOptions[0]?.id);
    }
    if (toWorldNodeSelect) {
      toWorldNodeSelect.innerHTML = selectOptionsMarkup(nodeOptions, nodeOptions[1]?.id || nodeOptions[0]?.id);
      toWorldNodeSelect.value = text(nodeOptions[1]?.id || nodeOptions[0]?.id);
    }
    if (fromDestinationSelect) {
      fromDestinationSelect.innerHTML = selectOptionsMarkup(
        destinationOptions,
        destinationOptions[0]?.id,
        copy.planner.endpointSummary.emptyOrigin,
      );
      fromDestinationSelect.value = text(destinationOptions[0]?.id);
    }
    if (toDestinationSelect) {
      toDestinationSelect.innerHTML = selectOptionsMarkup(
        destinationOptions,
        destinationOptions[1]?.id || destinationOptions[0]?.id,
        copy.planner.endpointSummary.emptyDestination,
      );
      toDestinationSelect.value = text(destinationOptions[1]?.id || destinationOptions[0]?.id);
    }

    setRouteFormEnabled(true);
    syncScopePanels();
    syncEndpointControls();
    clearWorldRoute();

    scopeSelect?.addEventListener("change", () => {
      syncScopePanels();
    });

    fromDestinationSelect?.addEventListener("change", () => {
      setRouteEndpoint("from", fromDestinationSelect.value);
    });

    toDestinationSelect?.addEventListener("change", () => {
      setRouteEndpoint("to", toDestinationSelect.value);
    });

    modeSelect?.addEventListener("change", () => {
      syncAdvancedWorldNodeControls();
      syncDestinationDetailPanel();
    });

    detailPanelHost?.addEventListener("click", (event) => {
      const originTarget = event.target?.closest?.("[data-world-route-set-origin]");
      const destinationTarget = event.target?.closest?.("[data-world-route-set-destination]");
      if (!originTarget && !destinationTarget) {
        return;
      }
      const originDestinationId = text(originTarget?.getAttribute("data-world-route-set-origin"));
      const targetDestinationId = text(destinationTarget?.getAttribute("data-world-route-set-destination"));
      if (originDestinationId) {
        setRouteEndpoint("from", originDestinationId);
      } else if (targetDestinationId) {
        setRouteEndpoint("to", targetDestinationId);
      }
    });

    routeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (disposed || !world) {
        return;
      }
      if (routeResult) {
        routeResult.innerHTML = worldRoutePendingMarkup();
      }
      try {
        const payload = buildWorldRoutePayload();
        const response = await app.requestJson("/api/world/routes/plan", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!isActiveRender()) {
          return;
        }
        if (disposed) {
          return;
        }
        const itinerary = response?.item;
        if (!isRecord(itinerary) || !Array.isArray(itinerary.legs) || !isRecord(itinerary.summary)) {
          throw new Error("World route payload is malformed.");
        }
        mapController?.renderRoute(itinerary);
        if (routeResult) {
          const localNodeLabelFor = await createLocalNodeLabelResolver(app, itinerary);
          if (!isActiveRender() || disposed) {
            return;
          }
          routeResult.innerHTML = worldRouteResultMarkup(app, world, itinerary, route, localNodeLabelFor);
        }
        app.setStatus(itinerary.reachable ? copy.status.routeReady : copy.status.routeIncomplete, itinerary.reachable ? "success" : "neutral");
      } catch (error) {
        if (!isActiveRender()) {
          return;
        }
        if (disposed) {
          return;
        }
        const message = copy.status.routeFailed;
        mapController?.renderRoute(null);
        if (routeResult) {
          routeResult.innerHTML = worldRouteFailureMarkup(message);
        }
        app.setStatus(message, "error");
      }
    });

    clearRouteButton?.addEventListener("click", () => {
      resetWorldRouteState();
    });

    app.setStatus(copy.status.mapReady, "success");
  } catch (error) {
    if (!ensureActiveRender()) {
      return;
    }
    const message = copy.status.mapLoadFailed;
    renderUnavailable(
      copy.unavailable.detailsTitle,
      copy.unavailable.loadFailedBody,
    );
    app.setStatus(message, "error");
  }

  return () => {
    disposed = true;
    destroyMountedMap();
  };
}
