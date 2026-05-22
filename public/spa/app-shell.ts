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
import { appCopy, documentTitle, frontendErrorMessage } from "./copy.js";
import type { SpaAppShell, SpaRoute } from "./types.js";

/**
 * Resolves required global helper APIs that are still shipped outside the SPA module tree.
 */
function requireHelperApi(name: string) {
  const api = globalThis[name];
  if (!api) {
    throw new Error(`${name} 加载失败。`);
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
  login: () => import("./views/login.js"),
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
  if (pathname === "/login") {
    return { name: "login" };
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
    currentUser: null,
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
    document.title = documentTitle(title);
  }

  /**
   * Updates the visible shell status message and tone.
   */
  function setStatus(message, tone = "neutral") {
    if (!dom.status) {
      return;
    }
    dom.status.textContent = text(message, appCopy.common.status.runtimeReady);
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
      throw new Error(
        frontendErrorMessage({
          code: payload?.code,
          context: path,
          status: response.status,
        }),
      );
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
      rawError: text(payload?.error),
      error: response.ok
        ? ""
        : frontendErrorMessage({
            code: payload?.code,
            context: path,
            status: response.status,
          }),
    };
  }

  function isMissingEndpointResponse(response) {
    return response.missing || /Unknown API endpoint/i.test(text(response.rawError));
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
        if (bootstrap?.currentUser) {
          state.currentUser = bootstrap.currentUser;
        }

        setStatus(
          appCopy.shell.runtimeDataStatus(bootstrap?.source?.data, bootstrap?.source?.algorithms),
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
   * Returns the currently authenticated user cached from bootstrap or auth checks.
   */
  function getCurrentUser() {
    return state.currentUser;
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
            <span class="site-brand-mark">${appCopy.brand}</span>
            <span class="site-brand-copy">${appCopy.tagline}</span>
          </a>
          <button class="nav-toggle" id="nav-toggle" type="button" aria-label="${appCopy.nav.toggleLabel}" aria-expanded="false">${appCopy.nav.toggleText}</button>
          <nav class="site-nav" id="site-nav" aria-label="${appCopy.nav.primaryLabel}">
            <a href="/explore" data-nav="true" data-route-name="explore">${appCopy.nav.items.explore}</a>
            <a href="/map" data-nav="true" data-route-name="map">${appCopy.nav.items.map}</a>
            <a href="/feed" data-nav="true" data-route-name="feed">${appCopy.nav.items.feed}</a>
            <a href="/compose" data-nav="true" data-route-name="compose">${appCopy.nav.items.compose}</a>
          </nav>
          <div class="user-bar" id="user-bar">
            <span class="user-label" id="user-label"></span>
            <button class="logout-btn" id="logout-btn" type="button">退出</button>
          </div>
          <div class="status-pill" id="status-pill" data-tone="neutral">${appCopy.common.status.loadingRuntime}</div>
        </header>
        <main class="site-main">
          <div class="view-root" id="view-root">${noticeMarkup("loading", appCopy.shell.loadingTitle, appCopy.shell.loadingBody)}</div>
        </main>
        <button class="back-to-top" id="back-to-top" type="button" aria-label="${appCopy.common.buttons.backToTop}">${appCopy.common.buttons.backToTop}</button>
      </div>
    `;

    dom.shell = root.querySelector(".site-shell");
    dom.nav = root.querySelector("#site-nav");
    dom.viewRoot = root.querySelector("#view-root");
    dom.status = root.querySelector("#status-pill");
    dom.navToggle = root.querySelector("#nav-toggle");
    dom.backToTop = root.querySelector("#back-to-top");
  }

  function renderUserBar() {
    const userBar = root.querySelector("#user-bar");
    const userLabel = root.querySelector("#user-label");
    const logoutBtn = root.querySelector("#logout-btn");
    if (!userBar || !userLabel || !logoutBtn) {
      return;
    }
    if (state.currentUser) {
      userLabel.textContent = state.currentUser.name || "";
      logoutBtn.hidden = false;
      logoutBtn.addEventListener("click", async () => {
        try {
          await requestJson("/api/auth/logout", { method: "POST" });
        } catch {
          // ignore logout errors
        }
        window.location.reload();
      });
    } else {
      userLabel.innerHTML = `<a href="/login" data-nav="true">登录</a>`;
      logoutBtn.hidden = true;
    }
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
      home: appCopy.nav.items.home,
      explore: appCopy.nav.items.explore,
      map: appCopy.nav.items.map,
      feed: appCopy.nav.items.feed,
      compose: appCopy.nav.items.compose,
      post: appCopy.nav.items.post,
      login: "登录",
      notFound: appCopy.nav.items.notFound,
    };
    const routeLabel = titleByRoute[route?.name] || appCopy.nav.items.view;
    const message = appCopy.errors.routeLoadFallback;

    dom.viewRoot.innerHTML = noticeMarkup("error", appCopy.shell.routeFailedTitle(routeLabel), message);
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
      throw new Error(text(social.error, appCopy.feed.loadingFailed));
    }

    const fallback = await requestJson(
      `/api/journals${fallbackParams.toString() ? `?${fallbackParams.toString()}` : ""}`,
    );
    return {
      items: safeArray(fallback.items),
      nextCursor: "",
      notice: fallbackAllowed
        ? appCopy.feed.fallbackNotice
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
        notice: appCopy.comments.unavailableNotice,
      };
    }

    throw new Error(text(response.error, appCopy.comments.loadingFailed));
  }

  /**
   * Creates a comment and reports whether the comment endpoint is available.
   */
  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/uploads/images", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        frontendErrorMessage({
          code: payload?.code,
          context: "/api/uploads/images",
          status: response.status,
        }),
      );
    }

    return payload?.item;
  }

  /**
   * Creates a comment and reports whether the comment endpoint is available.
   */
  async function createComment(journalId, userId, body, media = []) {
    const requestBody = {
      userId,
      body,
    };
    if (Array.isArray(media) && media.length) {
      requestBody.media = media;
    }

    const response = await requestJsonMaybe(`/api/journals/${encodeURIComponent(journalId)}/comments`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      state.socialAvailability.comments = true;
      return {
        available: true,
        item: response.payload?.item ?? null,
        notice: "",
      };
    }

    if (isMissingEndpointResponse(response)) {
      state.socialAvailability.comments = false;
      return {
        available: false,
        item: null,
        notice: appCopy.comments.creationUnavailableNotice,
      };
    }

    throw new Error(text(response.error, appCopy.comments.creationFailed));
  }

  /**
   * Sends a supported journal action and reports endpoint availability when relevant.
   */
  async function sendJournalAction(action, journalId, selectedUserId) {
    const request = journalConsumers.resolveJournalActionRequest(action, journalId, selectedUserId);
    if (!request) {
      throw new Error(appCopy.journal.unsupportedAction);
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

    if ((action === "like" || action === "unlike") && isMissingEndpointResponse(maybe)) {
      state.socialAvailability.likes = false;
      return {
        available: false,
        payload: null,
        notice: appCopy.journal.likesUnavailableNotice,
      };
    }

    throw new Error(text(maybe.error, appCopy.journal.actionFailed));
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
      home: appCopy.nav.items.home,
      explore: appCopy.nav.items.explore,
      map: appCopy.nav.items.map,
      feed: appCopy.nav.items.feed,
      compose: appCopy.nav.items.compose,
      post: appCopy.nav.items.post,
      login: "登录",
      notFound: appCopy.nav.items.notFound,
    };

    setDocumentTitle(titleByRoute[route.name] || appCopy.brand);
    setLoadingState(
      route.name === "notFound"
        ? appCopy.shell.resolvingRoute
        : appCopy.shell.openingRoute(titleByRoute[route.name] || appCopy.nav.items.view),
      appCopy.shell.routeLoadingBody,
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

    let currentUser = null;
    let authAvailable = false;
    try {
      const me = await requestJsonMaybe("/api/auth/me");
      if (me.ok) {
        currentUser = me.payload?.item ?? null;
        authAvailable = true;
      } else if (!isMissingEndpointResponse(me)) {
        authAvailable = true;
      }
    } catch {
      // Treat as no auth endpoint available
    }
    state.currentUser = currentUser;

    const route = parseRoute();
    if (authAvailable && !currentUser && route.name !== "login") {
      navigate("/login", { replace: true, render: false });
      await loadBootstrap();
      renderUserBar();
      await renderRoute({ preserveScroll: true });
      return;
    }
    if (authAvailable && currentUser && route.name === "login") {
      navigate("/", { replace: true, render: false });
    }

    await loadBootstrap();
    renderUserBar();
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
    getCurrentUser,
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
    uploadImage,
    createComment,
    sendJournalAction,
    start,
  };

  return app;
}
