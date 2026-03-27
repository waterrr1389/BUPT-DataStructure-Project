# Module Design

## Actual Module Layout

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `src/algorithms/top-k.ts`
- `src/algorithms/trie.ts`
- `src/algorithms/inverted-index.ts`
- `src/algorithms/fuzzy.ts`
- `src/algorithms/graph.ts`
- `src/algorithms/multi-route.ts`
- `src/algorithms/compression.ts`
- `src/services/contracts.ts`
- `src/services/runtime.ts`
- `src/services/destination-service.ts`
- `src/services/route-service.ts`
- `src/services/facility-service.ts`
- `src/services/journal-service.ts`
- `src/services/journal-store.ts`
- `src/services/exchange-service.ts`
- `src/services/food-service.ts`
- `src/services/world-service.ts`
- `src/services/world-route-service.ts`
- `src/services/index.ts`
- `src/server/index.ts`
- `public/index.html`
- `public/app.ts`
- `public/journal-consumers.ts`
- `public/journal-presentation.ts`
- `public/route-visualization-markers.ts`
- `public/spa/**/*.ts`
- `public/spa/world-rendering.ts`
- `public/assets/**`
- `public/vendor/**`
- `public/styles.css`
- `dist/public/index.html`
- `dist/public/app.js`
- `dist/public/journal-consumers.js`
- `dist/public/journal-presentation.js`
- `dist/public/route-visualization-markers.js`
- `dist/public/spa/**/*.js`
- `dist/public/assets/**`
- `dist/public/vendor/**`
- `dist/public/styles.css`
- `scripts/validate-data.ts`
- `scripts/benchmark-support.ts`
- `scripts/sample-data.ts`
- `scripts/browser-build.js`
- `scripts/run-benchmarks.ts`
- `scripts/demo.ts`
- `scripts/demo-support.ts`
- `tests/**`

## Responsibilities

### Domain And Data

- `src/domain/models.ts` defines the shared travel entities, route strategies, travel modes, facilities, foods, users, and journals.
- `src/data/seed.ts` provides the real seed dataset used by runtime, demo, validation, and tests.
- `src/data/validation.ts` enforces scale, referential integrity, coordinate, road-mode, and metadata constraints.

### Algorithm Layer

- `top-k.ts` provides bounded ranking for destination, food, and journal recommendation flows.
- `trie.ts` supports prefix-oriented lookup.
- `inverted-index.ts` supports keyword search and exact-title/full-text indexing workflows.
- `fuzzy.ts` provides tolerant text matching used by food discovery.
- `graph.ts` provides shortest-path and graph traversal primitives.
- `multi-route.ts` handles multi-stop closed-walk planning.
- `compression.ts` performs reversible journal text compression.

### Service Layer

- `destination-service.ts` handles destination catalog, search, recommendation, and category listing.
- `route-service.ts` plans single-target and multi-stop routes and exposes `distance`, `time`, and `mixed` strategies.
- `facility-service.ts` returns nearby facilities ranked by network distance.
- `journal-service.ts` covers create, update, delete, browse, feed, comment, like, view, rate, and recommend flows.
- `journal-store.ts` persists journals in the runtime directory so the demo and tests can mutate state safely.
- `exchange-service.ts` handles exact-title lookup, full-text journal search, compression, decompression, storyboard generation, and destination-scoped exchange feeds.
- `food-service.ts` handles cuisine-filtered recommendation and typo-tolerant search.
- `world-service.ts` reports world availability and serves summary or detail payloads for the world view.
- `world-route-service.ts` plans `world-only` and `cross-map` itineraries and returns structured invalid-request, portal-binding, and reachability errors.
- `runtime.ts` loads the external seed, validation, and algorithm bundles with fallback behavior when needed.
- `index.ts` composes the bootstrap payload so the `12` featured destinations stay distinct from the full destination catalog used by selectors.

### Server And Browser Surface

- `src/server/index.ts` exposes a lightweight HTTP server, serves generated assets from `dist/public/**`, and provides JSON routes for `/api/bootstrap`, `/api/world`, `/api/world/details`, `/api/world/routes/plan`, `/api/feed`, destination, route, facility, journal, exchange, and food surfaces.
- `public/app.ts` and `public/spa/**/*.ts` are the browser-maintained TypeScript sources for the module-based SPA runtime.
- No first-party browser runtime `.js` files are kept under `public/`; only `public/vendor/**` may contain source-tree JavaScript, and every first-party script is emitted through the compilation pipeline into `dist/public/`.
- `public/journal-consumers.ts`, `public/journal-presentation.ts`, and `public/route-visualization-markers.ts` compile to stable script URLs while keeping browser-global and CommonJS-compatible behavior.
- `public/spa/views/feed.ts` and `public/spa/views/post-detail.ts` cover the social/feed browser surface, while `public/spa/views/map.ts` and `public/spa/world-rendering.ts` cover local map planning and the world-view runtime.
- `dist/public/*.js` and `dist/public/spa/**/*.js` are generated and served browser runtime output; build output moved from source `public/` to `dist/public/` while keeping public URLs unchanged.
- `public/vendor/**` remains third-party browser JavaScript and CSS source assets rather than project-authored TypeScript.
- `dist/public/vendor/**` is the third-party exception in served runtime output and stays non-authored.
- Source `public/` provides browser source inputs, while served UI assets are read from `dist/public/`.
- `npm run build` compiles the first-party TypeScript from `public/` into `dist/public/` and copies `public/index.html`, `public/styles.css`, `public/assets/**`, and `public/vendor/**` into that runtime tree together with the generated scripts.

### Scripts And Tests

- `scripts/browser-build.js` compiles the first-party browser TypeScript into `dist/public/`, copies first-party static assets, and keeps the served runtime tree aligned with `public/`.
- `scripts/benchmark-support.ts` provides reusable benchmark fixtures and measurement helpers for the benchmark entrypoint.
- `scripts/sample-data.ts` generates deterministic sample seed data for script and smoke-test scenarios.
- `scripts/validate-data.ts` validates the real seed dataset and prints the current counts.
- `scripts/run-benchmarks.ts` reports representative benchmark timings for ranking, search, graph, and compression work.
- `scripts/demo.ts` and `scripts/demo-support.ts` produce the deterministic end-to-end report centered on `dest-002`.
- `tests/` covers algorithm modules, runtime wiring, validation, deterministic app/demo smoke behavior, and explicit world-route contract checks.

## Dependency Rules

- `src/algorithms/` depends only on shared data contracts and local helpers.
- `src/services/` depends on `src/domain/`, `src/data/`, and `src/algorithms/`.
- `src/server/` depends on the service layer.
- Runtime-oriented scripts in `scripts/` may depend on the service layer, while browser-build helpers depend on Node tooling plus `public/` and `dist/public/`.
- `tests/` may depend on any public project module.

This split keeps the custom algorithms independently testable while still exposing them through a single demo runtime.
