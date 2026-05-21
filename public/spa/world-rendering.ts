// @ts-nocheck

import {
  appCopy,
  displayLabel,
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
  { fill: "rgba(217, 93, 30, 0.22)", stroke: "rgba(217, 93, 30, 0.68)" },
  { fill: "rgba(15, 118, 110, 0.22)", stroke: "rgba(15, 118, 110, 0.68)" },
  { fill: "rgba(84, 107, 66, 0.22)", stroke: "rgba(84, 107, 66, 0.68)" },
  { fill: "rgba(17, 32, 49, 0.18)", stroke: "rgba(17, 32, 49, 0.52)" },
];
const DESTINATION_MARKER_COLORS = {
  "campus-commons": "#d95d1e",
  "campus-research": "#0f766e",
  "campus-waterfront": "#2c6e91",
  "scenic-harbor": "#8b3a2b",
  "scenic-historic": "#7f5539",
  "scenic-lookout": "#546b42",
  "scenic-market": "#9a3412",
};
const WORLD_ROUTE_STRATEGIES = ["distance", "time", "mixed"];
const WORLD_ROUTE_MODES = ["walk", "bike", "shuttle", "mixed"];

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
    return 10;
  }
  return Math.max(8, Math.min(radius, 18));
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
function destinationLegLabel(leg) {
  const destinationId = text(leg?.destinationId, "destination");
  const localNodeIds = safeArray(leg?.localNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  return appCopy.worldMap.labels.destinationLeg(
    destinationId,
    localNodeIds[0],
    localNodeIds[localNodeIds.length - 1],
  );
}

/**
 * Summarizes the world leg using the first and last world-node ids.
 */
function worldLegLabel(leg) {
  const worldNodeIds = safeArray(leg?.worldNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  return appCopy.worldMap.labels.worldLeg(worldNodeIds[0], worldNodeIds[worldNodeIds.length - 1]);
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
 * Flattens itinerary steps into ordered explanation strings for the UI.
 */
function worldRouteExplanationSegments(itinerary) {
  const segments = [];
  safeArray(itinerary?.legs).forEach((leg, legIndex) => {
    safeArray(leg?.steps).forEach((step, stepIndex) => {
      const kind = text(step?.kind);
      const order = segments.length + 1;

      if (kind === "world-edge") {
        segments.push({
          kind,
          order,
          summary: worldEdgeSummary({
            ...step,
            order,
            edgeId: step?.edgeId ?? `world-edge-${legIndex}-${stepIndex}`,
          }),
        });
        return;
      }

      if (kind === "portal-transfer") {
        segments.push({
          kind,
          order,
          summary: portalTransferSummary({
            ...step,
            order,
            portalId: step?.portalId ?? `portal-transfer-${legIndex}-${stepIndex}`,
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
function worldRouteExplanationMarkup(itinerary) {
  const segments = worldRouteExplanationSegments(itinerary);
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
function worldRouteResultMarkup(itinerary, route) {
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
        return destinationLegLabel(leg);
      }
      if (text(leg?.scope) === "world") {
        return worldLegLabel(leg);
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
        ${worldRouteExplanationMarkup(itinerary)}
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
      color: styles.stroke,
      fillColor: styles.fill,
      fillOpacity: 0.92,
      interactive: false,
      weight: 2,
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      const regionId = text(region?.id);
      const idLabel = regionId ? displayWorldRegionLabel(regionId, "") : "";
      const tooltipLabel = idLabel && idLabel !== regionId ? idLabel : displayWorldRegionLabel(region?.name);
      layer.bindTooltip(tooltipLabel, { sticky: true });
    }
  });

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
    const layer = L.circleMarker([y, x], {
      color: "#112031",
      fillColor: markerColorFor(destination),
      fillOpacity: 0.96,
      radius: markerRadiusFor(destination),
      weight: 2,
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(destination?.label, destinationId), { direction: "top" });
    }

    if (destinationId && typeof layer.on === "function") {
      layer.on("click", () => {
        options.onDestinationSelect?.(destinationId);
      });
    }
  });

  let activeRouteLayer = null;

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
      lineCap: "round",
      lineJoin: "round",
      opacity: 0.92,
      weight: 5,
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
  const routeActor = resolveRouteActor(route);

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
      <article class="surface-card world-map-sidebar">
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
        <article class="surface-card route-stage-shell world-route-controls-shell">
          <p class="section-tag">${escapeHtml(copy.planner.tag)}</p>
          <h3>${escapeHtml(copy.planner.heading)}</h3>
          <form id="world-route-form" class="control-grid world-route-form">
            <label class="span-all">
              ${escapeHtml(copy.planner.labels.scope)}
              <select id="world-route-scope" data-route-world-scope-select="true">
                <option value="world-only">${escapeHtml(displayLabel(worldRouteScopeLabels, "world-only", copy.routeResult.handoffLinks.world))}</option>
                <option value="cross-map">${escapeHtml(displayLabel(worldRouteScopeLabels, "cross-map", "cross-map"))}</option>
              </select>
            </label>
            <div class="control-grid span-all world-route-scope-panel" data-route-world-scope-panel="world-only">
              <label>
                ${escapeHtml(copy.planner.labels.fromWorldNode)}
                <select id="world-route-from-world-node"></select>
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.toWorldNode)}
                <select id="world-route-to-world-node"></select>
              </label>
            </div>
            <div class="control-grid span-all world-route-scope-panel" data-route-world-scope-panel="cross-map" hidden>
              <label>
                ${escapeHtml(copy.planner.labels.fromDestination)}
                <select id="world-route-from-destination"></select>
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.toDestination)}
                <select id="world-route-to-destination"></select>
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.fromLocalNode)}
                <input id="world-route-from-local-node" type="text" placeholder="${escapeHtml(copy.planner.placeholders.localNode)}" />
              </label>
              <label>
                ${escapeHtml(copy.planner.labels.toLocalNode)}
                <input id="world-route-to-local-node" type="text" placeholder="${escapeHtml(copy.planner.placeholders.localNode)}" />
              </label>
            </div>
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
      </article>
      <div id="world-map-stage">
        <article class="surface-card world-map-shell">
          <div class="world-map-frame">
            <div id="world-map-canvas" class="world-map-canvas" aria-label="${escapeHtml(copy.planner.ariaLabel)}"></div>
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
  const scopePanels = Array.from(root.querySelectorAll("[data-route-world-scope-panel]"));
  let disposed = false;
  let mapController = null;
  let world = null;
  let routeFormEnabled = false;
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

  function selectOptionsMarkup(options, selectedValue) {
    const list = [];
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

  function buildWorldRoutePayload() {
    const scope = text(scopeSelect?.value, "world-only") === "cross-map" ? "cross-map" : "world-only";
    const strategy = text(strategySelect?.value, "distance");
    const mode = text(modeSelect?.value, "walk");

    if (scope === "cross-map") {
      const payload = {
        scope,
        fromDestinationId: text(fromDestinationSelect?.value),
        toDestinationId: text(toDestinationSelect?.value),
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

    return {
      scope,
      fromWorldNodeId: text(fromWorldNodeSelect?.value),
      toWorldNodeId: text(toWorldNodeSelect?.value),
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
        const params = routeActor ? { actor: routeActor, destinationId } : { destinationId };
        app.navigate(app.buildMapHref(params));
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
      label: text(destination?.label, text(destination?.destinationId)),
    }));

    if (fromWorldNodeSelect) {
      fromWorldNodeSelect.innerHTML = selectOptionsMarkup(nodeOptions, nodeOptions[0]?.id);
      fromWorldNodeSelect.value = text(nodeOptions[0]?.id);
    }
    if (toWorldNodeSelect) {
      toWorldNodeSelect.innerHTML = selectOptionsMarkup(nodeOptions, nodeOptions[1]?.id || nodeOptions[0]?.id);
      toWorldNodeSelect.value = text(nodeOptions[1]?.id || nodeOptions[0]?.id);
    }
    if (fromDestinationSelect) {
      fromDestinationSelect.innerHTML = selectOptionsMarkup(destinationOptions, destinationOptions[0]?.id);
      fromDestinationSelect.value = text(destinationOptions[0]?.id);
    }
    if (toDestinationSelect) {
      toDestinationSelect.innerHTML = selectOptionsMarkup(
        destinationOptions,
        destinationOptions[1]?.id || destinationOptions[0]?.id,
      );
      toDestinationSelect.value = text(destinationOptions[1]?.id || destinationOptions[0]?.id);
    }

    setRouteFormEnabled(true);
    syncScopePanels();
    clearWorldRoute();

    scopeSelect?.addEventListener("change", () => {
      syncScopePanels();
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
          routeResult.innerHTML = worldRouteResultMarkup(itinerary, route);
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
      clearWorldRoute();
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
