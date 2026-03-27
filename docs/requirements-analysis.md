# Requirements Analysis

## Functional Requirements And Repository Mapping

Evidence below keeps three boundaries explicit:

- March 27, 2026 rerun: `npm test` only, and that command already includes `npm run build`.
- March 19, 2026 recorded runs: `npm run validate:data`, `npm run benchmark`, and `npm run demo`.
- March 18, 2026 historical record: unrestricted `npm run start` startup and browser/API smoke.

### FR-1 Data And Validation

Implemented in:

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `scripts/validate-data.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- The real seed validated at `220` destinations, `660` buildings, `10` facility categories, `1100` facilities, `4070` edges, `12` users, `12` journals, and `880` foods.
- Validation rejects broken coordinates, missing metadata, invalid travel-mode bindings, and broken graph references.

### FR-2 Recommendation And Search

Implemented in:

- `src/algorithms/top-k.ts`
- `src/algorithms/trie.ts`
- `src/algorithms/inverted-index.ts`
- `src/algorithms/fuzzy.ts`
- `src/services/destination-service.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Destination search supports query, category, and `sortBy` handling.
- Destination recommendation uses bounded top-k ranking.
- Invalid destination `sortBy` values are rejected, and the runtime-service tests cover that behavior.

Recorded evidence (March 27, 2026 rerun):

- The rerun's runtime-service suite now exercises the route, facility, food, journal, and exchange selectors against the authoritative destination-option pipeline so every selector surface stays aligned.
- Those selector runs confirm duplicate destination names stay disambiguated consistently across the surfaces while preserving stable destination ids, providing explicit regression coverage for the selector-parity behavior.

### FR-3 Routing, World Routing, And Facility Lookup

Implemented in:

- `src/algorithms/graph.ts`
- `src/algorithms/multi-route.ts`
- `src/services/route-service.ts`
- `src/services/world-route-service.ts`
- `src/services/facility-service.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Routing supports shortest-path and multi-stop planning.
- The exposed strategy set is `distance`, `time`, and `mixed`.
- The exposed travel modes are `walk`, `bike`, `shuttle`, and `mixed`.
- Indoor route coverage appears in the deterministic demo.
- Nearby facilities are filtered by category and ordered by network distance.

Recorded evidence (March 27, 2026 rerun):

- The rerun's graph and runtime-service tests now verify fallback runtime generation uses deterministic scenic and campus graph variants instead of reusing a single template, locking in the rerun's graph-variant regression coverage.
- The rerun's runtime-service and world-route suites cover indoor route behavior plus explicit world-route invalid-request and error-contract behavior through the automated test suite.
- The rerun's SPA/browser-facing regression suite covers the implemented world-view and world-route browser surfaces under `/map?view=world`.

### FR-4 Journals, Feed, Search, Compression, And Storyboard Output

Implemented in:

- `src/services/journal-service.ts`
- `src/services/journal-store.ts`
- `src/services/exchange-service.ts`
- `src/algorithms/compression.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Journals can be created, listed, viewed, rated, updated, deleted, and recommended.
- Exchange supports exact-title lookup and full-text search without relying on database-native search.
- Compression is reversible on the exposed exchange surface, and the deterministic demo records actual payload metrics.
- Storyboard generation is available from the same exchange surface.

Recorded evidence (March 27, 2026 rerun):

- The rerun's runtime-service and SPA/browser-facing regression suites cover feed browsing, post-detail behavior, and exchange-facing social navigation on the implemented surface.

### FR-5 Food Discovery

Implemented in:

- `src/services/food-service.ts`
- `src/algorithms/fuzzy.ts`
- `src/algorithms/top-k.ts`
- `src/algorithms/graph.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Food recommendation blends heat, rating, dietary preference matching, and graph distance.
- Food search supports cuisine filtering and typo-tolerant text matching.

Recorded evidence (March 27, 2026 rerun):

- The rerun's runtime-service and integration-smoke suites exercise the implemented food recommendation and food search surfaces against the current runtime.

### FR-6 Demo And Delivery

Implemented in:

- `src/server/index.ts`
- `src/services/world-service.ts`
- `public/` (first-party browser source assets, including feed and world UI sources)
- `dist/public/` (generated and served browser runtime output with stable public URLs)
- `scripts/demo.ts`
- `scripts/run-benchmarks.ts`
- `tests/`
- `docs/`

Recorded evidence (March 19, 2026 run, not rerun this round):

- The March 19 recorded `npm run demo` provides a deterministic report centered on `dest-002` / `River Polytechnic`.

Recorded evidence (March 27, 2026 rerun):

- The March 27 rerun of `npm test` now includes explicit selector-parity coverage, graph-variant structure/regression coverage, and browser-facing SPA regressions for feed and map-shell behavior.

## Non-Functional Requirements

- Managed dependencies: satisfied. The package declares external/runtime and development dependencies, and the documented flow requires `npm install`.
- Project-local toolchain usage: satisfied. The documented command flow references the recorded npm scripts that consume project dependencies (including local TypeScript tooling).
- Recorded deterministic command surface: satisfied for build, validation, tests, and demo. Benchmark timings remain representative because wall-clock results vary.
- Generated browser runtime boundary: satisfied. `dist/public/**` is documented as generated runtime output rather than authored source.
- Multi-worker readability: satisfied through clear module boundaries across `src/algorithms/`, `src/services/`, `src/server/`, `scripts/`, and `tests/`.
- Controlled startup errors: satisfied. Restricted environments still surface a clear `Server failed to start: listen EPERM...` message through the CLI wrapper, and the March 18 unrestricted-environment verification remains the recorded proof that a live bind succeeded on `127.0.0.1:3000`.

## Startup Verification Status

March 18 unrestricted-environment verification confirmed a successful bind on `127.0.0.1:3000` plus browser/API smoke coverage across the demo surface; that record remains the historical reference for unrestricted live-start behavior.

Earlier sandbox `EPERM` results remain useful only as historical evidence that restricted environments surface bind failures cleanly instead of crashing the server process.
