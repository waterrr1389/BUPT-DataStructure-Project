const state = {
  bootstrap: null,
  destinationDetails: new Map(),
  destinationById: new Map(),
  userById: new Map(),
  lastCompressed: "",
  activeRoute: null,
};

const MAP_CANVAS = {
  width: 720,
  height: 460,
  padding: 54,
};

const ROAD_TYPE_META = {
  walkway: { label: "Walkway", className: "is-walkway" },
  "bike-lane": { label: "Bike lane", className: "is-bike-lane" },
  "shuttle-lane": { label: "Shuttle lane", className: "is-shuttle-lane" },
  indoor: { label: "Indoor corridor", className: "is-indoor" },
};

const routeVisualizationMarkers = globalThis.RouteVisualizationMarkers;

if (!routeVisualizationMarkers) {
  throw new Error("Route visualization helpers failed to load.");
}

const { createRouteMarkerLayout } = routeVisualizationMarkers;
const journalPresentation = globalThis.JournalPresentation;

if (!journalPresentation) {
  throw new Error("Journal presentation helpers failed to load.");
}

const { createDestinationSelectOptions, formatJournalMetadata } = journalPresentation;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
    },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function optionMarkup(items, { value = "id", label = "name", includeAny = false } = {}) {
  const lines = [];
  if (includeAny) {
    lines.push('<option value="">any</option>');
  }
  for (const item of items) {
    lines.push(`<option value="${item[value]}">${item[label]}</option>`);
  }
  return lines.join("");
}

function emptyMarkup() {
  const template = document.querySelector("#empty-state");
  return template ? template.innerHTML : "<div class='empty-state'><p>No results yet.</p></div>";
}

function tagsMarkup(tags = []) {
  if (!tags.length) {
    return "";
  }
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`;
}

function setStatus(message) {
  document.querySelector("#source-badge").textContent = message;
}

async function getDestinationDetails(destinationId) {
  if (!destinationId) {
    return null;
  }
  if (state.destinationDetails.has(destinationId)) {
    return state.destinationDetails.get(destinationId);
  }
  const data = await api(`/api/destinations/${destinationId}`);
  state.destinationDetails.set(destinationId, data);
  return data;
}

function fillSelect(selector, items, config = {}) {
  const element = document.querySelector(selector);
  element.innerHTML = optionMarkup(items, config);
  return element;
}

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
  const buildingById = new Map(details.buildings.map((building) => [building.id, building]));
  const grouped = new Map();

  details.graph.nodes.forEach((node) => {
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

function createRouteLookups(details) {
  return {
    edgeById: new Map(details.graph.edges.map((edge) => [edge.id, edge])),
    edgeByPair: new Map(details.graph.edges.map((edge) => [edgeKey(edge.from, edge.to), edge])),
    nodeById: new Map(details.graph.nodes.map((node) => [node.id, node])),
  };
}

function resolveRouteEdge(step, lookups) {
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
  if (!route || !route.reachable || route.nodeIds.length === 0) {
    return null;
  }

  const lookups = createRouteLookups(details);
  const routeNodes = route.nodeIds.map((nodeId) => lookups.nodeById.get(nodeId)).filter(Boolean);
  const stepDetails = route.steps
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
    const roadTypeChange = enteringStep?.edge?.roadType && leavingStep?.edge?.roadType && enteringStep.edge.roadType !== leavingStep.edge.roadType;
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
  const width = Math.max(54, label.length * 7 + 18);
  const x = point.x > MAP_CANVAS.width - 150 ? point.x - width - 14 : point.x + 14;
  const verticalOffset = variantClass === "is-transition" || variantClass === "is-turn" ? 10 : -32;
  const y = Math.min(MAP_CANVAS.height - 34, Math.max(10, point.y + verticalOffset));
  return `
    <g class="map-pill ${variantClass}" transform="translate(${x} ${y})">
      <rect width="${width}" height="24" rx="12"></rect>
      <text x="${width / 2}" y="16" text-anchor="middle">${label}</text>
    </g>
  `;
}

function routeMarkerShapeMarkup(marker) {
  if (marker.kind === "start") {
    return `<circle class="route-marker route-marker-start" cx="${marker.point.x}" cy="${marker.point.y}" r="11"></circle>`;
  }
  if (marker.kind === "end") {
    return `<rect class="route-marker route-marker-end" x="${marker.point.x - 10}" y="${marker.point.y - 10}" width="20" height="20" rx="6"></rect>`;
  }
  if (marker.kind === "transition") {
    return `<path class="route-marker route-marker-transition" d="M ${marker.point.x} ${marker.point.y - 12} L ${marker.point.x + 11} ${marker.point.y + 8} L ${marker.point.x - 11} ${marker.point.y + 8} Z"></path>`;
  }
  return `<rect class="route-marker route-marker-turn" x="${marker.point.x - 7}" y="${marker.point.y - 7}" width="14" height="14" rx="4" transform="rotate(45 ${marker.point.x} ${marker.point.y})"></rect>`;
}

function routeMarkerMarkup(marker) {
  return `
    ${routeMarkerShapeMarkup(marker)}
    ${pillLabelMarkup(marker.point, marker.label, marker.variantClass)}
  `;
}

function activeRouteMarkerMarkup(routeAnalysis, projection) {
  const markerLayout = createRouteMarkerLayout(routeAnalysis, projection);
  return [...markerLayout.endpointMarkers, ...markerLayout.transitionMarkers, ...markerLayout.turnMarkers]
    .map((marker) => routeMarkerMarkup(marker))
    .join("");
}

function renderRouteVisualization(details, route) {
  const target = document.querySelector("#route-visualization");
  if (!details) {
    target.innerHTML = emptyMarkup();
    return;
  }

  const projection = createGraphProjection(details.graph.nodes);
  const routeAnalysis = analyzeRoute(details, route);
  const lookups = routeAnalysis?.lookups || createRouteLookups(details);
  const routeNodeSet = new Set(routeAnalysis ? routeAnalysis.routeNodes.map((node) => node.id) : []);
  const previewStart = !routeAnalysis ? lookups.nodeById.get(document.querySelector("#route-start").value) : null;
  const previewEnd = !routeAnalysis ? lookups.nodeById.get(document.querySelector("#route-end").value) : null;
  const outdoorBounds = createBounds(
    details.graph.nodes.filter((node) => getNodeEnvironment(node) === "outdoor"),
    projection,
    36,
  );
  const buildingOverlays = createBuildingOverlays(details, projection);
  const routeDistance = routeAnalysis ? `${route.totalDistance} m highlighted` : route?.reachable === false ? "No reachable path" : "Graph preview";
  const routeNote = routeAnalysis
    ? `${routeAnalysis.turnMarkers.length} key turns, ${routeAnalysis.transitionMarkers.length} indoor or outdoor transitions, ${route.totalDistance} m total.`
    : route?.reachable === false
      ? "Planner could not connect the selected nodes with the current settings. The destination graph remains visible for adjustment."
      : previewStart && previewEnd
        ? `Previewing ${previewStart.name} to ${previewEnd.name}. Submit the planner to render the active route overlay.`
        : "Select start and end nodes, then plan a route to highlight it on the destination map.";

  const legendItems = [
    { className: "outdoor-path", label: "Outdoor route" },
    { className: "indoor-path", label: "Indoor route" },
    { className: "transition", label: "Indoor or outdoor cue" },
    { className: "turn", label: "Key turn" },
    { className: "start", label: "Start" },
    { className: "end", label: "End" },
  ];
  const routeCueMarkup =
    routeAnalysis && (routeAnalysis.transitionMarkers.length > 0 || routeAnalysis.turnMarkers.length > 0)
      ? `<div class="route-cue-row">
          ${routeAnalysis.transitionMarkers.map((marker) => `<span class="route-cue">${marker.label}: ${marker.node.name}</span>`).join("")}
          ${routeAnalysis.turnMarkers.map((marker) => `<span class="route-cue">${marker.label}: ${marker.node.name}</span>`).join("")}
        </div>`
      : "";

  target.innerHTML = `
    <article class="route-surface-card">
      <div class="route-surface-head">
        <div>
          <p class="section-tag">Active Map</p>
          <h3>${details.name}</h3>
        </div>
        <div class="result-meta route-surface-meta">
          <span>${details.graph.nodes.length} nodes</span>
          <span>${details.graph.edges.length} links</span>
          <span>${details.buildings.length} buildings</span>
          <span>${routeDistance}</span>
        </div>
      </div>
      <div class="route-map-frame">
        <svg class="route-map" viewBox="0 0 ${MAP_CANVAS.width} ${MAP_CANVAS.height}" role="img" aria-label="Map view for ${details.name}">
          <defs>
            <pattern id="route-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" class="map-grid-line"></path>
            </pattern>
          </defs>
          <rect class="map-canvas" x="0" y="0" width="${MAP_CANVAS.width}" height="${MAP_CANVAS.height}" rx="30"></rect>
          <rect class="map-grid" x="0" y="0" width="${MAP_CANVAS.width}" height="${MAP_CANVAS.height}" rx="30"></rect>
          ${
            outdoorBounds
              ? `<rect class="map-outdoor-zone" x="${outdoorBounds.x}" y="${outdoorBounds.y}" width="${outdoorBounds.width}" height="${outdoorBounds.height}" rx="36"></rect>`
              : ""
          }
          ${buildingOverlays
            .map(
              ({ bounds, building }) => `
                <g class="map-building-group">
                  <rect class="map-building-zone" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="28"></rect>
                  ${
                    building
                      ? `<text class="map-building-label" x="${bounds.centerX}" y="${Math.max(22, bounds.y + 18)}" text-anchor="middle">${building.name}</text>`
                      : ""
                  }
                </g>
              `,
            )
            .join("")}
          <g class="map-edge-layer">
            ${details.graph.edges
              .map((edge) => {
                const fromPoint = projection.point(lookups.nodeById.get(edge.from));
                const toPoint = projection.point(lookups.nodeById.get(edge.to));
                return `<line class="map-edge ${getRoadTypeMeta(edge.roadType).className}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}"></line>`;
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
                        <line class="route-segment route-segment-line ${getRoadTypeMeta(roadType).className}" x1="${fromPoint.x}" y1="${fromPoint.y}" x2="${toPoint.x}" y2="${toPoint.y}"></line>
                      `;
                    })
                    .join("")
                : ""
            }
          </g>
          <g class="map-node-layer">
            ${details.graph.nodes
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
                ? activeRouteMarkerMarkup(routeAnalysis, projection)
                : `${previewStart ? `<circle class="route-marker route-marker-preview-start" cx="${projection.point(previewStart).x}" cy="${projection.point(previewStart).y}" r="10"></circle>${pillLabelMarkup(projection.point(previewStart), "Start", "is-preview")}` : ""}
                   ${previewEnd ? `<circle class="route-marker route-marker-preview-end" cx="${projection.point(previewEnd).x}" cy="${projection.point(previewEnd).y}" r="10"></circle>${pillLabelMarkup(projection.point(previewEnd), "End", "is-preview")}` : ""}`
            }
          </g>
        </svg>
      </div>
      <div class="route-legend">
        ${legendItems
          .map(
            (item) => `
              <span class="route-legend-item">
                <span class="route-legend-swatch ${item.className}"></span>
                ${item.label}
              </span>
            `,
          )
          .join("")}
      </div>
      ${routeCueMarkup}
      <p class="route-map-note">${routeNote}</p>
    </article>
  `;
}

async function refreshRouteVisualization(destinationId = document.querySelector("#route-destination").value) {
  const details = await getDestinationDetails(destinationId);
  const route = state.activeRoute && state.activeRoute.destinationId === destinationId ? state.activeRoute : null;
  renderRouteVisualization(details, route);
}

async function syncNodeSelects(destinationId, selectors) {
  const details = await getDestinationDetails(destinationId);
  const nodes = details.graph.nodes.map((node) => ({
    id: node.id,
    name: `${node.name} (${node.id.split("-").slice(-1)[0]})`,
  }));
  selectors.forEach((selector) => {
    fillSelect(selector, nodes);
  });
}

function clearActiveRoute() {
  if (!state.activeRoute) {
    return;
  }
  state.activeRoute = null;
  renderRouteResult(null);
}

function renderDestinations(items) {
  const target = document.querySelector("#destination-results");
  if (!items.length) {
    target.innerHTML = emptyMarkup();
    return;
  }
  target.innerHTML = items
    .map(
      (item) => `
        <article class="result-card">
          <p class="muted">${item.type} / ${item.region}</p>
          <h3>${item.name}</h3>
          <div class="result-meta">
            <span>heat ${item.heat}</span>
            <span>rating ${item.rating}</span>
            <span>${item.nodeCount} nodes</span>
          </div>
          <p>${item.description}</p>
          ${tagsMarkup(item.categories)}
        </article>
      `,
    )
    .join("");
}

function renderRouteResult(item, details = null) {
  const target = document.querySelector("#route-result");
  if (!item) {
    target.innerHTML = emptyMarkup();
    return;
  }
  const nodeNameById = new Map(item.nodeNames.map((entry) => [entry.id, entry.name]));
  const lookups = details ? createRouteLookups(details) : null;
  target.innerHTML = `
    <article class="result-card">
      <h3>${item.destinationName}</h3>
      <div class="result-meta">
        <span>${item.strategy}</span>
        <span>${item.mode}</span>
        <span>${item.totalDistance} m</span>
        <span>cost ${item.totalCost}</span>
      </div>
      <p>${item.reachable ? "Reachable route returned." : "No route could be found."}</p>
      <p class="muted">${item.nodeNames.map((entry) => entry.name).join(" -> ")}</p>
    </article>
    <article class="result-card">
      <h4>Supporting route summary</h4>
      <div class="tag-row">
        ${
          item.steps.length
            ? item.steps
                .map((step) => {
                  const edge = lookups ? resolveRouteEdge(step, lookups) : null;
                  const roadLabel = getRoadTypeMeta(edge?.roadType).label;
                  return `<span class="tag">${nodeNameById.get(step.from) || step.from} to ${nodeNameById.get(step.to) || step.to} · ${roadLabel} · ${step.mode}</span>`;
                })
                .join("")
            : "<span class='tag'>No step-by-step segments returned.</span>"
        }
      </div>
    </article>
  `;
}

function renderFacilities(item) {
  const target = document.querySelector("#facility-results");
  if (!item.items.length) {
    target.innerHTML = emptyMarkup();
    return;
  }
  target.innerHTML = item.items
    .map(
      (facility) => `
        <article class="result-card">
          <h4>${facility.name}</h4>
          <div class="result-meta">
            <span>${facility.category}</span>
            <span>${facility.distance} m</span>
            <span>${facility.openHours}</span>
          </div>
          <p class="muted">${facility.nodePath.join(" -> ")}</p>
        </article>
      `,
    )
    .join("");
}

function journalCard(item) {
  const metadata = formatJournalMetadata(item, {
    destinationById: state.destinationById,
    userById: state.userById,
  });

  return `
    <article class="result-card" data-journal-id="${item.id}">
      <p class="muted">${metadata.attribution}</p>
      <h3>${item.title}</h3>
      <div class="result-meta">
        <span>views ${item.views}</span>
        <span>rating ${item.averageRating || 0}</span>
        <span>${item.ratings.length} scores</span>
      </div>
      <p>${item.body.slice(0, 180)}</p>
      ${tagsMarkup(item.tags)}
      <div class="actions">
        <button type="button" data-action="view">Add view</button>
        <button type="button" data-action="rate">Rate 5</button>
        <button type="button" data-action="delete" class="ghost">Delete</button>
      </div>
    </article>
  `;
}

function renderJournals(items) {
  const target = document.querySelector("#journal-results");
  target.innerHTML = items.length ? items.map(journalCard).join("") : emptyMarkup();
}

function renderExchangeResults(blocks) {
  const target = document.querySelector("#exchange-results");
  target.innerHTML = blocks.length ? blocks.join("") : emptyMarkup();
}

function renderFoods(items) {
  const target = document.querySelector("#food-results");
  target.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="result-card">
              <h3>${item.name}</h3>
              <div class="result-meta">
                <span>${item.cuisine}</span>
                <span>rating ${item.rating}</span>
                <span>heat ${item.heat}</span>
                <span>$${item.avgPrice}</span>
              </div>
              <p class="muted">${item.venue}</p>
              ${tagsMarkup(item.keywords)}
            </article>
          `,
        )
        .join("")
    : emptyMarkup();
}

async function loadBootstrap() {
  const bootstrap = await api("/api/bootstrap");
  state.bootstrap = bootstrap;
  const users = bootstrap.users;
  const featuredDestinations = Array.isArray(bootstrap.featured) ? bootstrap.featured : [];
  const journalDestinations =
    Array.isArray(bootstrap.destinations) && bootstrap.destinations.length
      ? bootstrap.destinations
      : featuredDestinations;
  const journalDestinationOptions = createDestinationSelectOptions(journalDestinations);
  const categories = bootstrap.categories.map((category) => ({ id: category, name: category }));
  const cuisines = bootstrap.cuisines.map((cuisine) => ({ id: cuisine, name: cuisine }));

  state.userById = new Map(users.map((user) => [user.id, user]));
  state.destinationById = new Map(
    [...featuredDestinations, ...journalDestinations].map((destination) => [destination.id, destination]),
  );

  fillSelect("#destination-user", users, { includeAny: true });
  fillSelect("#journal-user", users);
  fillSelect("#food-user", users, { includeAny: true });
  fillSelect("#destination-category", categories, { value: "id", label: "name", includeAny: true });
  fillSelect("#food-cuisine", cuisines, { value: "id", label: "name", includeAny: true });

  ["#route-destination", "#facility-destination", "#food-destination"].forEach((selector) =>
    fillSelect(selector, featuredDestinations),
  );
  ["#journal-destination", "#exchange-destination"].forEach((selector) =>
    fillSelect(selector, journalDestinationOptions, { label: "label" }),
  );

  renderDestinations(featuredDestinations);
  setStatus(`Runtime data: ${bootstrap.source.data}. Algorithms: ${bootstrap.source.algorithms}.`);

  const firstDestinationId = featuredDestinations[0]?.id;
  if (firstDestinationId) {
    await syncNodeSelects(firstDestinationId, ["#route-start", "#route-end", "#facility-node"]);
    await refreshRouteVisualization(firstDestinationId);
  }
}

async function refreshJournals() {
  const payload = await api("/api/journals?limit=12");
  renderJournals(payload.items);
}

async function handleDestinationSearch(event) {
  event.preventDefault();
  const params = new URLSearchParams();
  const query = document.querySelector("#destination-query").value.trim();
  const category = document.querySelector("#destination-category").value;
  const userId = document.querySelector("#destination-user").value;
  const limit = document.querySelector("#destination-limit").value;
  if (query) params.set("query", query);
  if (category) params.set("category", category);
  if (userId) params.set("userId", userId);
  if (limit) params.set("limit", limit);
  const payload = await api(`/api/destinations?${params.toString()}`);
  renderDestinations(payload.items);
}

async function handleDestinationRecommend() {
  const params = new URLSearchParams();
  const query = document.querySelector("#destination-query").value.trim();
  const userId = document.querySelector("#destination-user").value;
  const limit = document.querySelector("#destination-limit").value;
  if (query) params.set("query", query);
  if (userId) params.set("userId", userId);
  if (limit) params.set("limit", limit);
  const payload = await api(`/api/destinations/recommendations?${params.toString()}`);
  renderDestinations(payload.items);
}

async function handleRouteDestinationChange(event) {
  clearActiveRoute();
  await syncNodeSelects(event.target.value, ["#route-start", "#route-end"]);
  await refreshRouteVisualization(event.target.value);
}

async function handleRouteNodeChange() {
  clearActiveRoute();
  await refreshRouteVisualization();
}

async function handleFacilityDestinationChange(event) {
  await syncNodeSelects(event.target.value, ["#facility-node"]);
}

async function handleRouteSubmit(event) {
  event.preventDefault();
  const destinationId = document.querySelector("#route-destination").value;
  const payload = await api("/api/routes/plan", {
    method: "POST",
    body: JSON.stringify({
      destinationId,
      startNodeId: document.querySelector("#route-start").value,
      endNodeId: document.querySelector("#route-end").value,
      waypointNodeIds: document
        .querySelector("#route-waypoints")
        .value.split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      strategy: document.querySelector("#route-strategy").value,
      mode: document.querySelector("#route-mode").value,
    }),
  });
  state.activeRoute = payload.item;
  const details = await getDestinationDetails(destinationId);
  renderRouteResult(payload.item, details);
  await refreshRouteVisualization(destinationId);
}

async function handleFacilitySubmit(event) {
  event.preventDefault();
  const params = new URLSearchParams({
    destinationId: document.querySelector("#facility-destination").value,
    fromNodeId: document.querySelector("#facility-node").value,
    category: document.querySelector("#facility-category").value,
    radius: document.querySelector("#facility-radius").value,
  });
  const payload = await api(`/api/facilities/nearby?${params.toString()}`);
  renderFacilities(payload.item);
}

async function handleJournalCreate(event) {
  event.preventDefault();
  await api("/api/journals", {
    method: "POST",
    body: JSON.stringify({
      userId: document.querySelector("#journal-user").value,
      destinationId: document.querySelector("#journal-destination").value,
      title: document.querySelector("#journal-title").value,
      body: document.querySelector("#journal-body").value,
      tags: document
        .querySelector("#journal-tags")
        .value.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    }),
  });
  document.querySelector("#journal-create-form").reset();
  await refreshJournals();
}

async function handleJournalActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const card = button.closest("[data-journal-id]");
  const journalId = card?.dataset.journalId;
  if (!journalId) {
    return;
  }
  if (button.dataset.action === "view") {
    await api(`/api/journals/${journalId}/view`, { method: "POST", body: "{}" });
  }
  if (button.dataset.action === "rate") {
    const userId = document.querySelector("#journal-user").value;
    await api(`/api/journals/${journalId}/rate`, {
      method: "POST",
      body: JSON.stringify({ userId, score: 5 }),
    });
  }
  if (button.dataset.action === "delete") {
    await api(`/api/journals/${journalId}`, { method: "DELETE" });
  }
  await refreshJournals();
}

async function handleExchangeSearch(event) {
  event.preventDefault();
  const title = document.querySelector("#exchange-title").value.trim();
  const query = document.querySelector("#exchange-query").value.trim();
  const blocks = [];
  if (title) {
    const payload = await api(`/api/journal-exchange/title?title=${encodeURIComponent(title)}`);
    blocks.push(
      `<article class="result-card"><h3>Exact title</h3>${payload.item ? journalCard(payload.item) : emptyMarkup()}</article>`,
    );
  }
  if (query) {
    const payload = await api(`/api/journal-exchange/search?query=${encodeURIComponent(query)}`);
    blocks.push(
      `<article class="result-card"><h3>Text search</h3>${payload.items.map((item) => journalCard(item)).join("")}</article>`,
    );
  }
  renderExchangeResults(blocks);
}

async function handleDestinationFeed() {
  const destinationId = document.querySelector("#exchange-destination").value;
  const payload = await api(`/api/journal-exchange/destination?destinationId=${encodeURIComponent(destinationId)}`);
  renderExchangeResults([
    `<article class="result-card"><h3>Destination feed</h3>${payload.items.map((item) => journalCard(item)).join("")}</article>`,
  ]);
}

async function handleCompression(event) {
  event.preventDefault();
  const body = document.querySelector("#compression-body").value;
  const payload = await api("/api/journal-exchange/compress", {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  state.lastCompressed = payload.item.compressed;
  renderExchangeResults([
    `<article class="result-card"><h3>Compression</h3><p class="muted">${payload.item.compressed}</p><p>ratio ${payload.item.ratio}</p></article>`,
  ]);
}

async function handleDecompression() {
  const body = state.lastCompressed || document.querySelector("#compression-body").value.trim();
  const payload = await api("/api/journal-exchange/decompress", {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  renderExchangeResults([
    `<article class="result-card"><h3>Decompression</h3><p>${payload.item.text}</p></article>`,
  ]);
}

async function handleStoryboard(event) {
  event.preventDefault();
  const payload = await api("/api/journal-exchange/storyboard", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("#storyboard-title").value,
      prompt: document.querySelector("#storyboard-prompt").value,
      mediaSources: ["generated://cover/demo-1", "generated://clip/demo-1"],
    }),
  });
  renderExchangeResults([
    `<article class="result-card">
      <h3>${payload.item.title}</h3>
      <div class="storyboard">
        ${payload.item.frames
          .map(
            (frame) => `
              <figure>
                <img src="${frame.art}" alt="${frame.caption}" />
                <figcaption>${frame.caption}</figcaption>
              </figure>
            `,
          )
          .join("")}
      </div>
    </article>`,
  ]);
}

async function handleFoodSearch(event) {
  event.preventDefault();
  const params = new URLSearchParams({
    destinationId: document.querySelector("#food-destination").value,
  });
  const cuisine = document.querySelector("#food-cuisine").value;
  const query = document.querySelector("#food-query").value.trim();
  if (cuisine) params.set("cuisine", cuisine);
  if (query) params.set("query", query);
  const payload = await api(`/api/foods/search?${params.toString()}`);
  renderFoods(payload.items);
}

async function handleFoodRecommend() {
  const params = new URLSearchParams({
    destinationId: document.querySelector("#food-destination").value,
  });
  const userId = document.querySelector("#food-user").value;
  const cuisine = document.querySelector("#food-cuisine").value;
  if (userId) params.set("userId", userId);
  if (cuisine) params.set("cuisine", cuisine);
  const payload = await api(`/api/foods/recommendations?${params.toString()}`);
  renderFoods(payload.items);
}

function installBackToTop() {
  const button = document.querySelector("#back-to-top");
  if (!button) {
    return;
  }

  const syncVisibility = () => {
    const shouldShow = window.scrollY > 320;
    button.classList.toggle("is-visible", shouldShow);
  };

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", syncVisibility, { passive: true });
  syncVisibility();
}

function installEvents() {
  document.querySelector("#destination-form").addEventListener("submit", wrap(handleDestinationSearch));
  document.querySelector("#destination-recommend").addEventListener("click", wrap(handleDestinationRecommend));
  document.querySelector("#refresh-destinations").addEventListener(
    "click",
    wrap(async () => {
      const payload = await api("/api/destinations?limit=12");
      renderDestinations(payload.items);
    }),
  );
  document.querySelector("#route-destination").addEventListener("change", wrap(handleRouteDestinationChange));
  document.querySelector("#route-start").addEventListener("change", wrap(handleRouteNodeChange));
  document.querySelector("#route-end").addEventListener("change", wrap(handleRouteNodeChange));
  document.querySelector("#route-waypoints").addEventListener("input", wrap(handleRouteNodeChange));
  document.querySelector("#route-strategy").addEventListener("change", wrap(handleRouteNodeChange));
  document.querySelector("#route-mode").addEventListener("change", wrap(handleRouteNodeChange));
  document.querySelector("#facility-destination").addEventListener("change", wrap(handleFacilityDestinationChange));
  document.querySelector("#route-form").addEventListener("submit", wrap(handleRouteSubmit));
  document.querySelector("#facility-form").addEventListener("submit", wrap(handleFacilitySubmit));
  document.querySelector("#journal-create-form").addEventListener("submit", wrap(handleJournalCreate));
  document.querySelector("#journal-refresh").addEventListener("click", wrap(refreshJournals));
  document.querySelector("#journal-results").addEventListener("click", wrap(handleJournalActions));
  document.querySelector("#exchange-search-form").addEventListener("submit", wrap(handleExchangeSearch));
  document.querySelector("#exchange-by-destination").addEventListener("click", wrap(handleDestinationFeed));
  document.querySelector("#compression-form").addEventListener("submit", wrap(handleCompression));
  document.querySelector("#decompress-button").addEventListener("click", wrap(handleDecompression));
  document.querySelector("#storyboard-form").addEventListener("submit", wrap(handleStoryboard));
  document.querySelector("#food-form").addEventListener("submit", wrap(handleFoodSearch));
  document.querySelector("#food-recommend").addEventListener("click", wrap(handleFoodRecommend));
  installBackToTop();
}

function wrap(handler) {
  return async (event) => {
    try {
      await handler(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      setStatus(message);
    }
  };
}

async function start() {
  installEvents();
  await loadBootstrap();
  await refreshJournals();
  await handleFoodRecommend();
}

start().catch((error) => {
  setStatus(error instanceof Error ? error.message : "Bootstrap failed.");
});
