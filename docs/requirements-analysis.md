# Requirements Analysis

## Functional Requirements And Repository Mapping

Evidence below refers to the March 27, 2026 rerun of `npm test` (which includes `npm run build`) for the automated tests, while the March 19, 2026 recorded runs provide the reference evidence for `npm run validate:data`, `npm run benchmark`, and `npm run demo`; the March 18 unrestricted startup and smoke record is historical.

### FR-1 Data And Validation

Implemented in:

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `scripts/validate-data.ts`

- Recorded evidence (March 19, 2026 run, not rerun this round):

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
- Route, facility, food, journal, and exchange selectors all consume one authoritative destination-option preparation path backed by the full destination catalog.
- Duplicate destination names are disambiguated consistently across those selectors while preserving stable destination ids.
- Invalid destination `sortBy` values are rejected, and the runtime-service tests cover that behavior.

### FR-3 Routing And Facility Lookup

Implemented in:

- `src/algorithms/graph.ts`
- `src/algorithms/multi-route.ts`
- `src/services/route-service.ts`
- `src/services/facility-service.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Routing supports shortest-path and multi-stop planning.
- The exposed strategy set is `distance`, `time`, and `mixed`.
- The exposed travel modes are `walk`, `bike`, `shuttle`, and `mixed`.
- Fallback runtime generation uses deterministic scenic and campus graph variants rather than one effectively reused graph template.
- Indoor route coverage is exercised by both runtime-service tests and the deterministic demo.
- Nearby facilities are filtered by category and ordered by network distance.

### FR-4 Journals, Search, Compression, And Storyboard Output

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

### FR-5 Food Discovery

Implemented in:

- `src/services/food-service.ts`
- `src/algorithms/fuzzy.ts`
- `src/algorithms/top-k.ts`
- `src/algorithms/graph.ts`

Recorded evidence (March 19, 2026 run, not rerun this round):

- Food recommendation blends heat, rating, dietary preference matching, and graph distance.
- Food search supports cuisine filtering and typo-tolerant text matching.
- Runtime and integration smoke tests both cover real food-discovery behavior.

### FR-6 Demo And Delivery

Implemented in:

- `src/server/index.ts`
- `public/` (first-party browser source assets)
- `dist/public/` (served browser runtime output with stable public URLs)
- `scripts/demo.ts`
- `scripts/run-benchmarks.ts`
- `tests/`
- `docs/`

Recorded evidence (March 19, 2026 run, not rerun this round):

- The browser surface covers destinations, routes, facilities, journals, exchange, and food.
- The March 19 recorded `npm run demo` provides a deterministic report centered on `dest-002` / `River Polytechnic`.
- The March 27 rerun of `npm test` now includes explicit selector-parity coverage and graph-variant structure/regression coverage.
- `README.md` and the delivery docs now align with the implemented module structure and recorded outputs while explicitly distinguishing the March 27 rerun, the March 19 recorded command runs, and the March 18 historical startup evidence.

## Non-Functional Requirements

- Managed dependencies: satisfied. The package declares external/runtime and development dependencies, and the documented flow requires `npm install`.
- Project-local toolchain usage: satisfied. The documented command flow references the recorded npm scripts that consume project dependencies (including local TypeScript tooling).
- Recorded deterministic command surface: satisfied for build, validation, tests, and demo. Benchmark timings remain representative because wall-clock results vary.
- Multi-worker readability: satisfied through clear module boundaries across `src/algorithms/`, `src/services/`, `src/server/`, `scripts/`, and `tests/`.
- Controlled startup errors: satisfied. Restricted environments still surface a clear `Server failed to start: listen EPERM...` message through the CLI wrapper, and the March 18 unrestricted-environment verification remains the recorded proof that a live bind succeeded on `127.0.0.1:3000`.

## Startup Verification Status

March 18 unrestricted-environment verification confirmed a successful bind on `127.0.0.1:3000` plus browser/API smoke coverage across the demo surface; that record remains the historical reference for unrestricted live-start behavior.

Earlier sandbox `EPERM` results remain useful only as historical evidence that restricted environments surface bind failures cleanly instead of crashing the server process.
