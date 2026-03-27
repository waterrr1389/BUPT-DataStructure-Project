# Overall Design

## Architecture Summary

The project is designed as a TypeScript-led codebase with custom algorithm modules, service orchestration, a lightweight server, a routed browser UI, and scriptable validation, benchmark, demo, and test commands. The authored browser sources live in `public/*.ts` and `public/spa/**/*.ts`, generated browser runtime assets are emitted to `dist/public/**`, and `public/vendor/**` remains the vendored third-party browser asset exception.

## Layered Design

### Domain Layer

- `src/domain/models.ts` defines the shared entities and value objects.
- `src/data/seed.ts` provides loadable seed data.
- `src/data/validation.ts` enforces scale and integrity constraints.

### Algorithm Layer

- `src/algorithms/top-k.ts` handles efficient ranking for recommendation and food discovery.
- `src/algorithms/trie.ts` supports prefix-oriented lookup.
- `src/algorithms/inverted-index.ts` supports keyword and full-text retrieval.
- `src/algorithms/fuzzy.ts` handles tolerant food and content matching.
- `src/algorithms/graph.ts` handles shortest-path graph operations.
- `src/algorithms/multi-route.ts` handles multi-stop route planning.
- `src/algorithms/compression.ts` handles lossless content compression.

### Service Layer

`src/services/**` coordinates domain data with algorithm modules through the implemented service modules:

- `src/services/index.ts` composes the application service container and `/api/bootstrap` response, keeping the `12`-item featured destination deck for homepage cards while separately exposing the full destination catalog for route, facility, food, journal, exchange, and feed selector surfaces.
- `src/services/runtime.ts` resolves seed data, validation, algorithm helpers, and fallback runtime behavior.
- `src/services/destination-service.ts` serves destination catalog, search, and recommendation workflows.
- `src/services/route-service.ts` plans shortest-path and multi-stop routes within destinations.
- `src/services/facility-service.ts` finds nearby facilities by category, radius, and travel mode.
- `src/services/food-service.ts` handles food recommendation, cuisine filtering, and text search.
- `src/services/journal-service.ts` and `src/services/journal-store.ts` manage journal persistence, feed, comments, likes, and CRUD-style operations.
- `src/services/exchange-service.ts` supports journal discovery, text compression, and storyboard generation features.
- `src/services/world-service.ts` exposes world availability, summary, and full world-detail payloads.
- `src/services/world-route-service.ts` plans world-only and cross-map routes and returns structured route error contracts.
- `src/services/contracts.ts`, `src/services/service-helpers.ts`, `src/services/fallback-data.ts`, and `src/services/fallback-algorithms.ts` provide shared service types and support utilities.

### Delivery Layer

- `src/server/index.ts` serves the generated static runtime plus JSON routes for bootstrap, destinations, local routes, facilities, journals, feed, world, world routes, journal exchange, and food features.
- `public/app.ts` plus `public/spa/**/*.ts` define the browser-maintained SPA source of truth that compiles to `dist/public/app.js` and `dist/public/spa/**/*.js`.
- `public/journal-consumers.ts`, `public/journal-presentation.ts`, and `public/route-visualization-markers.ts` compile as script-style helpers so browser-global and CommonJS-compatible behavior stays intact.
- `public/spa/views/feed.ts` and `public/spa/views/post-detail.ts` implement the social/feed browser surface, while `public/spa/views/map.ts` and `public/spa/world-rendering.ts` handle local map planning and world-view routing flows.
- `public/**` contains browser source assets and scenario data, including one shared destination-option preparation path that consumes the full destination catalog, applies consistent duplicate-name disambiguation, and still leaves the featured deck available for homepage cards.
- `dist/public/**` is generated runtime output and the directory served by the built server, preserving existing URL paths after the build.
- `public/vendor/**` contains third-party browser assets as source inputs, and `dist/public/vendor/**` is the corresponding served third-party output.
- `scripts/validate-data.ts`, `scripts/run-benchmarks.ts`, and `scripts/demo.ts` provide repeatable CLI entrypoints.
- `tests/**` contains unit, integration, and smoke tests.

## Data Flow

1. Seed data loads through `src/data/seed.ts`.
2. Validation confirms data shape, counts, and graph integrity.
3. Services build or consume indexes and graph structures from the validated dataset.
4. The server and demo scripts expose the same service outputs for browser and CLI use, including the bootstrap split between the `12`-item featured deck and the full destination catalog plus the optional world payloads.
5. Tests and benchmarks exercise the same service and algorithm contracts.

The fallback runtime keeps deterministic scenic and campus graph variants so routing and nearby-facility behavior are exercised against multiple graph shapes rather than one effectively reused template.

## Design Decisions

- Use JSON-compatible data and plain TypeScript modules for first-party code, while treating `public/vendor/**` as the third-party browser dependency exception.
- Keep algorithm modules independent so benchmarks and tests can target them directly.
- Run the browser build as part of `npm run build`, emit generated browser runtime assets to `dist/public/`, and keep stable public URLs unchanged.
- Keep demo and server entrypoints thin so the core logic remains testable in isolation.
