// @ts-nocheck

import {
  appCopy,
  displayCuisineLabel,
  displayDestinationCategoryLabel,
  displayDestinationMeta,
  displayDestinationTagLabel,
  displayFoodKeywordLabel,
  displayFoodMeta,
  displayLabel,
  facilityCategoryLabels,
} from "../copy.js";
import {
  createRouteContextHref,
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  noticeMarkup,
  parseListInput,
  resultMetaMarkup,
  resolveRouteActor,
  safeArray,
  text,
} from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Builds a map href that preserves actor context when present.
 */
function buildContextualMapHref(app: SpaApp, params, context = null) {
  const actor = resolveRouteActor(context);
  return app.buildMapHref(actor ? { ...params, actor } : params);
}

/**
 * Renders a destination card with stable map and compose handoff URLs.
 */
function destinationCardMarkup(app: SpaApp, item, context = null) {
  const copy = appCopy.explore;
  const mapHref = buildContextualMapHref(app, { destinationId: item.id }, context);
  const composeHref = createRouteContextHref("/compose", { destinationId: item.id }, context);
  const tags = safeArray(item.categories).map((category) => displayDestinationTagLabel(category));

  return `
    <article class="story-card destination-card">
      <p class="muted">${escapeHtml(displayDestinationMeta(item.type, item.region))}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([copy.metrics.heat(item.heat), copy.metrics.rating(item.rating), copy.metrics.nodeCount(item.nodeCount)])}
      <p>${escapeHtml(item.description)}</p>
      ${app.tagsMarkup(tags)}
      <div class="story-card-actions">
        <a class="inline-link" href="${mapHref}" data-nav="true">${copy.actions.openInMap}</a>
        <a class="inline-link" href="${composeHref}" data-nav="true">${copy.actions.writeJournal}</a>
      </div>
    </article>
  `;
}

/**
 * Renders a facility result card that deep-links into the map preview state.
 */
function facilityCardMarkup(app: SpaApp, item, context) {
  const copy = appCopy.explore;
  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(displayLabel(facilityCategoryLabels, item.category, text(item.category)))} · ${escapeHtml(item.openHours)}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([copy.metrics.distanceMeters(item.distance), copy.metrics.pathSegments(safeArray(item.nodePath).length)])}
      <p class="muted">${safeArray(item.nodePath).map((nodeId) => escapeHtml(nodeId)).join(" → ")}</p>
      <div class="story-card-actions">
        <a
          class="inline-link"
          href="${buildContextualMapHref(app, {
            destinationId: context.destinationId,
            from: context.fromNodeId,
            to: item.nodeId,
          }, context)}"
          data-nav="true"
        >
          ${copy.actions.openInMap}
        </a>
      </div>
    </article>
  `;
}

/**
 * Renders a food result card with a direct contextual map link.
 */
function foodCardMarkup(app: SpaApp, item, context) {
  const copy = appCopy.explore;
  const keywords = safeArray(item.keywords).map((keyword) => displayFoodKeywordLabel(keyword));
  const mapParams = {
    destinationId: context.destinationId,
    to: item.nodeId,
  };

  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(displayFoodMeta(item.cuisine, item.venue))}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([copy.metrics.rating(item.rating), copy.metrics.heat(item.heat), copy.metrics.averagePrice(item.avgPrice)])}
      ${app.tagsMarkup(keywords)}
      <div class="story-card-actions">
        <a
          class="inline-link"
          href="${buildContextualMapHref(app, mapParams, context)}"
          data-nav="true"
        >
          ${copy.actions.openInMap}
        </a>
      </div>
    </article>
  `;
}

/**
 * Renders destination discovery, food lookup, and facility lookup surfaces.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.explore;
  app.setDocumentTitle(copy.documentTitle);

  const routeActor = resolveRouteActor(route);
  const bootstrap = await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const featuredDestinations = app.getFeaturedDestinations();
  const users = safeArray(bootstrap?.users);
  const categories = app.getCategories().map((category) => ({
    id: category,
    name: displayDestinationCategoryLabel(category),
  }));
  const cuisines = app.getCuisines().map((cuisine) => ({
    id: cuisine,
    name: displayCuisineLabel(cuisine),
  }));
  const defaultDestinationId = app.getDestinationOptions()[0]?.id || "";

  root.innerHTML = `
    <section class="route-hero route-hero-explore">
      <div class="route-hero-copy">
        <p class="eyebrow">${copy.hero.eyebrow}</p>
        <h1>${copy.hero.title}</h1>
        <p class="route-lede">
          ${copy.hero.lede}
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${copy.hero.panelTag}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="explore-grid">
      <article class="surface-card explore-primary-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${copy.destinationSurface.tag}</p>
            <h2>${copy.destinationSurface.heading}</h2>
          </div>
          <button id="explore-refresh-destinations" class="ghost" type="button">${copy.destinationSurface.refreshButton}</button>
        </div>
        <form class="control-grid" id="explore-destination-form">
          <label>
            ${copy.destinationSurface.labels.traveler}
            <select id="explore-user-filter"></select>
          </label>
          <label>
            ${copy.destinationSurface.labels.query}
            <input id="explore-query" type="text" placeholder="${copy.destinationSurface.placeholders.query}" />
          </label>
          <label>
            ${copy.destinationSurface.labels.category}
            <select id="explore-category"></select>
          </label>
          <label>
            ${copy.destinationSurface.labels.limit}
            <input id="explore-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">${copy.destinationSurface.buttons.search}</button>
            <button type="button" id="explore-destination-recommend" class="ghost">${copy.destinationSurface.buttons.recommend}</button>
          </div>
        </form>
        <div id="explore-destination-results" class="story-grid">
          ${featuredDestinations.map((item) => destinationCardMarkup(app, item, route)).join("")}
        </div>
      </article>

      <article class="surface-card explore-tool-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${copy.facilitySurface.tag}</p>
            <h2>${copy.facilitySurface.heading}</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-facility-form">
          <label>
            ${copy.facilitySurface.labels.destination}
            <select id="explore-facility-destination"></select>
          </label>
          <label>
            ${copy.facilitySurface.labels.startNode}
            <select id="explore-facility-node"></select>
          </label>
          <label>
            ${copy.facilitySurface.labels.category}
            <select id="explore-facility-category">
              <option value="all">${displayLabel(facilityCategoryLabels, "all")}</option>
              <option value="restroom">${displayLabel(facilityCategoryLabels, "restroom")}</option>
              <option value="clinic">${displayLabel(facilityCategoryLabels, "clinic")}</option>
              <option value="store">${displayLabel(facilityCategoryLabels, "store")}</option>
              <option value="charging">${displayLabel(facilityCategoryLabels, "charging")}</option>
              <option value="info">${displayLabel(facilityCategoryLabels, "info")}</option>
              <option value="parking">${displayLabel(facilityCategoryLabels, "parking")}</option>
              <option value="water">${displayLabel(facilityCategoryLabels, "water")}</option>
              <option value="atm">${displayLabel(facilityCategoryLabels, "atm")}</option>
              <option value="security">${displayLabel(facilityCategoryLabels, "security")}</option>
              <option value="lounge">${displayLabel(facilityCategoryLabels, "lounge")}</option>
            </select>
          </label>
          <label>
            ${copy.facilitySurface.labels.radius}
            <input id="explore-facility-radius" type="number" min="100" step="50" value="900" />
          </label>
          <button type="submit">${copy.facilitySurface.button}</button>
        </form>
        <div id="explore-facility-results">
          ${emptyStateMarkup({
            title: copy.facilitySurface.empty.initialTitle,
            body: copy.facilitySurface.empty.initialBody,
          })}
        </div>
      </article>

      <article class="surface-card explore-tool-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${copy.foodSurface.tag}</p>
            <h2>${copy.foodSurface.heading}</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-food-form">
          <label>
            ${copy.foodSurface.labels.destination}
            <select id="explore-food-destination"></select>
          </label>
          <label>
            ${copy.foodSurface.labels.traveler}
            <select id="explore-food-user"></select>
          </label>
          <label>
            ${copy.foodSurface.labels.cuisine}
            <select id="explore-food-cuisine"></select>
          </label>
          <label>
            ${copy.foodSurface.labels.query}
            <input id="explore-food-query" type="text" placeholder="${copy.foodSurface.placeholders.query}" />
          </label>
          <div class="button-row">
            <button type="submit">${copy.foodSurface.buttons.search}</button>
            <button type="button" id="explore-food-recommend" class="ghost">${copy.foodSurface.buttons.recommend}</button>
          </div>
        </form>
        <div id="explore-food-results">
          ${emptyStateMarkup({
            title: copy.foodSurface.empty.initialTitle,
            body: copy.foodSurface.empty.initialBody,
          })}
        </div>
      </article>
    </section>
  `;

  fillSelect(root.querySelector("#explore-user-filter"), users, {
    includeBlank: true,
    blankLabel: copy.destinationSurface.blankLabels.traveler,
  });
  fillSelect(root.querySelector("#explore-food-user"), users, {
    includeBlank: true,
    blankLabel: copy.foodSurface.blankLabels.traveler,
  });
  fillSelect(root.querySelector("#explore-category"), categories, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: copy.destinationSurface.blankLabels.category,
  });
  fillSelect(root.querySelector("#explore-food-cuisine"), cuisines, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: copy.foodSurface.blankLabels.cuisine,
  });
  app.applySelectorBindings(root, destinationBindings?.selectorBindings);
  root.querySelector("#explore-facility-destination").value = defaultDestinationId;
  root.querySelector("#explore-food-destination").value = defaultDestinationId;

  const destinationResults = root.querySelector("#explore-destination-results");
  const facilityResults = root.querySelector("#explore-facility-results");
  const foodResults = root.querySelector("#explore-food-results");
  const facilityForm = root.querySelector("#explore-facility-form");
  const queryInput = root.querySelector("#explore-query");
  const categorySelect = root.querySelector("#explore-category");
  const userSelect = root.querySelector("#explore-user-filter");
  const limitInput = root.querySelector("#explore-limit");
  const facilityDestinationSelect = root.querySelector("#explore-facility-destination");
  const facilityNodeSelect = root.querySelector("#explore-facility-node");
  const foodDestinationSelect = root.querySelector("#explore-food-destination");
  const foodQueryInput = root.querySelector("#explore-food-query");
  const foodCuisineSelect = root.querySelector("#explore-food-cuisine");
  const foodUserSelect = root.querySelector("#explore-food-user");

  let disposed = false;
  let destinationRequestToken = 0;
  let foodRequestToken = 0;
  let facilityNodeRequestToken = 0;
  let facilityNodesLoadedFor = "";
  let facilitySurfaceTouched = false;

  function setFacilityNodePlaceholder(label) {
    fillSelect(facilityNodeSelect, [], {
      includeBlank: true,
      blankLabel: label,
      selectedValue: "",
    });
  }

  async function syncFacilityNodes(destinationId, options = {}) {
    const token = facilityNodeRequestToken + 1;
    facilityNodeRequestToken = token;

    if (!destinationId) {
      facilityNodesLoadedFor = "";
      setFacilityNodePlaceholder(copy.facilitySurface.placeholders.chooseDestination);
      return;
    }
    if (!options.force && facilityNodesLoadedFor === destinationId) {
      return;
    }

    setFacilityNodePlaceholder(copy.facilitySurface.placeholders.loadingNodes);
    const details = await app.ensureDestinationDetails(destinationId);
    if (
      disposed ||
      token !== facilityNodeRequestToken ||
      facilityDestinationSelect.value !== destinationId ||
      !details
    ) {
      return;
    }
    const nodes = safeArray(details.graph?.nodes).map((node) => ({
      id: node.id,
      name: `${node.name} (${node.id.split("-").slice(-1)[0]})`,
    }));
    facilityNodesLoadedFor = destinationId;
    if (!nodes.length) {
      setFacilityNodePlaceholder(copy.facilitySurface.placeholders.noNodes);
      return;
    }
    fillSelect(facilityNodeSelect, nodes);
  }

  async function primeFacilityNodes() {
    facilitySurfaceTouched = true;
    await syncFacilityNodes(facilityDestinationSelect.value);
  }

  async function runDestinationSearch(mode) {
    const token = destinationRequestToken + 1;
    destinationRequestToken = token;

    const params = new URLSearchParams();
    const query = queryInput.value.trim();
    const category = categorySelect.value;
    const userId = userSelect.value;
    const limit = limitInput.value;

    if (query) {
      params.set("query", query);
    }
    if (category) {
      params.set("category", category);
    }
    if (userId) {
      params.set("userId", userId);
    }
    if (limit) {
      params.set("limit", limit);
    }

    const endpoint =
      mode === "recommend"
        ? `/api/destinations/recommendations${params.toString() ? `?${params.toString()}` : ""}`
        : `/api/destinations${params.toString() ? `?${params.toString()}` : ""}`;
    const payload = await app.requestJson(endpoint);
    if (disposed || token !== destinationRequestToken) {
      return;
    }

    const items = safeArray(payload.items);
    destinationResults.innerHTML = items.length
      ? items.map((item) => destinationCardMarkup(app, item, route)).join("")
      : emptyStateMarkup({
          title: copy.destinationSurface.empty.noMatchesTitle,
          body: copy.destinationSurface.empty.noMatchesBody,
        });
  }

  async function runFoodLookup(mode) {
    const token = foodRequestToken + 1;
    foodRequestToken = token;
    const requestedDestinationId = foodDestinationSelect.value;

    const params = new URLSearchParams({
      destinationId: requestedDestinationId,
    });
    const cuisine = foodCuisineSelect.value;
    const query = foodQueryInput.value.trim();
    const userId = foodUserSelect.value;

    if (cuisine) {
      params.set("cuisine", cuisine);
    }
    if (query) {
      params.set("query", query);
    }
    if (userId) {
      params.set("userId", userId);
    }

    const endpoint =
      mode === "recommend"
        ? `/api/foods/recommendations?${params.toString()}`
        : `/api/foods/search?${params.toString()}`;
    const payload = await app.requestJson(endpoint);
    if (disposed || token !== foodRequestToken) {
      return;
    }
    const items = safeArray(payload.items);
    foodResults.innerHTML = items.length
      ? `<div class="story-grid">${items
          .map((item) =>
            foodCardMarkup(app, item, {
              destinationId: requestedDestinationId,
              actor: routeActor,
            }),
          )
          .join("")}</div>`
      : emptyStateMarkup({
          title: copy.foodSurface.empty.noMatchesTitle,
          body: copy.foodSurface.empty.noMatchesBody,
        });
  }

  const debouncedDestinationSearch = app.debounce(() => {
    const query = queryInput.value.trim();
    const category = categorySelect.value;
    if (!query && !category) {
      return;
    }
    void runDestinationSearch("search").catch(() => app.setStatus(copy.status.destinationSearchFailed, "error"));
  }, 320);

  const debouncedFoodSearch = app.debounce(() => {
    const query = foodQueryInput.value.trim();
    if (!query) {
      return;
    }
    void runFoodLookup("search").catch(() => app.setStatus(copy.status.foodSearchFailed, "error"));
  }, 320);

  root.querySelector("#explore-destination-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runDestinationSearch("search");
    } catch (error) {
      app.setStatus(copy.status.destinationSearchFailed, "error");
    }
  });

  root.querySelector("#explore-destination-recommend").addEventListener("click", async () => {
    try {
      await runDestinationSearch("recommend");
    } catch (error) {
      app.setStatus(copy.status.recommendationFailed, "error");
    }
  });

  root.querySelector("#explore-refresh-destinations").addEventListener("click", () => {
    destinationResults.innerHTML = featuredDestinations.length
      ? featuredDestinations.map((item) => destinationCardMarkup(app, item, route)).join("")
      : emptyStateMarkup({
          title: copy.destinationSurface.empty.featuredUnavailableTitle,
          body: copy.destinationSurface.empty.featuredUnavailableBody,
        });
  });

  queryInput.addEventListener("input", debouncedDestinationSearch);
  categorySelect.addEventListener("change", debouncedDestinationSearch);
  facilityForm.addEventListener("focusin", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus(copy.status.facilitySyncFailed, "error"),
    );
  });
  facilityForm.addEventListener("pointerdown", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus(copy.status.facilitySyncFailed, "error"),
    );
  });
  facilityDestinationSelect.addEventListener("change", () => {
    facilitySurfaceTouched = true;
    void syncFacilityNodes(facilityDestinationSelect.value, { force: true }).catch((error) =>
      app.setStatus(copy.status.facilitySyncFailed, "error"),
    );
  });

  root.querySelector("#explore-facility-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (!facilitySurfaceTouched || facilityNodesLoadedFor !== facilityDestinationSelect.value) {
        facilitySurfaceTouched = true;
        await syncFacilityNodes(facilityDestinationSelect.value, { force: true });
      }
      const params = new URLSearchParams({
        destinationId: facilityDestinationSelect.value,
        fromNodeId: facilityNodeSelect.value,
        category: root.querySelector("#explore-facility-category").value,
        radius: root.querySelector("#explore-facility-radius").value,
      });
      const payload = await app.requestJson(`/api/facilities/nearby?${params.toString()}`);
      facilityResults.innerHTML = safeArray(payload.item?.items).length
        ? `<div class="story-grid">${safeArray(payload.item.items)
            .map((item) =>
              facilityCardMarkup(app, item, {
                destinationId: payload.item.destinationId,
                fromNodeId: payload.item.fromNodeId,
                actor: routeActor,
              }),
            )
            .join("")}</div>`
        : emptyStateMarkup({
            title: copy.facilitySurface.empty.noMatchesTitle,
            body: copy.facilitySurface.empty.noMatchesBody,
          });
    } catch (error) {
      app.setStatus(copy.status.facilitySearchFailed, "error");
    }
  });

  root.querySelector("#explore-food-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runFoodLookup("search");
    } catch (error) {
      app.setStatus(copy.status.foodSearchFailed, "error");
    }
  });

  root.querySelector("#explore-food-recommend").addEventListener("click", async () => {
    try {
      await runFoodLookup("recommend");
    } catch (error) {
      app.setStatus(copy.status.foodRecommendationFailed, "error");
    }
  });

  foodQueryInput.addEventListener("input", debouncedFoodSearch);
  foodCuisineSelect.addEventListener("change", debouncedFoodSearch);

  setFacilityNodePlaceholder(copy.facilitySurface.placeholders.chooseDestination);
  try {
    await runFoodLookup("recommend");
  } catch (error) {
    foodResults.innerHTML = noticeMarkup(
      "note",
      copy.foodSurface.notice.unavailableTitle,
      copy.foodSurface.notice.unavailableBody,
    );
  }

  return () => {
    disposed = true;
    debouncedDestinationSearch.cancel();
    debouncedFoodSearch.cancel();
  };
}
