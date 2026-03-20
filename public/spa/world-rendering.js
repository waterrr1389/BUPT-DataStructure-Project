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

function hasLeafletApi(candidate) {
  return Boolean(candidate && candidate.CRS?.Simple && typeof candidate.map === "function");
}

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

function extractWorld(payload) {
  if (payload && typeof payload === "object" && payload.world && typeof payload.world === "object") {
    return payload.world;
  }
  return payload;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function regionStyleAt(index) {
  return REGION_STYLES[index % REGION_STYLES.length];
}

function markerColorFor(destination) {
  return DESTINATION_MARKER_COLORS[text(destination?.iconType)] || "#d95d1e";
}

function markerRadiusFor(destination) {
  const radius = toFiniteNumber(destination?.radius);
  if (radius == null) {
    return 10;
  }
  return Math.max(8, Math.min(radius, 18));
}

function isCoordinateWithinBounds(x, y, width, height) {
  return x >= 0 && x <= width && y >= 0 && y <= height;
}

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
    if (distance == null || distance <= 0) {
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

function itineraryScopeLabel(scope) {
  return scope === "cross-map" ? "Cross-map itinerary" : "World-only itinerary";
}

function destinationLegLabel(leg) {
  const destinationId = text(leg?.destinationId, "destination");
  const localNodeIds = safeArray(leg?.localNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  const fromNode = localNodeIds[0] || "origin";
  const toNode = localNodeIds[localNodeIds.length - 1] || "destination";
  return `${destinationId}: ${fromNode} -> ${toNode}`;
}

function worldLegLabel(leg) {
  const worldNodeIds = safeArray(leg?.worldNodeIds).map((nodeId) => text(nodeId)).filter(Boolean);
  const fromNode = worldNodeIds[0] || "origin";
  const toNode = worldNodeIds[worldNodeIds.length - 1] || "destination";
  return `world: ${fromNode} -> ${toNode}`;
}

function itineraryFailureSummary(itinerary) {
  const failure = itinerary?.failure;
  if (!isRecord(failure)) {
    return "";
  }
  const stage = text(failure.stage).replaceAll("-", " ");
  const reason = text(failure.reason).replaceAll("_", " ");
  const code = text(failure.code).replaceAll("_", " ");
  const blockedFrom = text(failure.blockedFrom);
  const blockedTo = text(failure.blockedTo);
  const blockedSegment = blockedFrom && blockedTo ? ` (${blockedFrom} -> ${blockedTo})` : "";
  return `${stage || "route stage"} blocked due to ${reason || "routing constraints"} [${code || "unknown"}]${blockedSegment}.`;
}

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

function worldRouteExplanationSegments(itinerary) {
  const segments = [];
  safeArray(itinerary?.legs).forEach((leg, legIndex) => {
    safeArray(leg?.steps).forEach((step, stepIndex) => {
      const kind = text(step?.kind);
      const order = segments.length + 1;

      if (kind === "world-edge") {
        const edgeId = text(step?.edgeId, `world-edge-${legIndex}-${stepIndex}`);
        const fromWorldNodeId = text(step?.fromWorldNodeId, "unknown-world-node");
        const toWorldNodeId = text(step?.toWorldNodeId, "unknown-world-node");
        const roadType = text(step?.roadType, "unknown-road").replaceAll("-", " ");
        const mode = text(step?.mode, "unknown-mode");
        const distance = formatMetricValue(step?.distance);
        const cost = formatMetricValue(step?.cost);
        segments.push({
          kind,
          order,
          summary: `Segment ${order} · world edge ${edgeId}: ${fromWorldNodeId} -> ${toWorldNodeId} · roadType ${roadType} · mode ${mode} · distance ${distance} m · cost ${cost}`,
        });
        return;
      }

      if (kind === "portal-transfer") {
        const portalId = text(step?.portalId, `portal-transfer-${legIndex}-${stepIndex}`);
        const destinationId = text(step?.destinationId, "unknown-destination");
        const transferDirection = text(step?.transferDirection, "unknown-direction");
        const localNodeId = text(step?.localNodeId, "unknown-local-node");
        const worldNodeId = text(step?.worldNodeId, "unknown-world-node");
        const fromEndpoint = transferDirection === "world-to-local" ? worldNodeId : localNodeId;
        const toEndpoint = transferDirection === "world-to-local" ? localNodeId : worldNodeId;
        const mode = text(step?.mode, "unknown-mode");
        const transferDistance = formatMetricValue(step?.transferDistance);
        const transferCost = formatMetricValue(step?.transferCost);
        const distance = formatMetricValue(step?.distance);
        const cost = formatMetricValue(step?.cost);
        segments.push({
          kind,
          order,
          summary: `Segment ${order} · portal transfer ${portalId}: ${fromEndpoint} -> ${toEndpoint} · destination ${destinationId} · direction ${transferDirection} · mode ${mode} · transfer ${transferDistance} m · transfer cost ${transferCost} · distance ${distance} m · cost ${cost}`,
        });
      }
    });
  });
  return segments;
}

function worldRouteExplanationMarkup(itinerary) {
  const segments = worldRouteExplanationSegments(itinerary);
  if (!segments.length) {
    return `
      <p class="muted" data-route-world-explanation-empty="true">
        No portal-transfer or world-edge steps were returned for explanation.
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

function worldRoutePendingMarkup() {
  return `
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="pending">
      <p class="section-tag">World route</p>
      <h3>Planning route</h3>
      <p class="muted">Requesting itinerary details from world routing.</p>
    </article>
  `;
}

function worldRouteEmptyMarkup() {
  return `
    <div class="world-route-result-shell">
      ${emptyStateMarkup({
        body: "Choose world nodes or destinations, then plan a route to render a world itinerary.",
        title: "World route summary appears after planning",
      })}
    </div>
  `;
}

function worldRouteFailureMarkup(message) {
  return `
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="error">
      <p class="section-tag">World route</p>
      <h3>Route planning failed</h3>
      <p>${escapeHtml(text(message, "World route planning failed."))}</p>
    </article>
  `;
}

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
  const itineraryStatus = itinerary?.reachable ? "Route ready to follow." : "Route returned an incomplete itinerary.";
  const failureSummary = itinerary?.reachable ? "" : itineraryFailureSummary(itinerary);

  return `
    <article
      class="surface-card route-summary-card route-stage-shell"
      data-route-world-result-state="${escapeHtml(summaryTone)}"
      data-route-world-scope="${escapeHtml(text(itinerary?.scope, "world-only"))}"
    >
      <p class="section-tag">World route</p>
      <h3>${escapeHtml(itineraryScopeLabel(text(itinerary?.scope)))}</h3>
      ${resultMetaMarkup([
        text(itinerary?.strategy, "distance"),
        text(itinerary?.mode, "walk"),
        `${formatMetricValue(itinerary?.totalDistance)} m`,
        `cost ${formatMetricValue(itinerary?.totalCost)}`,
      ])}
      <p>${escapeHtml(itineraryStatus)}</p>
      ${
        failureSummary
          ? `<p class="muted" data-route-world-failure="true">${escapeHtml(failureSummary)}</p>`
          : `<p class="muted">Destination ${formatMetricValue(summary?.destinationDistance)} m · world ${formatMetricValue(summary?.worldDistance)} m · transfer ${formatMetricValue(summary?.transferDistance)} m.</p>`
      }
    </article>
    <article class="surface-card route-summary-card route-stage-shell" data-route-world-result-state="details">
      <p class="section-tag">Route handoff</p>
      <h3>Local and world continuity</h3>
      <div class="world-route-handoff-links" data-route-handoff-chain="local-world-local">
        ${
          fromLocalHref
            ? `<a href="${fromLocalHref}" data-nav="true" data-route-handoff="local-origin">Origin local map</a>`
            : `<span data-route-handoff="local-origin">Origin local map unavailable</span>`
        }
        <a href="${worldViewHref}" data-nav="true" data-route-handoff="world">World map</a>
        ${
          toLocalHref
            ? `<a href="${toLocalHref}" data-nav="true" data-route-handoff="local-destination">Destination local map</a>`
            : `<span data-route-handoff="local-destination">Destination local map unavailable</span>`
        }
      </div>
      <div class="tag-row">
        ${
          legTags.length
            ? legTags.map((label) => `<span class="tag" data-route-world-leg="true">${escapeHtml(label)}</span>`).join("")
            : "<span class='tag'>No route legs returned.</span>"
        }
      </div>
      <div class="world-route-explanation-shell">
        <p class="section-tag">Route explanation</p>
        <h4>Ordered itinerary segments</h4>
        ${worldRouteExplanationMarkup(itinerary)}
      </div>
    </article>
  `;
}

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
      layer.bindTooltip(text(region?.name, "Region"), { sticky: true });
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

function worldMetaMarkup(summary, world) {
  const worldName = escapeHtml(text(world?.name || summary?.world?.name, "World Surface"));
  const regionCount = safeArray(world?.regions).length || safeArray(summary?.regions).length;
  const destinationCount =
    safeArray(world?.destinations).length || safeArray(summary?.destinations).length;

  return `
    <div class="world-map-meta">
      <div>
        <span class="section-tag">World</span>
        <strong>${worldName}</strong>
      </div>
      <div>
        <span class="section-tag">Regions</span>
        <strong>${regionCount}</strong>
      </div>
      <div>
        <span class="section-tag">Destinations</span>
        <strong>${destinationCount}</strong>
      </div>
    </div>
  `;
}

function worldUnavailableMarkup(title, body, route) {
  return `
    <article class="surface-card world-map-shell world-map-shell-unavailable">
      ${emptyStateMarkup({
        actionHref: createRouteContextHref("/explore", {}, route),
        actionLabel: "Return to Explore",
        body,
        title,
      })}
    </article>
  `;
}

export async function renderWorldMapView(app, route, root) {
  app.setDocumentTitle("World Map");

  const returnToExploreHref = createRouteContextHref("/explore", {}, route);
  const routeActor = resolveRouteActor(route);

  root.innerHTML = `
    <section class="route-hero route-hero-map world-route-hero">
      <div class="route-hero-copy">
        <p class="eyebrow">World Map</p>
        <h1>Browse and plan world routes without leaving the journal SPA.</h1>
        <p class="route-lede">
          Inspect regions, plan world itineraries, and jump into destination maps when you need local routing detail.
        </p>
        <div class="hero-actions">
          <a class="inline-link" href="${returnToExploreHref}" data-nav="true">Return to Explore</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">World view</p>
        <ul class="hero-list">
          <li>Background art, regions, and destination markers render in Leaflet with CRS.Simple.</li>
          <li>World route planning supports world-only and cross-map request scopes.</li>
          <li>Destination marker selection still opens the local destination map.</li>
        </ul>
      </div>
    </section>

    <section class="world-map-layout">
      <article class="surface-card world-map-sidebar">
        <div class="section-head">
          <div>
            <p class="section-tag">Surface mode</p>
            <h2>World routing surface</h2>
          </div>
        </div>
        <p class="world-map-copy">
          Destination clicks keep actor context and open local maps. Route planning keeps world mode active and adds local/world/local handoff links.
        </p>
        <div id="world-map-meta">
          ${worldMetaMarkup(null, null)}
        </div>
        <article class="surface-card route-stage-shell world-route-controls-shell">
          <p class="section-tag">World routing</p>
          <h3>Plan itinerary</h3>
          <form id="world-route-form" class="control-grid world-route-form">
            <label class="span-all">
              Scope
              <select id="world-route-scope" data-route-world-scope-select="true">
                <option value="world-only">world-only</option>
                <option value="cross-map">cross-map</option>
              </select>
            </label>
            <div class="control-grid span-all world-route-scope-panel" data-route-world-scope-panel="world-only">
              <label>
                From world node
                <select id="world-route-from-world-node"></select>
              </label>
              <label>
                To world node
                <select id="world-route-to-world-node"></select>
              </label>
            </div>
            <div class="control-grid span-all world-route-scope-panel" data-route-world-scope-panel="cross-map" hidden>
              <label>
                From destination
                <select id="world-route-from-destination"></select>
              </label>
              <label>
                To destination
                <select id="world-route-to-destination"></select>
              </label>
              <label>
                Optional from local node
                <input id="world-route-from-local-node" type="text" placeholder="local node id" />
              </label>
              <label>
                Optional to local node
                <input id="world-route-to-local-node" type="text" placeholder="local node id" />
              </label>
            </div>
            <div class="control-grid span-all">
              <label>
                Strategy
                <select id="world-route-strategy">
                  ${WORLD_ROUTE_STRATEGIES.map((strategy) => `<option value="${escapeHtml(strategy)}">${escapeHtml(strategy)}</option>`).join("")}
                </select>
              </label>
              <label>
                Mode
                <select id="world-route-mode">
                  ${WORLD_ROUTE_MODES.map((mode) => `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="button-row span-all">
              <button type="submit" data-route-world-submit="true">Plan world route</button>
              <button type="button" id="world-route-reset" class="ghost">Clear world route</button>
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
            <div id="world-map-canvas" class="world-map-canvas" aria-label="World map"></div>
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
      routeResult.innerHTML = worldRouteFailureMarkup("World route controls are unavailable.");
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
    if (disposed) {
      return () => {};
    }

    if (summary?.enabled !== true) {
      if (meta) {
        meta.innerHTML = worldMetaMarkup(summary, null);
      }
      renderUnavailable(
        "World map unavailable",
        "World mode is not enabled by the backend worker in this workspace.",
      );
      app.setStatus("World mode is unavailable.", "neutral");
      return () => {};
    }

    const detailsPayload = await app.requestJson("/api/world/details");
    if (disposed) {
      return () => {};
    }

    world = extractWorld(detailsPayload);
    const issues = collectWorldDetailsIssues(world);
    if (issues.length > 0) {
      renderUnavailable(
        "World details unavailable",
        "World details payload failed validation. Check world bounds, polygons, markers, and route graph data.",
      );
      app.setStatus(`World details are malformed: ${issues[0]}`, "error");
      return () => {};
    }

    if (!world) {
      renderUnavailable(
        "World details unavailable",
        "The world surface is enabled, but detailed map data is missing.",
      );
      app.setStatus("World details are unavailable.", "error");
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
        app.setStatus(itinerary.reachable ? "World route ready." : "World route returned an incomplete itinerary.", itinerary.reachable ? "success" : "neutral");
      } catch (error) {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : "World route planning failed.";
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

    app.setStatus("World surface ready.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "World map failed to load.";
    renderUnavailable(
      "World details unavailable",
      "The world surface could not be prepared. Check the worker endpoints and try again.",
    );
    app.setStatus(message, "error");
  }

  return () => {
    disposed = true;
    mapController?.destroy();
  };
}
