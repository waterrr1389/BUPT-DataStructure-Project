import {
  createRouteContextHref,
  emptyStateMarkup,
  escapeHtml,
  resolveRouteActor,
  safeArray,
  text,
} from "./lib.js";

const LEAFLET_CSS_PATH = "/vendor/leaflet/leaflet.css";
const LEAFLET_SCRIPT_PATH = "/vendor/leaflet/leaflet.js";
const REGION_STYLES = [
  { fill: "rgba(217, 93, 30, 0.22)", stroke: "rgba(217, 93, 30, 0.68)" },
  { fill: "rgba(15, 118, 110, 0.22)", stroke: "rgba(15, 118, 110, 0.68)" },
  { fill: "rgba(84, 107, 66, 0.22)", stroke: "rgba(84, 107, 66, 0.68)" },
  { fill: "rgba(17, 32, 49, 0.18)", stroke: "rgba(17, 32, 49, 0.52)" },
];
const DESTINATION_MARKER_COLORS = {
  "campus-commons": "#d95d1e",
  "campus-research": "#0f766e",
  "campus-waterfront": "#2c6e91",
  "scenic-harbor": "#8b3a2b",
  "scenic-historic": "#7f5539",
  "scenic-lookout": "#546b42",
  "scenic-market": "#9a3412",
};

let leafletPromise = null;

function hasLeafletApi(candidate) {
  return Boolean(candidate && candidate.CRS?.Simple && typeof candidate.map === "function");
}

function ensureLeafletStylesheet() {
  if (document.querySelector("link[data-world-leaflet='true']")) {
    return;
  }

  const target = document.head || document.body;
  if (!target) {
    return;
  }

  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", LEAFLET_CSS_PATH);
  link.setAttribute("data-world-leaflet", "true");
  target.appendChild(link);
}

function ensureLeaflet() {
  if (hasLeafletApi(globalThis.L)) {
    return Promise.resolve(globalThis.L);
  }

  if (leafletPromise) {
    return leafletPromise;
  }

  const target = document.head || document.body;
  if (!target || typeof document.createElement !== "function") {
    return Promise.reject(new Error("Leaflet failed to load."));
  }

  ensureLeafletStylesheet();
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("src", LEAFLET_SCRIPT_PATH);
    script.setAttribute("data-world-leaflet", "true");
    script.addEventListener("load", () => {
      if (hasLeafletApi(globalThis.L)) {
        resolve(globalThis.L);
        return;
      }
      leafletPromise = null;
      reject(new Error("Leaflet failed to load."));
    });
    script.addEventListener("error", () => {
      leafletPromise = null;
      reject(new Error("Leaflet failed to load."));
    });
    target.appendChild(script);
  });

  return leafletPromise;
}

function extractWorld(payload) {
  if (payload && typeof payload === "object" && payload.world && typeof payload.world === "object") {
    return payload.world;
  }
  return payload;
}

function toLatLngPair(point) {
  if (!Array.isArray(point) || point.length < 2) {
    return null;
  }

  const x = Number(point[0]);
  const y = Number(point[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return [y, x];
}

function createWorldBounds(world) {
  const width = Number(world?.width);
  const height = Number(world?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return [
    [0, 0],
    [height, width],
  ];
}

function regionStyleAt(index) {
  return REGION_STYLES[index % REGION_STYLES.length];
}

function markerColorFor(destination) {
  return DESTINATION_MARKER_COLORS[text(destination?.iconType)] || "#d95d1e";
}

function markerRadiusFor(destination) {
  const radius = Number(destination?.radius);
  if (!Number.isFinite(radius)) {
    return 10;
  }
  return Math.max(8, Math.min(radius, 18));
}

async function mountWorldMap(container, world, options = {}) {
  const L = await ensureLeaflet();
  const bounds = createWorldBounds(world);
  if (!bounds) {
    throw new Error("World geometry is invalid.");
  }

  const map = L.map(container, {
    attributionControl: false,
    crs: L.CRS.Simple,
    maxZoom: 2,
    minZoom: -2,
    zoomControl: true,
    zoomSnap: 0.25,
  });

  if (typeof L.imageOverlay === "function" && text(world?.backgroundImage)) {
    L.imageOverlay(text(world.backgroundImage), bounds, { interactive: false }).addTo(map);
  }

  safeArray(world?.regions).forEach((region, index) => {
    const polygon = safeArray(region?.polygon).map(toLatLngPair).filter(Boolean);
    if (polygon.length < 3 || typeof L.polygon !== "function") {
      return;
    }

    const styles = regionStyleAt(index);
    const layer = L.polygon(polygon, {
      color: styles.stroke,
      fillColor: styles.fill,
      fillOpacity: 0.92,
      interactive: false,
      weight: 2,
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(region?.name, "Region"), { sticky: true });
    }
  });

  safeArray(world?.destinations).forEach((destination) => {
    if (typeof L.circleMarker !== "function") {
      return;
    }

    const x = Number(destination?.x);
    const y = Number(destination?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const destinationId = text(destination?.destinationId);
    const layer = L.circleMarker([y, x], {
      color: "#112031",
      fillColor: markerColorFor(destination),
      fillOpacity: 0.96,
      radius: markerRadiusFor(destination),
      weight: 2,
    }).addTo(map);

    if (typeof layer.bindTooltip === "function") {
      layer.bindTooltip(text(destination?.label, destinationId), { direction: "top" });
    }

    if (destinationId && typeof layer.on === "function") {
      layer.on("click", () => {
        options.onDestinationSelect?.(destinationId);
      });
    }
  });

  if (typeof map.setMaxBounds === "function") {
    map.setMaxBounds(bounds);
  }
  if (typeof map.fitBounds === "function") {
    map.fitBounds(bounds, { padding: [24, 24] });
  }

  return () => {
    if (typeof map.remove === "function") {
      map.remove();
    }
  };
}

function worldMetaMarkup(summary, world) {
  const worldName = escapeHtml(text(world?.name || summary?.world?.name, "World Surface"));
  const regionCount = safeArray(world?.regions).length || safeArray(summary?.regions).length;
  const destinationCount =
    safeArray(world?.destinations).length || safeArray(summary?.destinations).length;

  return `
    <div class="world-map-meta">
      <div>
        <span class="section-tag">World</span>
        <strong>${worldName}</strong>
      </div>
      <div>
        <span class="section-tag">Regions</span>
        <strong>${regionCount}</strong>
      </div>
      <div>
        <span class="section-tag">Destinations</span>
        <strong>${destinationCount}</strong>
      </div>
    </div>
  `;
}

function worldUnavailableMarkup(title, body, route) {
  return `
    <article class="surface-card world-map-shell world-map-shell-unavailable">
      ${emptyStateMarkup({
        actionHref: createRouteContextHref("/explore", {}, route),
        actionLabel: "Return to Explore",
        body,
        title,
      })}
    </article>
  `;
}

export async function renderWorldMapView(app, route, root) {
  app.setDocumentTitle("World Map");

  const routeActor = resolveRouteActor(route);
  const returnToExploreHref = createRouteContextHref("/explore", {}, route);

  root.innerHTML = `
    <section class="route-hero route-hero-map world-route-hero">
      <div class="route-hero-copy">
        <p class="eyebrow">World Map</p>
        <h1>Browse the overworld without leaving the journal SPA.</h1>
        <p class="route-lede">
          This surface is read-only. Inspect regions and jump into a destination map when you need local routing.
        </p>
        <div class="hero-actions">
          <a class="inline-link" href="${returnToExploreHref}" data-nav="true">Return to Explore</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">World view</p>
        <ul class="hero-list">
          <li>Background art, regions, and destination markers render in Leaflet with CRS.Simple.</li>
          <li>Selecting a destination opens the local destination map.</li>
          <li>No route planning actions appear in world mode.</li>
        </ul>
      </div>
    </section>

    <section class="world-map-layout">
      <article class="surface-card world-map-sidebar">
        <div class="section-head">
          <div>
            <p class="section-tag">Surface mode</p>
            <h2>Read-only world surface</h2>
          </div>
        </div>
        <p class="world-map-copy">
          Move between the world and local maps deliberately. Destination clicks keep the selected actor context and drop the world view flag.
        </p>
        <div id="world-map-meta">
          ${worldMetaMarkup(null, null)}
        </div>
      </article>
      <div id="world-map-stage">
        <article class="surface-card world-map-shell">
          <div class="world-map-frame">
            <div id="world-map-canvas" class="world-map-canvas" aria-label="World map"></div>
          </div>
        </article>
      </div>
    </section>
  `;

  const stage = root.querySelector("#world-map-stage");
  const meta = root.querySelector("#world-map-meta");
  const canvas = root.querySelector("#world-map-canvas");
  let disposed = false;
  let cleanupMap = null;

  function renderUnavailable(title, body) {
    if (stage) {
      stage.innerHTML = worldUnavailableMarkup(title, body, route);
    }
  }

  try {
    const summary = await app.requestJson("/api/world");
    if (disposed) {
      return () => {};
    }

    if (summary?.enabled !== true) {
      if (meta) {
        meta.innerHTML = worldMetaMarkup(summary, null);
      }
      renderUnavailable(
        "World map unavailable",
        "World mode is not enabled by the backend worker in this workspace.",
      );
      app.setStatus("World mode is unavailable.", "neutral");
      return () => {};
    }

    const detailsPayload = await app.requestJson("/api/world/details");
    if (disposed) {
      return () => {};
    }

    const world = extractWorld(detailsPayload);
    if (!world) {
      renderUnavailable(
        "World details unavailable",
        "The world surface is enabled, but detailed map data is missing.",
      );
      app.setStatus("World details are unavailable.", "error");
      return () => {};
    }

    if (meta) {
      meta.innerHTML = worldMetaMarkup(summary, world);
    }
    cleanupMap = await mountWorldMap(canvas, world, {
      onDestinationSelect(destinationId) {
        const params = routeActor ? { actor: routeActor, destinationId } : { destinationId };
        app.navigate(app.buildMapHref(params));
      },
    });
    app.setStatus("World surface ready.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "World map failed to load.";
    renderUnavailable(
      "World details unavailable",
      "The world surface could not be prepared. Check the worker endpoints and try again.",
    );
    app.setStatus(message, "error");
  }

  return () => {
    disposed = true;
    if (typeof cleanupMap === "function") {
      cleanupMap();
    }
  };
}
