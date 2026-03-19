import {
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  noticeMarkup,
  parseListInput,
  resultMetaMarkup,
  safeArray,
  text,
} from "../lib.js";

function destinationCardMarkup(app, item) {
  return `
    <article class="story-card destination-card">
      <p class="muted">${escapeHtml(item.type)} · ${escapeHtml(item.region)}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`heat ${item.heat}`, `rating ${item.rating}`, `${item.nodeCount} nodes`])}
      <p>${escapeHtml(item.description)}</p>
      ${app.tagsMarkup(item.categories)}
      <div class="story-card-actions">
        <a class="inline-link" href="/map?destinationId=${encodeURIComponent(item.id)}" data-nav="true">Open in map</a>
        <a class="inline-link" href="/compose?destinationId=${encodeURIComponent(item.id)}" data-nav="true">Write a note</a>
      </div>
    </article>
  `;
}

function facilityCardMarkup(app, item, context) {
  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(item.category)} · ${escapeHtml(item.openHours)}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`${item.distance} m away`, `${safeArray(item.nodePath).length} hops`])}
      <p class="muted">${safeArray(item.nodePath).map((nodeId) => escapeHtml(nodeId)).join(" → ")}</p>
      <div class="story-card-actions">
        <a
          class="inline-link"
          href="${app.buildMapHref({
            destinationId: context.destinationId,
            from: context.fromNodeId,
            to: item.nodeId,
          })}"
          data-nav="true"
        >
          Open in map
        </a>
      </div>
    </article>
  `;
}

function foodCardMarkup(app, item, destinationId) {
  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(item.cuisine)} · ${escapeHtml(item.venue)}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`rating ${item.rating}`, `heat ${item.heat}`, `$${item.avgPrice}`])}
      ${app.tagsMarkup(item.keywords)}
      <div class="story-card-actions">
        <a class="inline-link" href="${app.buildMapHref({ destinationId })}" data-nav="true">Open in map</a>
      </div>
    </article>
  `;
}

export async function render(app, route, root) {
  app.setDocumentTitle("Explore");

  const bootstrap = await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const featuredDestinations = app.getFeaturedDestinations();
  const users = safeArray(bootstrap?.users);
  const categories = app.getCategories().map((category) => ({ id: category, name: category }));
  const cuisines = app.getCuisines().map((cuisine) => ({ id: cuisine, name: cuisine }));
  const defaultDestinationId = app.getDestinationOptions()[0]?.id || "";

  root.innerHTML = `
    <section class="route-hero route-hero-explore">
      <div class="route-hero-copy">
        <p class="eyebrow">Explore</p>
        <h1>Find the next place first, then reveal the heavier tools only when they matter.</h1>
        <p class="route-lede">
          Editorial destination cards lead the page, while food discovery and nearby facilities stay available as secondary working surfaces. Full destination graphs are fetched only when a map-related control needs them.
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Information architecture</p>
        <ul class="hero-list">
          <li>Destination recommendation and search stay primary.</li>
          <li>Food and facility tools remain present without overwhelming the first viewport.</li>
          <li>Every relevant result has a direct map handoff.</li>
        </ul>
      </div>
    </section>

    <section class="explore-grid">
      <article class="surface-card span-two">
        <div class="section-head">
          <div>
            <p class="section-tag">Destination deck</p>
            <h2>Recommendation-led discovery</h2>
          </div>
          <button id="explore-refresh-destinations" class="ghost" type="button">Refresh featured</button>
        </div>
        <form class="control-grid" id="explore-destination-form">
          <label>
            Traveler context
            <select id="explore-user-filter"></select>
          </label>
          <label>
            Query
            <input id="explore-query" type="text" placeholder="harbor, museum, campus courtyard" />
          </label>
          <label>
            Category
            <select id="explore-category"></select>
          </label>
          <label>
            Limit
            <input id="explore-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">Search destinations</button>
            <button type="button" id="explore-destination-recommend" class="ghost">Recommend</button>
          </div>
        </form>
        <div id="explore-destination-results" class="story-grid">
          ${featuredDestinations.map((item) => destinationCardMarkup(app, item)).join("")}
        </div>
      </article>

      <article class="surface-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Nearby facilities</p>
            <h2>Utility without a dashboard feel</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-facility-form">
          <label>
            Destination
            <select id="explore-facility-destination"></select>
          </label>
          <label>
            From node
            <select id="explore-facility-node"></select>
          </label>
          <label>
            Category
            <select id="explore-facility-category">
              <option value="all">all</option>
              <option value="restroom">restroom</option>
              <option value="clinic">clinic</option>
              <option value="store">store</option>
              <option value="charging">charging</option>
              <option value="info">info</option>
              <option value="parking">parking</option>
              <option value="water">water</option>
              <option value="atm">atm</option>
              <option value="security">security</option>
              <option value="lounge">lounge</option>
            </select>
          </label>
          <label>
            Radius
            <input id="explore-facility-radius" type="number" min="100" step="50" value="900" />
          </label>
          <button type="submit">Find facilities</button>
        </form>
        <div id="explore-facility-results">
          ${emptyStateMarkup({
            title: "Facility lookup stays on demand",
            body: "Choose a destination and starting node to surface nearby restrooms, clinics, lounges, and other campus utilities.",
          })}
        </div>
      </article>

      <article class="surface-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Food compass</p>
            <h2>Keep meals discoverable, not buried</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-food-form">
          <label>
            Destination
            <select id="explore-food-destination"></select>
          </label>
          <label>
            Traveler context
            <select id="explore-food-user"></select>
          </label>
          <label>
            Cuisine
            <select id="explore-food-cuisine"></select>
          </label>
          <label>
            Query
            <input id="explore-food-query" type="text" placeholder="tea, grill, noodle, pastry" />
          </label>
          <div class="button-row">
            <button type="submit">Search food</button>
            <button type="button" id="explore-food-recommend" class="ghost">Recommend</button>
          </div>
        </form>
        <div id="explore-food-results">
          ${emptyStateMarkup({
            title: "Food recommendations are ready",
            body: "Use cuisine, traveler context, or free text to surface nearby places to eat without leaving Explore.",
          })}
        </div>
      </article>
    </section>
  `;

  fillSelect(root.querySelector("#explore-user-filter"), users, {
    includeBlank: true,
    blankLabel: "any traveler",
  });
  fillSelect(root.querySelector("#explore-food-user"), users, {
    includeBlank: true,
    blankLabel: "any traveler",
  });
  fillSelect(root.querySelector("#explore-category"), categories, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: "any category",
  });
  fillSelect(root.querySelector("#explore-food-cuisine"), cuisines, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: "any cuisine",
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
    if (!destinationId) {
      facilityNodesLoadedFor = "";
      setFacilityNodePlaceholder("Select a destination to load nodes");
      return;
    }
    if (!options.force && facilityNodesLoadedFor === destinationId) {
      return;
    }

    setFacilityNodePlaceholder("Loading nodes...");
    const details = await app.ensureDestinationDetails(destinationId);
    if (disposed || !details) {
      return;
    }
    const nodes = safeArray(details.graph?.nodes).map((node) => ({
      id: node.id,
      name: `${node.name} (${node.id.split("-").slice(-1)[0]})`,
    }));
    facilityNodesLoadedFor = destinationId;
    if (!nodes.length) {
      setFacilityNodePlaceholder("No nodes available for this destination");
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
      ? items.map((item) => destinationCardMarkup(app, item)).join("")
      : emptyStateMarkup({
          title: "No destinations matched",
          body: "Try a broader query or swap to recommendations for a calmer starting point.",
        });
  }

  async function runFoodLookup(mode) {
    const token = foodRequestToken + 1;
    foodRequestToken = token;

    const params = new URLSearchParams({
      destinationId: foodDestinationSelect.value,
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
      ? `<div class="story-grid">${items.map((item) => foodCardMarkup(app, item, foodDestinationSelect.value)).join("")}</div>`
      : emptyStateMarkup({
          title: "No food results yet",
          body: "Adjust cuisine, traveler context, or text to reveal another nearby option.",
        });
  }

  const debouncedDestinationSearch = app.debounce(() => {
    const query = queryInput.value.trim();
    const category = categorySelect.value;
    if (!query && !category) {
      return;
    }
    void runDestinationSearch("search").catch((error) => app.setStatus(error.message, "error"));
  }, 320);

  const debouncedFoodSearch = app.debounce(() => {
    const query = foodQueryInput.value.trim();
    if (!query) {
      return;
    }
    void runFoodLookup("search").catch((error) => app.setStatus(error.message, "error"));
  }, 320);

  root.querySelector("#explore-destination-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runDestinationSearch("search");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Destination search failed.", "error");
    }
  });

  root.querySelector("#explore-destination-recommend").addEventListener("click", async () => {
    try {
      await runDestinationSearch("recommend");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Recommendation failed.", "error");
    }
  });

  root.querySelector("#explore-refresh-destinations").addEventListener("click", () => {
    destinationResults.innerHTML = featuredDestinations.length
      ? featuredDestinations.map((item) => destinationCardMarkup(app, item)).join("")
      : emptyStateMarkup({
          title: "Featured destinations unavailable",
          body: "Bootstrap did not return any featured places.",
        });
  });

  queryInput.addEventListener("input", debouncedDestinationSearch);
  categorySelect.addEventListener("change", debouncedDestinationSearch);
  facilityForm.addEventListener("focusin", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus(error instanceof Error ? error.message : "Node sync failed.", "error"),
    );
  });
  facilityForm.addEventListener("pointerdown", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus(error instanceof Error ? error.message : "Node sync failed.", "error"),
    );
  });
  facilityDestinationSelect.addEventListener("change", () => {
    facilitySurfaceTouched = true;
    void syncFacilityNodes(facilityDestinationSelect.value, { force: true }).catch((error) =>
      app.setStatus(error instanceof Error ? error.message : "Node sync failed.", "error"),
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
              }),
            )
            .join("")}</div>`
        : emptyStateMarkup({
            title: "No facilities within range",
            body: "Expand the search radius or shift the starting node to reveal more nearby utilities.",
          });
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Facility lookup failed.", "error");
    }
  });

  root.querySelector("#explore-food-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runFoodLookup("search");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Food search failed.", "error");
    }
  });

  root.querySelector("#explore-food-recommend").addEventListener("click", async () => {
    try {
      await runFoodLookup("recommend");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Food recommendation failed.", "error");
    }
  });

  foodQueryInput.addEventListener("input", debouncedFoodSearch);
  foodCuisineSelect.addEventListener("change", debouncedFoodSearch);

  setFacilityNodePlaceholder("Select a destination to load nodes");
  try {
    await runFoodLookup("recommend");
  } catch (error) {
    foodResults.innerHTML = noticeMarkup(
      "note",
      "Food recommendations unavailable",
      error instanceof Error ? error.message : "Food lookup failed.",
    );
  }

  return () => {
    disposed = true;
    debouncedDestinationSearch.cancel();
    debouncedFoodSearch.cancel();
  };
}
