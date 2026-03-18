const state = {
  bootstrap: null,
  destinationDetails: new Map(),
  lastCompressed: "",
};

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

function renderRouteResult(item) {
  const target = document.querySelector("#route-result");
  if (!item) {
    target.innerHTML = emptyMarkup();
    return;
  }
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
      <h4>Steps</h4>
      <div class="tag-row">
        ${item.steps
          .map((step) => `<span class="tag">${step.from.split("-").slice(-1)[0]} to ${step.to.split("-").slice(-1)[0]} (${step.mode})</span>`)
          .join("")}
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
  return `
    <article class="result-card" data-journal-id="${item.id}">
      <p class="muted">${item.destinationId} / ${item.userId}</p>
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
  const destinations = bootstrap.featured;
  const categories = bootstrap.categories.map((category) => ({ id: category, name: category }));
  const cuisines = bootstrap.cuisines.map((cuisine) => ({ id: cuisine, name: cuisine }));

  fillSelect("#destination-user", users, { includeAny: true });
  fillSelect("#journal-user", users);
  fillSelect("#food-user", users, { includeAny: true });
  fillSelect("#destination-category", categories, { value: "id", label: "name", includeAny: true });
  fillSelect("#food-cuisine", cuisines, { value: "id", label: "name", includeAny: true });

  [
    "#route-destination",
    "#facility-destination",
    "#journal-destination",
    "#exchange-destination",
    "#food-destination",
  ].forEach((selector) => fillSelect(selector, destinations));

  renderDestinations(destinations);
  setStatus(`Runtime data: ${bootstrap.source.data}. Algorithms: ${bootstrap.source.algorithms}.`);

  const firstDestinationId = destinations[0]?.id;
  if (firstDestinationId) {
    await syncNodeSelects(firstDestinationId, ["#route-start", "#route-end", "#facility-node"]);
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
  await syncNodeSelects(event.target.value, ["#route-start", "#route-end"]);
}

async function handleFacilityDestinationChange(event) {
  await syncNodeSelects(event.target.value, ["#facility-node"]);
}

async function handleRouteSubmit(event) {
  event.preventDefault();
  const payload = await api("/api/routes/plan", {
    method: "POST",
    body: JSON.stringify({
      destinationId: document.querySelector("#route-destination").value,
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
  renderRouteResult(payload.item);
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
