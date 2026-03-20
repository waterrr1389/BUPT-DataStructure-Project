import { escapeHtml, resultMetaMarkup, safeArray, summarizeSteps, text } from "./lib.js";

const MAP_CANVAS = {
  width: 860,
  height: 540,
  padding: 58,
};

const ROAD_TYPE_META = {
  walkway: { label: "Walkway", className: "is-walkway" },
  "bike-lane": { label: "Bike lane", className: "is-bike-lane" },
  "shuttle-lane": { label: "Shuttle lane", className: "is-shuttle-lane" },
  indoor: { label: "Indoor corridor", className: "is-indoor" },
};

const ROUTE_PATH_SEMANTICS = {
  walkway: { legendLabel: "Outdoor route", semanticKey: "outdoor-route" },
  indoor: { legendLabel: "Indoor route", semanticKey: "indoor-route" },
  "bike-lane": { legendLabel: "Bike lane", semanticKey: "bike-lane" },
  "shuttle-lane": { legendLabel: "Shuttle lane", semanticKey: "shuttle-lane" },
};

const ROUTE_PATH_ORDER = ["walkway", "indoor", "bike-lane", "shuttle-lane"];
const ACTIVE_MARKER_LEGEND_ORDER = ["transition", "turn", "start", "end"];
const PREVIEW_MARKER_LEGEND_ORDER = ["preview-start", "preview-end"];

const markerHelpers = globalThis.RouteVisualizationMarkers;

if (
  !markerHelpers ||
  typeof markerHelpers.createPreviewMarkers !== "function" ||
  typeof markerHelpers.createRouteMarkerLayout !== "function"
) {
  throw new Error("Route visualization helpers failed to load.");
}

const { createPreviewMarkers, createRouteMarkerLayout } = markerHelpers;

function edgeKey(left, right) {
  return [left, right].sort().join("::");
}

function getRoadTypeMeta(roadType) {
  return ROAD_TYPE_META[roadType] || ROAD_TYPE_META.walkway;
}

function getNodeEnvironment(node) {
  if (!node) {
    return "outdoor";
  }
  return node.floor > 0 || node.kind === "room" || node.kind === "elevator" ? "indoor" : "outdoor";
}

function createGraphProjection(nodes) {
  const xValues = nodes.map((node) => node.x);
  const yValues = nodes.map((node) => node.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const innerWidth = MAP_CANVAS.width - MAP_CANVAS.padding * 2;
  const innerHeight = MAP_CANVAS.height - MAP_CANVAS.padding * 2;
  const scale = Math.min(innerWidth / width, innerHeight / height);
  const offsetX = (MAP_CANVAS.width - width * scale) / 2;
  const offsetY = (MAP_CANVAS.height - height * scale) / 2;

  return {
    point(node) {
      return {
        x: offsetX + (node.x - minX) * scale,
        y: offsetY + (node.y - minY) * scale,
      };
    },
  };
}

function createBounds(nodes, projection, padding = 22) {
  if (!nodes.length) {
    return null;
  }
  const points = nodes.map((node) => projection.point(node));
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - padding);
  const maxX = Math.min(MAP_CANVAS.width, Math.max(...points.map((point) => point.x)) + padding);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - padding);
  const maxY = Math.min(MAP_CANVAS.height, Math.max(...points.map((point) => point.y)) + padding);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function createBuildingOverlays(details, projection) {
  const buildingById = new Map(safeArray(details?.buildings).map((building) => [building.id, building]));
  const grouped = new Map();

  safeArray(details?.graph?.nodes).forEach((node) => {
    if (!node.buildingId) {
      return;
    }
    if (!grouped.has(node.buildingId)) {
      grouped.set(node.buildingId, []);
    }
    grouped.get(node.buildingId).push(node);
  });

  return Array.from(grouped.entries())
    .map(([buildingId, nodes]) => {
      const bounds = createBounds(nodes, projection, 26);
      if (!bounds) {
        return null;
      }
      return {
        bounds,
        building: buildingById.get(buildingId),
      };
    })
    .filter(Boolean);
}

export function createRouteLookups(details) {
  return {
    edgeById: new Map(safeArray(details?.graph?.edges).map((edge) => [edge.id, edge])),
    edgeByPair: new Map(
      safeArray(details?.graph?.edges).map((edge) => [edgeKey(edge.from, edge.to), edge]),
    ),
    nodeById: new Map(safeArray(details?.graph?.nodes).map((node) => [node.id, node])),
  };
}

export function resolveRouteEdge(step, lookups) {
  return lookups.edgeById.get(step.edgeId) || lookups.edgeByPair.get(edgeKey(step.from, step.to)) || null;
}

function turnAngle(previousNode, currentNode, nextNode) {
  const fromX = previousNode.x - currentNode.x;
  const fromY = previousNode.y - currentNode.y;
  const toX = nextNode.x - currentNode.x;
  const toY = nextNode.y - currentNode.y;
  const fromMagnitude = Math.hypot(fromX, fromY);
  const toMagnitude = Math.hypot(toX, toY);

  if (!fromMagnitude || !toMagnitude) {
    return 180;
  }

  const cosine = (fromX * toX + fromY * toY) / (fromMagnitude * toMagnitude);
  const bounded = Math.min(1, Math.max(-1, cosine));
  return Math.round((Math.acos(bounded) * 180) / Math.PI);
}

function analyzeRoute(details, route) {
  if (!route || !route.reachable || safeArray(route.nodeIds).length === 0) {
    return null;
  }

  const lookups = createRouteLookups(details);
  const routeNodes = safeArray(route.nodeIds)
    .map((nodeId) => lookups.nodeById.get(nodeId))
    .filter(Boolean);
  const stepDetails = safeArray(route.steps)
    .map((step) => ({
      ...step,
      edge: resolveRouteEdge(step, lookups),
      fromNode: lookups.nodeById.get(step.from),
      toNode: lookups.nodeById.get(step.to),
    }))
    .filter((step) => step.fromNode && step.toNode);

  const transitionMarkers = [];
  let currentEnvironment = getNodeEnvironment(routeNodes[0]);

  stepDetails.forEach((step) => {
    const nextEnvironment = step.edge?.roadType === "indoor" ? "indoor" : "outdoor";
    if (nextEnvironment !== currentEnvironment) {
      transitionMarkers.push({
        node: step.fromNode,
        shortLabel: nextEnvironment === "indoor" ? "Indoor" : "Outdoor",
        label: nextEnvironment === "indoor" ? "Indoor entry" : "Open-air return",
      });
    }
    currentEnvironment = nextEnvironment;
  });

  const transitionNodeIds = new Set(transitionMarkers.map((marker) => marker.node.id));
  const turnMarkers = [];

  for (let index = 1; index < routeNodes.length - 1; index += 1) {
    const previousNode = routeNodes[index - 1];
    const currentNode = routeNodes[index];
    const nextNode = routeNodes[index + 1];
    const enteringStep = stepDetails[index - 1];
    const leavingStep = stepDetails[index];
    const angle = turnAngle(previousNode, currentNode, nextNode);
    const floorChange = previousNode.floor !== currentNode.floor || currentNode.floor !== nextNode.floor;
    const roadTypeChange =
      enteringStep?.edge?.roadType &&
      leavingStep?.edge?.roadType &&
      enteringStep.edge.roadType !== leavingStep.edge.roadType;
    const modeChange = enteringStep?.mode && leavingStep?.mode && enteringStep.mode !== leavingStep.mode;
    const isKeyTurn = angle < 150 || floorChange || roadTypeChange || modeChange;

    if (!isKeyTurn || transitionNodeIds.has(currentNode.id)) {
      continue;
    }

    let label = "Turn";
    if (floorChange) {
      label = `Level ${currentNode.floor}`;
    } else if (roadTypeChange && leavingStep?.edge) {
      label = getRoadTypeMeta(leavingStep.edge.roadType).label;
    } else if (modeChange && leavingStep?.mode) {
      label = leavingStep.mode;
    }

    turnMarkers.push({
      angle,
      label,
      node: currentNode,
      shortLabel: floorChange ? `L${currentNode.floor}` : "Turn",
    });
  }

  return {
    lookups,
    routeNodes,
    stepDetails,
    transitionMarkers,
    turnMarkers,
  };
}

function pillLabelMarkup(point, label, variantClass) {
  const safeLabel = escapeHtml(label);
  const width = Math.max(54, text(label).length * 7 + 18);
  const x = point.x > MAP_CANVAS.width - 150 ? point.x - width - 14 : point.x + 14;
  const verticalOffset = variantClass === "is-transition" || variantClass === "is-turn" ? 10 : -32;
  const y = Math.min(MAP_CANVAS.height - 34, Math.max(10, point.y + verticalOffset));
  return `
    <g class="map-pill ${escapeHtml(variantClass)}" transform="translate(${x} ${y})">
      <rect width="${width}" height="24" rx="12"></rect>
      <text x="${width / 2}" y="16" text-anchor="middle">${safeLabel}</text>
    </g>
  `;
}

function legendPillMarkup(label, variantClass) {
  const safeLabel = escapeHtml(label);
  const width = Math.max(38, text(label).length * 6 + 16);
  return `
    <g class="map-pill ${escapeHtml(variantClass)}" transform="translate(28 6)">
      <rect width="${width}" height="24" rx="12"></rect>
      <text x="${width / 2}" y="16" text-anchor="middle">${safeLabel}</text>
    </g>
  `;
}

function routeMarkerShapeMarkup(marker, point = marker.point) {
  if (marker.kind === "start") {
    return `<circle class="route-marker route-marker-start" cx="${point.x}" cy="${point.y}" r="11"></circle>`;
  }
  if (marker.kind === "end") {
    return `<rect class="route-marker route-marker-end" x="${point.x - 10}" y="${point.y - 10}" width="20" height="20" rx="6"></rect>`;
  }
  if (marker.kind === "transition") {
    return `<path class="route-marker route-marker-transition" d="M ${point.x} ${point.y - 12} L ${point.x + 11} ${point.y + 8} L ${point.x - 11} ${point.y + 8} Z"></path>`;
  }
  if (marker.kind === "preview-start" || marker.kind === "preview-end") {
    return `<circle class="route-marker route-marker-${marker.kind}" cx="${point.x}" cy="${point.y}" r="10"></circle>`;
  }
  return `<rect class="route-marker route-marker-turn" x="${point.x - 7}" y="${point.y - 7}" width="14" height="14" rx="4" transform="rotate(45 ${point.x} ${point.y})"></rect>`;
}

function routeMarkerMarkup(marker) {
  return `
    <g
      class="route-marker-group ${escapeHtml(marker.variantClass)}"
      data-route-marker-kind="${escapeHtml(marker.kind)}"
      data-route-marker-semantic="${escapeHtml(marker.semanticKey || marker.kind)}"
      data-route-marker-state="${escapeHtml(marker.state || "active-route")}"
    >
      ${routeMarkerShapeMarkup(marker)}
      ${pillLabelMarkup(marker.point, marker.label, marker.variantClass)}
    </g>
  `;
}

function markerLayoutToList(markerLayout) {
  return [...markerLayout.endpointMarkers, ...markerLayout.transitionMarkers, ...markerLayout.turnMarkers];
}

function activeRouteMarkerMarkup(markerLayout) {
  return markerLayoutToList(markerLayout)
    .map((marker) => routeMarkerMarkup(marker))
    .join("");
}

function previewRouteMarkerMarkup(previewMarkers) {
  return previewMarkers
    .map((marker) => routeMarkerMarkup(marker))
    .join("");
}

function routePathLegendIconMarkup(roadType) {
  const roadTypeMeta = getRoadTypeMeta(roadType);
  return `
    <svg class="route-legend-icon route-legend-icon-path" viewBox="0 0 56 18" width="56" height="18" aria-hidden="true" data-route-path-type="${escapeHtml(roadType)}">
      <line class="route-segment route-segment-halo" x1="6" y1="9" x2="50" y2="9"></line>
      <line class="route-segment route-segment-line ${escapeHtml(roadTypeMeta.className)}" x1="6" y1="9" x2="50" y2="9"></line>
    </svg>
  `;
}

function routeMarkerLegendIconMarkup(marker) {
  return `
    <svg
      class="route-legend-icon route-legend-icon-marker"
      viewBox="0 0 96 36"
      width="96"
      height="36"
      aria-hidden="true"
      data-route-marker-kind="${escapeHtml(marker.kind)}"
      data-route-marker-semantic="${escapeHtml(marker.semanticKey || marker.kind)}"
      data-route-marker-state="${escapeHtml(marker.state || "active-route")}"
    >
      ${routeMarkerShapeMarkup(marker, { x: 14, y: 18 })}
      ${legendPillMarkup(marker.legendBadgeLabel || marker.label, marker.variantClass)}
    </svg>
  `;
}

function routeLegendItemMarkup(item) {
  return `
    <span
      class="route-legend-item"
      data-route-legend-key="${escapeHtml(item.semanticKey)}"
      data-route-legend-type="${escapeHtml(item.type)}"
      data-route-legend-state="${escapeHtml(item.state)}"
    >
      ${item.iconMarkup}
      ${escapeHtml(item.label)}
    </span>
  `;
}

function buildRouteLegendItems(routeAnalysis, markerLayout, previewMarkers) {
  if (routeAnalysis) {
    const renderedRoadTypes = new Set(
      routeAnalysis.stepDetails.map((step) => step.edge?.roadType || "walkway"),
    );
    const activeMarkerSamples = new Map([
      ["transition", markerLayout.transitionMarkers[0] || null],
      ["turn", markerLayout.turnMarkers[0] || null],
      ["start", markerLayout.endpointMarkers.find((marker) => marker.kind === "start") || null],
      ["end", markerLayout.endpointMarkers.find((marker) => marker.kind === "end") || null],
    ]);

    return [
      ...ROUTE_PATH_ORDER.filter((roadType) => renderedRoadTypes.has(roadType)).map((roadType) => ({
        iconMarkup: routePathLegendIconMarkup(roadType),
        label: ROUTE_PATH_SEMANTICS[roadType].legendLabel,
        semanticKey: ROUTE_PATH_SEMANTICS[roadType].semanticKey,
        state: "active-route",
        type: "path",
      })),
      ...ACTIVE_MARKER_LEGEND_ORDER.map((kind) => activeMarkerSamples.get(kind))
        .filter(Boolean)
        .map((marker) => ({
          iconMarkup: routeMarkerLegendIconMarkup(marker),
          label: marker.legendLabel,
          semanticKey: marker.semanticKey || marker.kind,
          state: marker.state || "active-route",
          type: "marker",
        })),
    ];
  }

  return PREVIEW_MARKER_LEGEND_ORDER.map((kind) => previewMarkers.find((marker) => marker.kind === kind))
    .filter(Boolean)
    .map((marker) => ({
      iconMarkup: routeMarkerLegendIconMarkup(marker),
      label: marker.legendLabel,
      semanticKey: marker.semanticKey || marker.kind,
      state: marker.state || "preview",
      type: "marker",
    }));
}

function createScene(details) {
  const projection = createGraphProjection(safeArray(details?.graph?.nodes));
  const lookups = createRouteLookups(details);

  return {
    projection,
    lookups,
    outdoorBounds: createBounds(
      safeArray(details?.graph?.nodes).filter((node) => getNodeEnvironment(node) === "outdoor"),
      projection,
      36,
    ),
    buildingOverlays: createBuildingOverlays(details, projection),
    nodeOptions: safeArray(details?.graph?.nodes).map((node) => ({
      id: node.id,
      name: `${node.name} (${node.id.split("-").slice(-1)[0]})`,
    })),
  };
}

export function getDestinationScene(cache, destinationId, details) {
  if (!destinationId || !details) {
    return null;
  }
  if (cache.has(destinationId)) {
    return cache.get(destinationId);
  }
  const scene = createScene(details);
  cache.set(destinationId, scene);
  return scene;
}

export function renderRouteVisualization(options) {
  const details = options?.details;
  const route = options?.route || null;
  const previewStartId = options?.previewStartId || "";
  const previewEndId = options?.previewEndId || "";
  const scene = options?.scene;

  if (!details || !scene) {
    return "";
  }

  const { projection, lookups, outdoorBounds, buildingOverlays } = scene;
  const routeAnalysis = analyzeRoute(details, route);
  const activeMarkerLayout = routeAnalysis ? createRouteMarkerLayout(routeAnalysis, projection) : null;
  const routeNodeSet = new Set(routeAnalysis ? routeAnalysis.routeNodes.map((node) => node.id) : []);
  const previewStart = !routeAnalysis ? lookups.nodeById.get(previewStartId) : null;
  const previewEnd = !routeAnalysis ? lookups.nodeById.get(previewEndId) : null;
  const previewMarkers = !routeAnalysis
    ? createPreviewMarkers({ endNode: previewEnd, startNode: previewStart }, projection)
    : [];
  const legendItems = buildRouteLegendItems(routeAnalysis, activeMarkerLayout, previewMarkers);
  const routeDistance = routeAnalysis
    ? `${route.totalDistance} m highlighted`
    : route?.reachable === false
      ? "No reachable path"
      : "Map preview available";
  const routeNote = routeAnalysis
    ? `${routeAnalysis.turnMarkers.length} direction or route changes, ${routeAnalysis.transitionMarkers.length} indoor or outdoor transitions, ${route.totalDistance} m total.`
    : route?.reachable === false
      ? "The routing tool could not connect the selected nodes with the current settings. The map stays visible so you can adjust the start or end point."
      : previewStart && previewEnd
        ? `Previewing ${text(previewStart.name)} to ${text(previewEnd.name)}. Click "Plan route" to draw that path on the map.`
        : "Select start and end nodes, then plan a route to highlight it on the destination map.";

  const routeCueMarkup =
    routeAnalysis && (routeAnalysis.transitionMarkers.length > 0 || routeAnalysis.turnMarkers.length > 0)
      ? `<div class="route-cue-row">
          ${routeAnalysis.transitionMarkers
            .map((marker) => `<span class="route-cue">${escapeHtml(marker.label)}: ${escapeHtml(marker.node.name)}</span>`)
            .join("")}
          ${routeAnalysis.turnMarkers
            .map((marker) => `<span class="route-cue">${escapeHtml(marker.label)}: ${escapeHtml(marker.node.name)}</span>`)
            .join("")}
        </div>`
      : "";

  return `
    <article class="map-stage-card">
      <div class="map-stage-head">
        <div>
          <p class="section-tag">Spatial context</p>
          <h2>${escapeHtml(details.name)}</h2>
        </div>
        ${resultMetaMarkup(
          [
            `${safeArray(details.graph?.nodes).length} nodes`,
            `${safeArray(details.graph?.edges).length} links`,
            `${safeArray(details.buildings).length} buildings`,
            routeDistance,
          ],
          "result-meta map-stage-meta",
        )}
      </div>
      <div class="route-map-frame">
        <svg class="route-map" viewBox="0 0 ${MAP_CANVAS.width} ${MAP_CANVAS.height}" role="img" aria-label="Map view for ${escapeHtml(details.name)}">
          <defs>
            <pattern id="route-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" class="map-grid-line"></path>
            </pattern>
          </defs>
          <rect class="map-canvas" x="0" y="0" width="${MAP_CANVAS.width}" height="${MAP_CANVAS.height}" rx="34"></rect>
          <rect class="map-grid" x="0" y="0" width="${MAP_CANVAS.width}" height="${MAP_CANVAS.height}" rx="34"></rect>
          ${
            outdoorBounds
              ? `<rect class="map-outdoor-zone" x="${outdoorBounds.x}" y="${outdoorBounds.y}" width="${outdoorBounds.width}" height="${outdoorBounds.height}" rx="42"></rect>`
              : ""
          }
          ${buildingOverlays
            .map(
              ({ bounds, building }) => `
                <g class="map-building-group">
                  <rect class="map-building-zone" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="28"></rect>
                  ${
                    building
                      ? `<text class="map-building-label" x="${bounds.centerX}" y="${Math.max(24, bounds.y + 18)}" text-anchor="middle">${escapeHtml(building.name)}</text>`
                      : ""
                  }
                </g>
              `,
            )
            .join("")}
          <g class="map-edge-layer">
            ${safeArray(details.graph?.edges)
              .map((edge) => {
                const fromPoint = projection.point(lookups.nodeById.get(edge.from));
                const toPoint = projection.point(lookups.nodeById.get(edge.to));
                return `<line class="map-edge ${escapeHtml(getRoadTypeMeta(edge.roadType).className)}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}"></line>`;
              })
              .join("")}
          </g>
          <g class="map-route-layer">
            ${
              routeAnalysis
                ? routeAnalysis.stepDetails
                    .map((step) => {
                      const fromPoint = projection.point(step.fromNode);
                      const toPoint = projection.point(step.toNode);
                      const roadType = step.edge?.roadType || "walkway";
                      return `
                        <line class="route-segment route-segment-halo" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}"></line>
                        <line class="route-segment route-segment-line ${escapeHtml(getRoadTypeMeta(roadType).className)}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}"></line>
                      `;
                    })
                    .join("")
                : ""
            }
          </g>
          <g class="map-node-layer">
            ${safeArray(details.graph?.nodes)
              .map((node) => {
                const point = projection.point(node);
                const classes = ["map-node", getNodeEnvironment(node) === "indoor" ? "is-indoor" : "is-outdoor"];
                if (routeNodeSet.has(node.id)) {
                  classes.push("is-route-node");
                }
                if (!routeAnalysis && (previewStart?.id === node.id || previewEnd?.id === node.id)) {
                  classes.push("is-preview-node");
                }
                return `<circle class="${classes.join(" ")}" cx="${point.x}" cy="${point.y}" r="${routeNodeSet.has(node.id) ? 8 : 6.5}"></circle>`;
              })
              .join("")}
          </g>
          <g class="map-marker-layer">
            ${
              routeAnalysis
                ? activeRouteMarkerMarkup(activeMarkerLayout)
                : previewRouteMarkerMarkup(previewMarkers)
            }
          </g>
        </svg>
      </div>
      ${
        legendItems.length
          ? `<div class="route-legend">${legendItems.map((item) => routeLegendItemMarkup(item)).join("")}</div>`
          : ""
      }
      ${routeCueMarkup}
      <p class="route-map-note">${escapeHtml(routeNote)}</p>
    </article>
  `;
}

export function renderRouteResult(item, details) {
  if (!item) {
    return "";
  }
  const lookups = details ? createRouteLookups(details) : null;
  const nodeNameById = new Map(safeArray(item.nodeNames).map((entry) => [entry.id, entry.name]));

  return `
    <article class="surface-card route-summary-card">
      <p class="section-tag">Route summary</p>
      <h3>${escapeHtml(item.destinationName)}</h3>
      ${resultMetaMarkup([
        item.strategy,
        item.mode,
        `${item.totalDistance} m`,
        `cost ${item.totalCost}`,
      ])}
      <p>${escapeHtml(item.reachable ? "Route ready to follow." : "No route could be found.")}</p>
      <p class="muted">${summarizeSteps(item.nodeNames)}</p>
    </article>
    <article class="surface-card route-summary-card">
      <p class="section-tag">Route details</p>
      <h3>Step sequence</h3>
      <div class="tag-row">
        ${
          safeArray(item.steps).length
            ? safeArray(item.steps)
                .map((step) => {
                  const edge = lookups ? resolveRouteEdge(step, lookups) : null;
                  const roadLabel = getRoadTypeMeta(edge?.roadType).label;
                  return `<span class="tag">${escapeHtml(nodeNameById.get(step.from) || step.from)} → ${escapeHtml(nodeNameById.get(step.to) || step.to)} · ${escapeHtml(roadLabel)} · ${escapeHtml(step.mode)}</span>`;
                })
                .join("")
            : "<span class='tag'>No step-by-step segments returned.</span>"
        }
      </div>
    </article>
  `;
}
