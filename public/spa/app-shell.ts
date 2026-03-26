// @ts-nocheck

import {
  createRouteContextHref,
  debounce,
  fillSelect,
  isPrimaryNavigationEvent,
  noticeMarkup,
  safeArray,
  tagsMarkup,
  text,
} from "./lib.js";
import type { SpaAppShell, SpaRoute } from "./types.js";

/**
 * Resolves required global helper APIs that are still shipped outside the SPA module tree.
 */
function requireHelperApi(name: string) {
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

/**
 * Maps a browser pathname to the route name contract consumed by SPA views.
 */
function routeNameFromPath(pathname: string) {
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

/**
 * Parses the active URL into the stable pathname, query, and actor-aware route contract.
 */
function parseRoute(url: URL = new URL(window.location.href)): SpaRoute {
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
      view: url.searchParams.get("view") ?? "",
      actor: url.searchParams.get("actor") ?? "",
      author: url.searchParams.get("author") ?? "",
    },
  };
}

/**
 * Creates the browser SPA shell while preserving route, query, and dynamic import behavior.
 */
export function createAppShell(root: HTMLElement): SpaAppShell {
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

  /**
   * Applies the shell title convention to the current document.
   */
  function setDocumentTitle(title) {
    document.title = title ? `${title} • Trail Atlas` : "Trail Atlas";
  }

  /**
   * Updates the visible shell status message and tone.
   */
  function setStatus(message, tone = "neutral") {
    if (!dom.status) {
      return;
    }
    dom.status.textContent = text(message, "Runtime ready.");
    dom.status.dataset.tone = tone;
  }

  /**
   * Sends a JSON request and throws when the response is not successful.
   */
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

  function isMissingEndpointResponse(response) {
    return response.missing || /Unknown API endpoint/i.test(text(response.error));
  }

  /**
   * Builds a map href that preserves the active route context.
   */
  function buildMapHref(params = {}) {
    return createRouteContextHref("/map", params);
  }

  /**
   * Builds a post detail href that preserves the active route context.
   */
  function buildPostHref(journalId, params = {}) {
    return createRouteContextHref(`/posts/${encodeURIComponent(text(journalId))}`, params);
  }

  /**
   * Loads and caches the bootstrap payload consumed across SPA views.
   */
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

  /**
   * Returns the cached bootstrap payload after it has been loaded.
   */
  function getBootstrap() {
    return state.bootstrap;
  }

  /**
   * Returns destination selector bindings prepared from bootstrap data.
   */
  function getDestinationBindings() {
    return state.destinationBindings;
  }

  /**
   * Returns journal exchange selector bindings prepared from bootstrap data.
   */
  function getJournalBindings() {
    return state.journalBindings;
  }

  /**
   * Returns destination select options derived from bootstrap data.
   */
  function getDestinationOptions() {
    return state.destinationOptions;
  }

  /**
   * Returns featured destinations advertised by the bootstrap payload.
   */
  function getFeaturedDestinations() {
    return state.featuredDestinations;
  }

  /**
   * Returns categories exposed by the bootstrap payload.
   */
  function getCategories() {
    return state.categories;
  }

  /**
   * Returns cuisines exposed by the bootstrap payload.
   */
  function getCuisines() {
    return state.cuisines;
  }

  /**
   * Loads and caches destination detail data for a destination id.
   */
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

  /**
   * Returns the best available display name for a user id.
   */
  function getUserName(userId) {
    return state.userById.get(userId)?.name || userId;
  }

  /**
   * Returns the best available display name for a destination id.
   */
  function getDestinationName(destinationId) {
    return state.destinationById.get(destinationId)?.name || destinationId;
  }

  /**
   * Applies prepared selector bindings to matching controls inside a container.
   */
  function applySelectorBindings(container, bindings) {
    safeArray(bindings).forEach(({ selector, items, config }) => {
      const element = container.querySelector(selector);
      if (!element) {
        return;
      }
      fillSelect(element, items, config);
    });
  }

  /**
   * Renders a journal card string using the shell presentation helpers.
   */
  function createJournalCard(item, options = {}) {
    const metadata = journalPresentation.formatJournalMetadata(item, {
      destinationById: state.destinationById,
      userById: state.userById,
    });
    const postParams = {};
    if (options.actorId) {
      postParams.actor = options.actorId;
    }

    return journalConsumers.journalCard(item, metadata, tagsMarkup, {
      mapHref: buildMapHref(options.actorId ? { destinationId: item.destinationId, actor: options.actorId } : { destinationId: item.destinationId }),
      postHref: buildPostHref(item.id, postParams),
      summarizeBody: journalPresentation.summarizeText,
      summaryLength: options.summaryLength || 220,
      hideDelete: options.hideDelete === true,
      hideSocialAction: options.hideSocialAction === true,
      hideSocialMeta: options.hideSocialMeta === true,
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

  function syncShellLinks(route = parseRoute()) {
    const shellLinks = [
      [".site-brand", createRouteContextHref("/", {}, route)],
      ["a[data-route-name='explore']", createRouteContextHref("/explore", {}, route)],
      ["a[data-route-name='map']", createRouteContextHref("/map", {}, route)],
      ["a[data-route-name='feed']", createRouteContextHref("/feed", {}, route)],
      ["a[data-route-name='compose']", createRouteContextHref("/compose", {}, route)],
    ];

    shellLinks.forEach(([selector, href]) => {
      const link = root.querySelector(selector);
      if (link) {
        link.setAttribute("href", href);
      }
    });
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

  function setRouteErrorState(route, error) {
    if (!dom.viewRoot) {
      return;
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
    const routeLabel = titleByRoute[route?.name] || "View";
    const message = error instanceof Error ? error.message : "The requested route could not be loaded.";

    dom.viewRoot.innerHTML = noticeMarkup("error", `${routeLabel} failed to load`, message);
    setStatus(message, "error");
  }

  function closeNav() {
    if (!dom.shell || !dom.navToggle) {
      return;
    }
    dom.shell.classList.remove("is-nav-open");
    dom.navToggle.setAttribute("aria-expanded", "false");
  }

  /**
   * Changes the active SPA route and optionally triggers a render.
   */
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
    syncShellLinks(parseRoute(new URL(window.location.href)));
    if (options.render !== false) {
      void renderRoute({ preserveScroll: options.preserveScroll === true });
    }
  }

  /**
   * Loads feed items, falling back to the journal list when social endpoints are absent.
   */
  async function fetchFeed(filters = {}) {
    const params = new URLSearchParams();
    const fallbackParams = new URLSearchParams();
    if (filters.destinationId) {
      params.set("destinationId", filters.destinationId);
      fallbackParams.set("destinationId", filters.destinationId);
    }
    if (filters.userId) {
      params.set("userId", filters.userId);
      fallbackParams.set("userId", filters.userId);
    }
    if (filters.viewerUserId) {
      params.set("viewerUserId", filters.viewerUserId);
      fallbackParams.set("viewerUserId", filters.viewerUserId);
    }
    if (filters.limit) {
      params.set("limit", String(filters.limit));
      fallbackParams.set("limit", String(filters.limit));
    }
    if (filters.cursor) {
      params.set("cursor", filters.cursor);
      fallbackParams.set("cursor", filters.cursor);
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

    const fallbackAllowed = isMissingEndpointResponse(social);
    if (!fallbackAllowed) {
      throw new Error(text(social.error, "Feed loading failed."));
    }

    const fallback = await requestJson(
      `/api/journals${fallbackParams.toString() ? `?${fallbackParams.toString()}` : ""}`,
    );
    return {
      items: safeArray(fallback.items),
      nextCursor: "",
      notice: fallbackAllowed
        ? "Social feed endpoints are not available in this workspace yet. Showing the journal timeline instead."
        : text(social.error),
      source: "journal-list",
    };
  }

  /**
   * Loads recommended journals for the supplied filter context.
   */
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

  /**
   * Loads a journal detail record for a specific journal id.
   */
  async function fetchJournalDetail(journalId, options = {}) {
    const params = new URLSearchParams();
    if (options.viewerUserId) {
      params.set("viewerUserId", options.viewerUserId);
    }
    const payload = await requestJson(
      `/api/journals/${encodeURIComponent(journalId)}${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return payload.item;
  }

  /**
   * Loads journal comments and reports whether comment APIs are available.
   */
  async function fetchJournalComments(journalId, options = {}) {
    const params = new URLSearchParams();
    if (options.cursor) {
      params.set("cursor", options.cursor);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    const response = await requestJsonMaybe(
      `/api/journals/${encodeURIComponent(journalId)}/comments${params.toString() ? `?${params.toString()}` : ""}`,
    );
    if (response.ok) {
      state.socialAvailability.comments = true;
      return {
        available: true,
        items: safeArray(response.payload?.items),
        nextCursor:
          typeof response.payload?.nextCursor === "string" ? response.payload.nextCursor : "",
        totalCount: Number(response.payload?.totalCount) || 0,
        notice: "",
      };
    }

    if (isMissingEndpointResponse(response)) {
      state.socialAvailability.comments = false;
      return {
        available: false,
        items: [],
        nextCursor: "",
        totalCount: 0,
        notice: "Comments have not been wired in this workspace yet.",
      };
    }

    throw new Error(text(response.error, "Comments could not be loaded."));
  }

  /**
   * Creates a comment and reports whether the comment endpoint is available.
   */
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

  /**
   * Sends a supported journal action and reports endpoint availability when relevant.
   */
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
    syncShellLinks(route);
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

    try {
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
    } catch (error) {
      if (token !== state.renderToken) {
        return;
      }
      state.currentCleanup = null;
      setRouteErrorState(route, error);
    }
  }

  /**
   * Renders the shell, installs listeners, loads bootstrap data, and opens the current route.
   */
  async function start() {
    renderShell();
    installGlobalEvents();
    await loadBootstrap();
    await renderRoute({ preserveScroll: true });
  }

  /**
   * Assembles the public shell contract exposed to SPA views and callers.
   */
  const app: SpaAppShell = {
    state,
    loadBootstrap,
    getBootstrap,
    getDestinationBindings,
    getJournalBindings,
    getDestinationOptions,
    getFeaturedDestinations,
    getCategories,
    getCuisines,
    ensureDestinationDetails,
    requestJson,
    setStatus,
    setDocumentTitle,
    navigate,
    parseRoute,
    buildMapHref,
    buildPostHref,
    getUserName,
    getDestinationName,
    applySelectorBindings,
    createJournalCard,
    tagsMarkup,
    debounce,
    fetchFeed,
    fetchRecommendedJournals,
    fetchJournalDetail,
    fetchJournalComments,
    createComment,
    sendJournalAction,
    start,
  };

  return app;
}
