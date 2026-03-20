import {
  createRouteContextHref,
  emptyStateMarkup,
  fillSelect,
  parseListInput,
  resolveRouteActor,
  safeArray,
} from "../lib.js";

function sanitizeOptionSelection(options, preferredValue, fallbackIndex = 0) {
  const optionIds = safeArray(options).map((option) => option.id);
  if (preferredValue && optionIds.includes(preferredValue)) {
    return preferredValue;
  }
  return optionIds[fallbackIndex] || "";
}

export async function render(app, route, root) {
  if ((route.params.view || "") === "world") {
    const { renderWorldMapView } = await import("../world-rendering.js");
    return renderWorldMapView(app, route, root);
  }

  app.setDocumentTitle("Map");
  const { getDestinationScene, renderRouteResult, renderRouteVisualization } = await import("../map-rendering.js");

  await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const destinationOptions = safeArray(app.getDestinationOptions());
  const requestedDestinationId = route.params.destinationId || "";
  const defaultDestinationId = sanitizeOptionSelection(destinationOptions, requestedDestinationId, 0);
  const usedDestinationFallback = Boolean(requestedDestinationId) && requestedDestinationId !== defaultDestinationId;
  const routeActor = resolveRouteActor(route);
  const returnToExploreHref = createRouteContextHref("/explore", {}, route);
  const worldViewHref = createRouteContextHref("/map", { view: "world" }, route);

  // Deep links can outlive the bootstrap destination list. Normalize before fetching map details.
  if (usedDestinationFallback) {
    route.params.destinationId = defaultDestinationId;
    route.params.from = "";
    route.params.to = "";
    route.params.waypoints = "";
  }

  root.innerHTML = `
    <section class="route-hero route-hero-map">
      <div class="route-hero-copy">
        <p class="eyebrow">Map</p>
        <h1>Plan a route with the destination map still in view.</h1>
        <p class="route-lede">
          Choose a destination, preview where the route begins and ends, and plan the path that fits the visit.
        </p>
        <div class="hero-actions">
          <a class="secondary-link" href="${worldViewHref}" data-map-world-link="true" data-nav="true">Open World View</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Route flow</p>
        <ul class="hero-list">
          <li>Select a destination to load its map and route options.</li>
          <li>Preview the start and end markers before planning the route.</li>
          <li>Open advanced routing only when you need waypoints or different travel preferences.</li>
        </ul>
      </div>
    </section>

    <section class="map-view-grid">
      <article class="surface-card map-controls-card route-stage-shell">
        <div class="section-head">
          <div class="map-controls-copy">
            <h2>Route Planning</h2>
            <p>Choose the spatial context first, then set the route start and end nodes.</p>
          </div>
          <a class="inline-link" href="${returnToExploreHref}" data-nav="true">Return to Explore</a>
        </div>
        <form class="control-grid" id="map-route-form">
          <div class="span-all map-control-group">
            <label>
              Destination
              <select id="map-destination"></select>
            </label>
          </div>
          <div class="control-grid span-all map-control-group map-node-pair">
            <label>
              Start node
              <select id="map-start"></select>
            </label>
            <label>
              End node
              <select id="map-end"></select>
            </label>
          </div>
          <details class="advanced-panel span-all" id="map-advanced">
            <summary>Advanced routing</summary>
            <div class="advanced-panel-grid">
              <label>
                Waypoints
                <input
                  id="map-waypoints"
                  type="text"
                  placeholder="Waypoint node IDs, comma-separated"
                />
              </label>
              <label>
                Strategy
                <select id="map-strategy">
                  <option value="distance">distance</option>
                  <option value="time">time</option>
                  <option value="mixed">mixed</option>
                </select>
              </label>
              <label>
                Mode
                <select id="map-mode">
                  <option value="walk">walk</option>
                  <option value="bike">bike</option>
                  <option value="shuttle">shuttle</option>
                  <option value="mixed">mixed</option>
                </select>
              </label>
            </div>
          </details>
          <div class="button-row span-all">
            <button type="submit">Plan route</button>
            <button type="button" id="map-reset-route" class="ghost">Clear route</button>
          </div>
        </form>
      </article>

      <div class="map-stage-stack">
        <div id="map-visualization"></div>
        <div id="map-route-result"></div>
      </div>
    </section>
  `;

  app.applySelectorBindings(root, destinationBindings?.selectorBindings);

  const destinationSelect = root.querySelector("#map-destination");
  const startSelect = root.querySelector("#map-start");
  const endSelect = root.querySelector("#map-end");
  const waypointsInput = root.querySelector("#map-waypoints");
  const strategySelect = root.querySelector("#map-strategy");
  const modeSelect = root.querySelector("#map-mode");
  const visualization = root.querySelector("#map-visualization");
  const routeResult = root.querySelector("#map-route-result");

  let disposed = false;
  let currentRoute = null;
  let autoPlanned = false;
  let nodeOptionsRequestToken = 0;

  destinationSelect.value = defaultDestinationId;
  waypointsInput.value = route.params.waypoints;
  strategySelect.value = route.params.strategy || "distance";
  modeSelect.value = route.params.mode || "walk";
  if (route.params.waypoints || route.params.strategy || route.params.mode) {
    root.querySelector("#map-advanced").open = true;
  }

  function clearNodeOptions() {
    fillSelect(startSelect, [], { includeBlank: true, blankLabel: "No stops available" });
    fillSelect(endSelect, [], { includeBlank: true, blankLabel: "No stops available" });
    startSelect.value = "";
    endSelect.value = "";
  }

  function mapStageEmptyMarkup(title, body) {
    return `
      <div class="surface-card map-stage-empty-shell route-stage-shell">
        ${emptyStateMarkup({ title, body })}
      </div>
    `;
  }

  function renderInlineMapState(title, body) {
    visualization.innerHTML = mapStageEmptyMarkup(title, body);
    routeResult.innerHTML = "";
  }

  async function syncNodeOptions(destinationId) {
    const token = nodeOptionsRequestToken + 1;
    nodeOptionsRequestToken = token;

    if (!destinationId) {
      clearNodeOptions();
      return null;
    }

    let details;
    try {
      details = await app.ensureDestinationDetails(destinationId);
    } catch (error) {
      clearNodeOptions();
      app.setStatus(error instanceof Error ? error.message : "Map preview failed.", "error");
      return null;
    }

    if (disposed || token !== nodeOptionsRequestToken || destinationSelect.value !== destinationId || !details) {
      return null;
    }

    const scene = getDestinationScene(app.state.mapScenes, destinationId, details);
    const nodeOptions = safeArray(scene?.nodeOptions);
    const startValue = sanitizeOptionSelection(nodeOptions, route.params.from, 0);
    const endValue = sanitizeOptionSelection(nodeOptions, route.params.to, 1);

    fillSelect(startSelect, nodeOptions, { selectedValue: startValue });
    fillSelect(endSelect, nodeOptions, { selectedValue: endValue });
    startSelect.value = startValue;
    endSelect.value = endValue || nodeOptions[0]?.id || "";
    return { details, scene };
  }

  function updateRouteQuery(replace = true) {
    const params = {
      destinationId: destinationSelect.value,
      from: startSelect.value,
      to: endSelect.value,
      waypoints: waypointsInput.value.trim(),
      strategy: strategySelect.value,
      mode: modeSelect.value,
    };

    app.navigate(
      buildContextualMapHref(params),
      { replace, preserveScroll: true, render: false },
    );
  }

  function buildContextualMapHref(params = {}) {
    return app.buildMapHref(routeActor ? { ...params, actor: routeActor } : params);
  }

  async function renderMapSurface(activeRoute = currentRoute) {
    const destinationId = destinationSelect.value;
    if (!destinationId) {
      renderInlineMapState(
        "Choose a destination",
        "The map surface loads only after a destination is selected.",
      );
      return;
    }

    let details;
    try {
      details = await app.ensureDestinationDetails(destinationId);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Map preview failed.", "error");
      renderInlineMapState(
        "Map unavailable",
        "Destination data could not be loaded. Choose another destination to keep routing.",
      );
      return;
    }

    if (disposed || !details) {
      return;
    }

    const scene = getDestinationScene(app.state.mapScenes, destinationId, details);
    visualization.innerHTML = renderRouteVisualization({
      details,
      route: activeRoute && activeRoute.destinationId === destinationId ? activeRoute : null,
      previewStartId: startSelect.value,
      previewEndId: endSelect.value,
      scene,
    });
    routeResult.innerHTML =
      activeRoute && activeRoute.destinationId === destinationId
        ? renderRouteResult(activeRoute, details)
        : mapStageEmptyMarkup(
            "Route summary appears after planning",
            "Preview markers update while you adjust the route, and distance plus directions appear after you plan it.",
          );
  }

  async function planRoute() {
    const payload = await app.requestJson("/api/routes/plan", {
      method: "POST",
      body: JSON.stringify({
        destinationId: destinationSelect.value,
        startNodeId: startSelect.value,
        endNodeId: endSelect.value,
        waypointNodeIds: parseListInput(waypointsInput.value),
        strategy: strategySelect.value,
        mode: modeSelect.value,
      }),
    });
    currentRoute = payload.item;
    await renderMapSurface(currentRoute);
    updateRouteQuery(true);
  }

  const debouncedPreview = app.debounce(() => {
    currentRoute = null;
    void renderMapSurface(null).catch((error) =>
      app.setStatus(error instanceof Error ? error.message : "Map preview failed.", "error"),
    );
    updateRouteQuery(true);
  }, 180);

  await syncNodeOptions(defaultDestinationId);
  await renderMapSurface(null);

  if (usedDestinationFallback) {
    app.setStatus("Requested destination was unavailable. Showing the first available map instead.", "neutral");
    if (defaultDestinationId) {
      app.navigate(buildContextualMapHref({ destinationId: defaultDestinationId }), {
        replace: true,
        preserveScroll: true,
        render: false,
      });
    }
  }

  if (!usedDestinationFallback && route.params.destinationId && route.params.from && route.params.to && !autoPlanned) {
    autoPlanned = true;
    try {
      await planRoute();
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Route hydration failed.", "error");
    }
  }

  destinationSelect.addEventListener("change", async () => {
    currentRoute = null;
    route.params.from = "";
    route.params.to = "";
    await syncNodeOptions(destinationSelect.value);
    await renderMapSurface(null);
    updateRouteQuery(true);
  });

  startSelect.addEventListener("change", debouncedPreview);
  endSelect.addEventListener("change", debouncedPreview);
  waypointsInput.addEventListener("input", debouncedPreview);
  strategySelect.addEventListener("change", debouncedPreview);
  modeSelect.addEventListener("change", debouncedPreview);

  root.querySelector("#map-route-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await planRoute();
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Route planning failed.", "error");
    }
  });

  root.querySelector("#map-reset-route").addEventListener("click", async () => {
    currentRoute = null;
    waypointsInput.value = "";
    await renderMapSurface(null);
    updateRouteQuery(true);
  });

  return () => {
    disposed = true;
    debouncedPreview.cancel();
  };
}
