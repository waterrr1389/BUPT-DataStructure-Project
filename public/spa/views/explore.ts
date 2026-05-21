// @ts-nocheck

import {
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
  const mapHref = buildContextualMapHref(app, { destinationId: item.id }, context);
  const composeHref = createRouteContextHref("/compose", { destinationId: item.id }, context);
  const tags = safeArray(item.categories).map((category) => displayDestinationTagLabel(category));

  return `
    <article class="story-card destination-card">
      <p class="muted">${escapeHtml(displayDestinationMeta(item.type, item.region))}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`热度 ${item.heat}`, `评分 ${item.rating}`, `${item.nodeCount} 个节点`])}
      <p>${escapeHtml(item.description)}</p>
      ${app.tagsMarkup(tags)}
      <div class="story-card-actions">
        <a class="inline-link" href="${mapHref}" data-nav="true">在地图中打开</a>
        <a class="inline-link" href="${composeHref}" data-nav="true">写一篇笔记</a>
      </div>
    </article>
  `;
}

/**
 * Renders a facility result card that deep-links into the map preview state.
 */
function facilityCardMarkup(app: SpaApp, item, context) {
  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(displayLabel(facilityCategoryLabels, item.category, text(item.category)))} · ${escapeHtml(item.openHours)}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`距离 ${item.distance} 米`, `${safeArray(item.nodePath).length} 段路径`])}
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
          在地图中打开
        </a>
      </div>
    </article>
  `;
}

/**
 * Renders a food result card with a direct contextual map link.
 */
function foodCardMarkup(app: SpaApp, item, context) {
  const keywords = safeArray(item.keywords).map((keyword) => displayFoodKeywordLabel(keyword));

  return `
    <article class="story-card compact-story-card">
      <p class="muted">${escapeHtml(displayFoodMeta(item.cuisine, item.venue))}</p>
      <h3>${escapeHtml(item.name)}</h3>
      ${resultMetaMarkup([`评分 ${item.rating}`, `热度 ${item.heat}`, `均价 US$${item.avgPrice}`])}
      ${app.tagsMarkup(keywords)}
      <div class="story-card-actions">
        <a
          class="inline-link"
          href="${buildContextualMapHref(app, { destinationId: context.destinationId }, context)}"
          data-nav="true"
        >
          在地图中打开
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
  app.setDocumentTitle("探索");

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
        <p class="eyebrow">探索</p>
        <h1>先找到下一个地点，再在需要时展开更重的工具。</h1>
        <p class="route-lede">
          目的地卡片先引导浏览，美食发现和附近设施作为辅助工作区保留。只有在地图相关控件需要时，页面才会加载完整目的地图结构。
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">信息结构</p>
        <ul class="hero-list">
          <li>目的地推荐和搜索仍然是主入口。</li>
          <li>美食和设施工具保持可用，但不压过首屏内容。</li>
          <li>相关结果都可以直接交接到地图。</li>
        </ul>
      </div>
    </section>

    <section class="explore-grid">
      <article class="surface-card span-two">
        <div class="section-head">
          <div>
            <p class="section-tag">目的地卡组</p>
            <h2>由推荐引导的发现</h2>
          </div>
          <button id="explore-refresh-destinations" class="ghost" type="button">刷新精选</button>
        </div>
        <form class="control-grid" id="explore-destination-form">
          <label>
            旅行者视角
            <select id="explore-user-filter"></select>
          </label>
          <label>
            搜索词
            <input id="explore-query" type="text" placeholder="港湾、博物馆、校园庭院" />
          </label>
          <label>
            分类
            <select id="explore-category"></select>
          </label>
          <label>
            数量
            <input id="explore-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">搜索目的地</button>
            <button type="button" id="explore-destination-recommend" class="ghost">获取推荐</button>
          </div>
        </form>
        <div id="explore-destination-results" class="story-grid">
          ${featuredDestinations.map((item) => destinationCardMarkup(app, item, route)).join("")}
        </div>
      </article>

      <article class="surface-card">
        <div class="section-head">
          <div>
            <p class="section-tag">附近设施</p>
            <h2>保留实用工具，不做成仪表盘</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-facility-form">
          <label>
            目的地
            <select id="explore-facility-destination"></select>
          </label>
          <label>
            起始节点
            <select id="explore-facility-node"></select>
          </label>
          <label>
            分类
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
            半径
            <input id="explore-facility-radius" type="number" min="100" step="50" value="900" />
          </label>
          <button type="submit">查找设施</button>
        </form>
        <div id="explore-facility-results">
          ${emptyStateMarkup({
            title: "按需查找设施",
            body: "选择目的地和起始节点后，这里会显示附近洗手间、医疗点、休息区和其他场地设施。",
          })}
        </div>
      </article>

      <article class="surface-card">
        <div class="section-head">
          <div>
            <p class="section-tag">美食指南</p>
            <h2>让吃饭选择容易被发现，而不是被埋起来</h2>
          </div>
        </div>
        <form class="control-grid" id="explore-food-form">
          <label>
            目的地
            <select id="explore-food-destination"></select>
          </label>
          <label>
            旅行者视角
            <select id="explore-food-user"></select>
          </label>
          <label>
            菜系
            <select id="explore-food-cuisine"></select>
          </label>
          <label>
            搜索词
            <input id="explore-food-query" type="text" placeholder="茶、烧烤、面、点心" />
          </label>
          <div class="button-row">
            <button type="submit">搜索美食</button>
            <button type="button" id="explore-food-recommend" class="ghost">获取推荐</button>
          </div>
        </form>
        <div id="explore-food-results">
          ${emptyStateMarkup({
            title: "美食推荐已准备好",
            body: "可以用菜系、旅行者视角或自由文本查找附近餐饮地点，无需离开探索页。",
          })}
        </div>
      </article>
    </section>
  `;

  fillSelect(root.querySelector("#explore-user-filter"), users, {
    includeBlank: true,
    blankLabel: "任意旅行者",
  });
  fillSelect(root.querySelector("#explore-food-user"), users, {
    includeBlank: true,
    blankLabel: "任意旅行者",
  });
  fillSelect(root.querySelector("#explore-category"), categories, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: "任意分类",
  });
  fillSelect(root.querySelector("#explore-food-cuisine"), cuisines, {
    value: "id",
    label: "name",
    includeBlank: true,
    blankLabel: "任意菜系",
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
      setFacilityNodePlaceholder("选择目的地后加载节点");
      return;
    }
    if (!options.force && facilityNodesLoadedFor === destinationId) {
      return;
    }

    setFacilityNodePlaceholder("正在加载节点...");
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
      setFacilityNodePlaceholder("此目的地暂无可用节点");
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
          title: "没有匹配的目的地",
          body: "可以放宽搜索词，或切换到推荐模式重新开始。",
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
          title: "暂时没有美食结果",
          body: "调整菜系、旅行者视角或搜索词，查看其他附近选择。",
        });
  }

  const debouncedDestinationSearch = app.debounce(() => {
    const query = queryInput.value.trim();
    const category = categorySelect.value;
    if (!query && !category) {
      return;
    }
    void runDestinationSearch("search").catch(() => app.setStatus("目的地搜索失败。", "error"));
  }, 320);

  const debouncedFoodSearch = app.debounce(() => {
    const query = foodQueryInput.value.trim();
    if (!query) {
      return;
    }
    void runFoodLookup("search").catch(() => app.setStatus("美食搜索失败。", "error"));
  }, 320);

  root.querySelector("#explore-destination-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runDestinationSearch("search");
    } catch (error) {
      app.setStatus("目的地搜索失败。", "error");
    }
  });

  root.querySelector("#explore-destination-recommend").addEventListener("click", async () => {
    try {
      await runDestinationSearch("recommend");
    } catch (error) {
      app.setStatus("推荐加载失败。", "error");
    }
  });

  root.querySelector("#explore-refresh-destinations").addEventListener("click", () => {
    destinationResults.innerHTML = featuredDestinations.length
      ? featuredDestinations.map((item) => destinationCardMarkup(app, item, route)).join("")
      : emptyStateMarkup({
          title: "精选目的地暂时不可用",
          body: "基础数据未返回任何精选地点。",
        });
  });

  queryInput.addEventListener("input", debouncedDestinationSearch);
  categorySelect.addEventListener("change", debouncedDestinationSearch);
  facilityForm.addEventListener("focusin", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus("节点同步失败。", "error"),
    );
  });
  facilityForm.addEventListener("pointerdown", () => {
    if (facilitySurfaceTouched) {
      return;
    }
    void primeFacilityNodes().catch((error) =>
      app.setStatus("节点同步失败。", "error"),
    );
  });
  facilityDestinationSelect.addEventListener("change", () => {
    facilitySurfaceTouched = true;
    void syncFacilityNodes(facilityDestinationSelect.value, { force: true }).catch((error) =>
      app.setStatus("节点同步失败。", "error"),
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
            title: "范围内没有设施",
            body: "扩大搜索半径或调整起始节点，查看更多附近设施。",
          });
    } catch (error) {
      app.setStatus("设施查找失败。", "error");
    }
  });

  root.querySelector("#explore-food-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runFoodLookup("search");
    } catch (error) {
      app.setStatus("美食搜索失败。", "error");
    }
  });

  root.querySelector("#explore-food-recommend").addEventListener("click", async () => {
    try {
      await runFoodLookup("recommend");
    } catch (error) {
      app.setStatus("美食推荐失败。", "error");
    }
  });

  foodQueryInput.addEventListener("input", debouncedFoodSearch);
  foodCuisineSelect.addEventListener("change", debouncedFoodSearch);

  setFacilityNodePlaceholder("选择目的地后加载节点");
  try {
    await runFoodLookup("recommend");
  } catch (error) {
    foodResults.innerHTML = noticeMarkup(
      "note",
      "美食推荐暂时不可用",
      "美食查找失败。",
    );
  }

  return () => {
    disposed = true;
    debouncedDestinationSearch.cancel();
    debouncedFoodSearch.cancel();
  };
}
