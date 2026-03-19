import {
  createUrl,
  debounce,
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  isPrimaryNavigationEvent,
  noticeMarkup,
  resultMetaMarkup,
  safeArray,
  tagsMarkup,
  text,
} from "./lib.js";

function requireHelperApi(name) {
  const api = globalThis[name];
  if (!api) {
    throw new Error(`${name} failed to load.`);
  }
  return api;
}

const journalPresentation = requireHelperApi("JournalPresentation");
const journalConsumers = requireHelperApi("JournalConsumers");

const viewLoaders = {
  home: () => import("./views/home.js"),
  explore: () => import("./views/explore.js"),
  map: () => import("./views/map.js"),
  feed: () => import("./views/feed.js"),
  compose: () => import("./views/compose.js"),
  post: () => import("./views/post-detail.js"),
  notFound: () => import("./views/not-found.js"),
};

function routeNameFromPath(pathname) {
  if (pathname === "/") {
    return { name: "home" };
  }
  if (pathname === "/explore") {
    return { name: "explore" };
  }
  if (pathname === "/map") {
    return { name: "map" };
  }
  if (pathname === "/feed") {
    return { name: "feed" };
  }
  if (pathname === "/compose") {
    return { name: "compose" };
  }
  const postMatch = pathname.match(/^\/posts\/([^/]+)$/);
  if (postMatch) {
    return {
      name: "post",
      journalId: decodeURIComponent(postMatch[1]),
    };
  }
  return { name: "notFound" };
}

function parseRoute(url = new URL(window.location.href)) {
  const base = routeNameFromPath(url.pathname);
  return {
    ...base,
    pathname: url.pathname,
    search: url.search,
    params: {
      destinationId: url.searchParams.get("destinationId") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      waypoints: url.searchParams.get("waypoints") ?? "",
      strategy: url.searchParams.get("strategy") ?? "",
      mode: url.searchParams.get("mode") ?? "",
      actor: url.searchParams.get("actor") ?? "",
      author: url.searchParams.get("author") ?? "",
    },
  };
}

export function createAppShell(root) {
  const state = {
    bootstrap: null,
    bootstrapPromise: null,
    destinationDetails: new Map(),
    destinationById: new Map(),
    userById: new Map(),
    destinationOptions: [],
    featuredDestinations: [],
    categories: [],
    cuisines: [],
    destinationBindings: null,
    journalBindings: null,
    mapScenes: new Map(),
    currentRoute: null,
    currentCleanup: null,
    renderToken: 0,
    lastCompressed: "",
    socialAvailability: {
      feed: null,
      comments: null,
      likes: null,
    },
  };

  const dom = {
    root,
    shell: null,
    nav: null,
    viewRoot: null,
    status: null,
    navToggle: null,
    backToTop: null,
  };

  function setDocumentTitle(title) {
    document.title = title ? `${title} • Trail Atlas` : "Trail Atlas";
  }

  function setStatus(message, tone = "neutral") {
    if (!dom.status) {
      return;
    }
    dom.status.textContent = text(message, "Runtime ready.");
    dom.status.dataset.tone = tone;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed: ${response.status}`);
    }

    return payload;
  }

  async function requestJsonMaybe(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      payload,
      missing: response.status === 404,
      error: payload?.error || (response.ok ? "" : `Request failed: ${response.status}`),
    };
  }

  function buildMapHref(params = {}) {
    return createUrl("/map", params);
  }

  function buildPostHref(journalId) {
    return `/posts/${encodeURIComponent(text(journalId))}`;
  }

  async function loadBootstrap() {
    if (state.bootstrap) {
      return state.bootstrap;
    }

    if (!state.bootstrapPromise) {
      state.bootstrapPromise = (async () => {
        const bootstrap = await requestJson("/api/bootstrap");
        const prepared = journalConsumers.prepareDestinationSelectorBindings(
          bootstrap,
          journalPresentation.createDestinationSelectOptions,
        );
        const journalPrepared = journalConsumers.prepareJournalExchangeDestinationBindings(
          bootstrap,
          journalPresentation.createDestinationSelectOptions,
        );

        state.bootstrap = bootstrap;
        state.destinationBindings = prepared;
        state.journalBindings = journalPrepared;
        state.destinationOptions = prepared.destinationOptions;
        state.featuredDestinations = prepared.featuredDestinations;
        state.destinationById = prepared.destinationById;
        state.userById = new Map(safeArray(bootstrap.users).map((user) => [user.id, user]));
        state.categories = safeArray(bootstrap.categories);
        state.cuisines = safeArray(bootstrap.cuisines);

        setStatus(
          `Runtime data: ${text(bootstrap?.source?.data, "seeded")}. Algorithms: ${text(bootstrap?.source?.algorithms, "fallback")}.`,
          "success",
        );

        return bootstrap;
      })().catch((error) => {
        state.bootstrapPromise = null;
        throw error;
      });
    }

    return state.bootstrapPromise;
  }

  async function ensureDestinationDetails(destinationId) {
    const id = text(destinationId);
    if (!id) {
      return null;
    }
    if (state.destinationDetails.has(id)) {
      return state.destinationDetails.get(id);
    }
    const payload = await requestJson(`/api/destinations/${encodeURIComponent(id)}`);
    state.destinationDetails.set(id, payload);
    return payload;
  }

  function getUserName(userId) {
    return state.userById.get(userId)?.name || userId;
  }

  function getDestinationName(destinationId) {
    return state.destinationById.get(destinationId)?.name || destinationId;
  }

  function applySelectorBindings(container, bindings) {
    safeArray(bindings).forEach(({ selector, items, config }) => {
      const element = container.querySelector(selector);
      if (!element) {
        return;
      }
      fillSelect(element, items, config);
    });
  }

  function createJournalCard(item, options = {}) {
    const metadata = journalPresentation.formatJournalMetadata(item, {
      destinationById: state.destinationById,
      userById: state.userById,
    });

    return journalConsumers.journalCard(item, metadata, tagsMarkup, {
      mapHref: buildMapHref({ destinationId: item.destinationId }),
      postHref: buildPostHref(item.id),
      summarizeBody: journalPresentation.summarizeText,
      summaryLength: options.summaryLength || 220,
      hideDelete: options.hideDelete === true,
      hideSocialAction: options.hideSocialAction === true,
    });
  }

  function renderShell() {
    root.innerHTML = `
      <div class="site-shell">
        <div class="site-atmosphere"></div>
        <header class="site-header">
          <a href="/" class="site-brand" data-nav="true">
            <span class="site-brand-mark">Trail Atlas</span>
            <span class="site-brand-copy">A routed journal SPA for places, paths, and quiet memory.</span>
          </a>
          <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">Menu</button>
          <nav class="site-nav" id="site-nav" aria-label="Primary">
            <a href="/explore" data-nav="true" data-route-name="explore">Explore</a>
            <a href="/map" data-nav="true" data-route-name="map">Map</a>
            <a href="/feed" data-nav="true" data-route-name="feed">Feed</a>
            <a href="/compose" data-nav="true" data-route-name="compose">Compose</a>
          </nav>
          <div class="status-pill" id="status-pill" data-tone="neutral">Loading runtime…</div>
        </header>
        <main class="site-main">
          <div class="view-root" id="view-root">${noticeMarkup("loading", "Loading browser shell", "Preparing the routed travel journal experience.")}</div>
        </main>
        <button class="back-to-top" id="back-to-top" type="button" aria-label="Back to top">Back to top</button>
      </div>
    `;

    dom.shell = root.querySelector(".site-shell");
    dom.nav = root.querySelector("#site-nav");
    dom.viewRoot = root.querySelector("#view-root");
    dom.status = root.querySelector("#status-pill");
    dom.navToggle = root.querySelector("#nav-toggle");
    dom.backToTop = root.querySelector("#back-to-top");
  }

  function syncActiveNav(route) {
    if (!dom.nav) {
      return;
    }
    dom.nav.querySelectorAll("a[data-route-name]").forEach((link) => {
      const routeName = link.getAttribute("data-route-name");
      const active = route.name === routeName || (route.name === "post" && routeName === "feed");
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function setLoadingState(title, body) {
    if (!dom.viewRoot) {
      return;
    }
    dom.viewRoot.innerHTML = noticeMarkup("loading", title, body);
  }

  function closeNav() {
    if (!dom.shell || !dom.navToggle) {
      return;
    }
    dom.shell.classList.remove("is-nav-open");
    dom.navToggle.setAttribute("aria-expanded", "false");
  }

  function navigate(href, options = {}) {
    const url = new URL(href, window.location.origin);
    const current = `${window.location.pathname}${window.location.search}`;
    const next = `${url.pathname}${url.search}`;

    if (current === next && !options.force) {
      closeNav();
      return;
    }

    if (options.replace) {
      window.history.replaceState({}, "", next);
    } else {
      window.history.pushState({}, "", next);
    }

    closeNav();
    if (options.render !== false) {
      void renderRoute({ preserveScroll: options.preserveScroll === true });
    }
  }

  async function fetchFeed(filters = {}) {
    const params = new URLSearchParams();
    if (filters.destinationId) {
      params.set("destinationId", filters.destinationId);
    }
    if (filters.userId) {
      params.set("userId", filters.userId);
    }
    if (filters.limit) {
      params.set("limit", String(filters.limit));
    }
    if (filters.cursor) {
      params.set("cursor", filters.cursor);
    }

    const social = await requestJsonMaybe(`/api/feed${params.toString() ? `?${params.toString()}` : ""}`);
    if (social.ok) {
      state.socialAvailability.feed = true;
      return {
        items: safeArray(social.payload?.items),
        nextCursor: text(social.payload?.nextCursor),
        notice: "",
        source: "social",
      };
    }

    if (social.missing) {
      state.socialAvailability.feed = false;
    }

    const fallback = await requestJson(
      `/api/journals${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return {
      items: safeArray(fallback.items),
      nextCursor: "",
      notice:
        social.missing || /Unknown API endpoint/i.test(text(social.error))
          ? "Social feed endpoints are not available in this workspace yet. Showing the journal timeline instead."
          : text(social.error),
      source: "journal-list",
    };
  }

  async function fetchRecommendedJournals(filters = {}) {
    const params = new URLSearchParams();
    if (filters.destinationId) {
      params.set("destinationId", filters.destinationId);
    }
    if (filters.userId) {
      params.set("userId", filters.userId);
    }
    if (filters.limit) {
      params.set("limit", String(filters.limit));
    }

    const payload = await requestJson(
      `/api/journals/recommendations${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return safeArray(payload.items);
  }

  async function fetchJournalDetail(journalId) {
    const payload = await requestJson(`/api/journals/${encodeURIComponent(journalId)}`);
    return payload.item;
  }

  async function fetchJournalComments(journalId) {
    const response = await requestJsonMaybe(`/api/journals/${encodeURIComponent(journalId)}/comments`);
    if (response.ok) {
      state.socialAvailability.comments = true;
      return {
        available: true,
        items: safeArray(response.payload?.items),
        notice: "",
      };
    }

    if (response.missing || /Unknown API endpoint/i.test(text(response.error))) {
      state.socialAvailability.comments = false;
      return {
        available: false,
        items: [],
        notice: "Comments have not been wired in this workspace yet.",
      };
    }

    return {
      available: false,
      items: [],
      notice: text(response.error, "Comments could not be loaded."),
    };
  }

  async function createComment(journalId, userId, body) {
    const response = await requestJsonMaybe(`/api/journals/${encodeURIComponent(journalId)}/comments`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        body,
      }),
    });

    if (response.ok) {
      state.socialAvailability.comments = true;
      return {
        available: true,
        item: response.payload?.item ?? null,
        notice: "",
      };
    }

    if (response.missing || /Unknown API endpoint/i.test(text(response.error))) {
      state.socialAvailability.comments = false;
      return {
        available: false,
        item: null,
        notice: "Comment creation is waiting on the social backend endpoints.",
      };
    }

    throw new Error(text(response.error, "Comment creation failed."));
  }

  async function sendJournalAction(action, journalId, selectedUserId) {
    const request = journalConsumers.resolveJournalActionRequest(action, journalId, selectedUserId);
    if (!request) {
      throw new Error("Unsupported journal action.");
    }

    const maybe = await requestJsonMaybe(request.path, request.options);
    if (maybe.ok) {
      if (action === "like" || action === "unlike") {
        state.socialAvailability.likes = true;
      }
      return {
        available: true,
        payload: maybe.payload,
      };
    }

    if ((action === "like" || action === "unlike") && (maybe.missing || /Unknown API endpoint/i.test(text(maybe.error)))) {
      state.socialAvailability.likes = false;
      return {
        available: false,
        payload: null,
        notice: "Likes are not available in this workspace yet.",
      };
    }

    throw new Error(text(maybe.error, "Journal action failed."));
  }

  function installGlobalEvents() {
    root.addEventListener("click", (event) => {
      const target = event.target.closest("a[href]");
      if (!target || !isPrimaryNavigationEvent(event)) {
        return;
      }

      const href = target.getAttribute("href") || "";
      if (!href.startsWith("/")) {
        return;
      }
      if (target.getAttribute("target") === "_blank" || target.hasAttribute("download")) {
        return;
      }

      event.preventDefault();
      navigate(href);
    });

    dom.navToggle?.addEventListener("click", () => {
      if (!dom.shell || !dom.navToggle) {
        return;
      }
      const next = !dom.shell.classList.contains("is-nav-open");
      dom.shell.classList.toggle("is-nav-open", next);
      dom.navToggle.setAttribute("aria-expanded", next ? "true" : "false");
    });

    dom.backToTop?.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const syncScrollState = debounce(() => {
      if (!dom.backToTop) {
        return;
      }
      dom.backToTop.classList.toggle("is-visible", window.scrollY > 280);
    }, 40);

    window.addEventListener("scroll", syncScrollState, { passive: true });
    window.addEventListener("popstate", () => {
      closeNav();
      void renderRoute({ preserveScroll: true });
    });
    syncScrollState();
  }

  async function renderRoute(options = {}) {
    if (!dom.viewRoot) {
      return;
    }

    const route = parseRoute();
    state.currentRoute = route;
    syncActiveNav(route);

    const token = state.renderToken + 1;
    state.renderToken = token;

    if (typeof state.currentCleanup === "function") {
      state.currentCleanup();
      state.currentCleanup = null;
    }

    const titleByRoute = {
      home: "Trail Atlas",
      explore: "Explore",
      map: "Map",
      feed: "Feed",
      compose: "Compose",
      post: "Post Detail",
      notFound: "Not Found",
    };

    setDocumentTitle(titleByRoute[route.name] || "Trail Atlas");
    setLoadingState(
      route.name === "notFound" ? "Resolving route" : `Opening ${titleByRoute[route.name] || "view"}`,
      "Loading only the current surface to keep the shell responsive.",
    );

    const module = await viewLoaders[route.name]();
    if (token !== state.renderToken) {
      return;
    }

    const cleanup = await module.render(app, route, dom.viewRoot);
    if (token !== state.renderToken) {
      if (typeof cleanup === "function") {
        cleanup();
      }
      return;
    }

    state.currentCleanup = typeof cleanup === "function" ? cleanup : null;

    if (!options.preserveScroll) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }

  const app = {
    state,
    dom,
    helpers: journalPresentation,
    consumers: journalConsumers,
    loadBootstrap,
    ensureDestinationDetails,
    requestJson,
    requestJsonMaybe,
    setStatus,
    setDocumentTitle,
    navigate,
    parseRoute,
    buildMapHref,
    buildPostHref,
    getDestinationOptions: () => state.destinationOptions,
    getDestinationBindings: () => state.destinationBindings,
    getJournalBindings: () => state.journalBindings,
    getFeaturedDestinations: () => state.featuredDestinations,
    getCategories: () => state.categories,
    getCuisines: () => state.cuisines,
    getBootstrap: () => state.bootstrap,
    getUserById: (userId) => state.userById.get(userId) || null,
    getDestinationById: (destinationId) => state.destinationById.get(destinationId) || null,
    getUserName,
    getDestinationName,
    applySelectorBindings,
    createJournalCard,
    emptyStateMarkup,
    escapeHtml,
    noticeMarkup,
    resultMetaMarkup,
    tagsMarkup,
    fillSelect,
    debounce,
    fetchFeed,
    fetchRecommendedJournals,
    fetchJournalDetail,
    fetchJournalComments,
    createComment,
    sendJournalAction,
    start: async () => {
      renderShell();
      installGlobalEvents();
      await loadBootstrap();
      await renderRoute({ preserveScroll: true });
    },
  };

  return app;
}
