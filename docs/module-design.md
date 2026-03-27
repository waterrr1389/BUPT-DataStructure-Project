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
- `src/server/index.ts`
- `public/index.html`
- `public/app.ts`
- `public/journal-consumers.ts`
- `public/journal-presentation.ts`
- `public/route-visualization-markers.ts`
- `public/spa/**/*.ts`
- `public/vendor/**`
- `public/styles.css`
- `dist/public/index.html`
- `dist/public/app.js`
- `dist/public/journal-consumers.js`
- `dist/public/journal-presentation.js`
- `dist/public/route-visualization-markers.js`
- `dist/public/spa/**/*.js`
- `dist/public/vendor/**`
- `dist/public/styles.css`
- `scripts/validate-data.ts`
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
- `journal-service.ts` covers create, update, delete, browse, view, rate, and recommend flows.
- `journal-store.ts` persists journals in the runtime directory so the demo and tests can mutate state safely.
- `exchange-service.ts` handles exact-title lookup, full-text journal search, compression, decompression, storyboard generation, and destination-scoped exchange feeds.
- `food-service.ts` handles cuisine-filtered recommendation and typo-tolerant search.
- `runtime.ts` loads the external seed, validation, and algorithm bundles with fallback behavior when needed.

### Server And Browser Surface

- `src/server/index.ts` exposes a lightweight HTTP server, static asset serving, and JSON API routes for every feature area.
- `public/app.ts` and `public/spa/**/*.ts` are the browser-maintained TypeScript sources for the module-based SPA runtime.
- No first-party browser runtime `.js` files are kept under `public/`; only `public/vendor/**` may contain source-tree JavaScript, and every first-party script is emitted through the compilation pipeline into `dist/public/`.
- `public/journal-consumers.ts`, `public/journal-presentation.ts`, and `public/route-visualization-markers.ts` compile to stable script URLs while keeping browser-global and CommonJS-compatible behavior.
- `dist/public/*.js` and `dist/public/spa/**/*.js` are the served browser runtime output; build output moved from source `public/` to `dist/public/` while keeping public URLs unchanged.
- `public/vendor/**` remains third-party browser JavaScript and CSS source assets rather than project-authored TypeScript.
- `dist/public/vendor/**` is the third-party exception in served runtime output and stays non-authored.
- Source `public/` provides browser source inputs, while served UI assets are read from `dist/public/`.
- `npm run build` compiles the first-party TypeScript from `public/` into `dist/public/` and copies `public/index.html`, `public/styles.css`, `public/assets/**`, and `public/vendor/**` into that runtime tree together with the generated scripts.

### Scripts And Tests

- `scripts/validate-data.ts` validates the real seed dataset and prints the current counts.
- `scripts/run-benchmarks.ts` reports representative benchmark timings for ranking, search, graph, and compression work.
- `scripts/demo.ts` and `scripts/demo-support.ts` produce the deterministic end-to-end report centered on `dest-002`.
- `tests/` covers algorithm modules, runtime wiring, validation, and deterministic app/demo smoke behavior.

## Dependency Rules

- `src/algorithms/` depends only on shared data contracts and local helpers.
- `src/services/` depends on `src/domain/`, `src/data/`, and `src/algorithms/`.
- `src/server/` and `scripts/` depend on the service layer.
- `tests/` may depend on any public project module.

This split keeps the custom algorithms independently testable while still exposing them through a single demo runtime.
