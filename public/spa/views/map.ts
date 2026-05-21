// @ts-nocheck

import { appCopy, displayLabel, modeLabels, strategyLabels } from "../copy.js";
import {
  createRouteContextHref,
  emptyStateMarkup,
  fillSelect,
  parseListInput,
  resolveRouteActor,
  safeArray,
} from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Normalizes a preferred option id against the available destination or node options.
 */
function sanitizeOptionSelection(options, preferredValue, fallbackIndex = 0) {
  const optionIds = safeArray(options).map((option) => option.id);
  if (preferredValue && optionIds.includes(preferredValue)) {
    return preferredValue;
  }
  return optionIds[fallbackIndex] || "";
}

/**
 * Renders either the local destination map planner or the world planner handoff.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  if ((route.params.view || "") === "world") {
    const { renderWorldMapView } = await import("../world-rendering.js");
    return renderWorldMapView(app, route, root);
  }

  const copy = appCopy.map;
  app.setDocumentTitle(copy.documentTitle);
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
        <p class="eyebrow">${copy.hero.eyebrow}</p>
        <h1>${copy.hero.title}</h1>
        <p class="route-lede">
          ${copy.hero.lede}
        </p>
        <div class="hero-actions">
          <a class="secondary-link" href="${worldViewHref}" data-map-world-link="true" data-nav="true">${copy.hero.worldLink}</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${copy.hero.panelTag}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="map-view-grid">
      <article class="surface-card map-controls-card route-stage-shell">
        <div class="section-head">
          <div class="map-controls-copy">
            <h2>${copy.planner.heading}</h2>
            <p>${copy.planner.body}</p>
          </div>
          <a class="inline-link" href="${returnToExploreHref}" data-nav="true">${copy.planner.returnToExplore}</a>
        </div>
        <form class="control-grid" id="map-route-form">
          <div class="span-all map-control-group">
            <label>
              ${copy.planner.labels.destination}
              <select id="map-destination"></select>
            </label>
          </div>
          <div class="control-grid span-all map-control-group map-node-pair">
            <label>
              ${copy.planner.labels.start}
              <select id="map-start"></select>
            </label>
            <label>
              ${copy.planner.labels.end}
              <select id="map-end"></select>
            </label>
          </div>
          <details class="advanced-panel span-all" id="map-advanced">
            <summary>${copy.planner.advancedSummary}</summary>
            <div class="advanced-panel-grid">
              <label>
                ${copy.planner.labels.waypoints}
                <input
                  id="map-waypoints"
                  type="text"
                  placeholder="${copy.planner.placeholders.waypoints}"
                />
              </label>
              <label>
                ${copy.planner.labels.strategy}
                <select id="map-strategy">
                  <option value="distance">${displayLabel(strategyLabels, "distance")}</option>
                  <option value="time">${displayLabel(strategyLabels, "time")}</option>
                  <option value="mixed">${displayLabel(strategyLabels, "mixed")}</option>
                </select>
              </label>
              <label>
                ${copy.planner.labels.mode}
                <select id="map-mode">
                  <option value="walk">${displayLabel(modeLabels, "walk")}</option>
                  <option value="bike">${displayLabel(modeLabels, "bike")}</option>
                  <option value="shuttle">${displayLabel(modeLabels, "shuttle")}</option>
                  <option value="mixed">${displayLabel(modeLabels, "mixed")}</option>
                </select>
              </label>
            </div>
          </details>
          <div class="button-row span-all">
            <button type="submit">${copy.planner.buttons.plan}</button>
            <button type="button" id="map-reset-route" class="ghost">${copy.planner.buttons.reset}</button>
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
    fillSelect(startSelect, [], { includeBlank: true, blankLabel: copy.planner.placeholders.noStops });
    fillSelect(endSelect, [], { includeBlank: true, blankLabel: copy.planner.placeholders.noStops });
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
      app.setStatus(copy.status.nodeLoadFailed, "error");
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
        copy.empty.chooseDestinationTitle,
        copy.empty.chooseDestinationBody,
      );
      return;
    }

    let details;
    try {
      details = await app.ensureDestinationDetails(destinationId);
    } catch (error) {
      app.setStatus(copy.status.previewFailed, "error");
      renderInlineMapState(
        copy.empty.mapUnavailableTitle,
        copy.empty.mapUnavailableBody,
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
            copy.empty.routeSummaryTitle,
            copy.empty.routeSummaryBody,
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
      app.setStatus(copy.status.previewFailed, "error"),
    );
    updateRouteQuery(true);
  }, 180);

  await syncNodeOptions(defaultDestinationId);
  await renderMapSurface(null);

  if (usedDestinationFallback) {
    app.setStatus(copy.status.unavailableDestination, "neutral");
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
      app.setStatus(copy.status.restoreFailed, "error");
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
      app.setStatus(copy.status.planFailed, "error");
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
