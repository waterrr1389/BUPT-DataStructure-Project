# Requirements Analysis

## Functional Requirements And Repository Mapping

### FR-1 Data And Validation

Implemented in:

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `scripts/validate-data.ts`

Current evidence:

- The real seed validates at `220` destinations, `660` buildings, `10` facility categories, `1100` facilities, `4180` edges, `12` users, `12` journals, and `880` foods.
- Validation rejects broken coordinates, missing metadata, invalid travel-mode bindings, and broken graph references.

### FR-2 Recommendation And Search

Implemented in:

- `src/algorithms/top-k.ts`
- `src/algorithms/trie.ts`
- `src/algorithms/inverted-index.ts`
- `src/algorithms/fuzzy.ts`
- `src/services/destination-service.ts`

Current evidence:

- Destination search supports query, category, and `sortBy` handling.
- Destination recommendation uses bounded top-k ranking.
- Invalid destination `sortBy` values are rejected, and the runtime-service tests cover that behavior.

### FR-3 Routing And Facility Lookup

Implemented in:

- `src/algorithms/graph.ts`
- `src/algorithms/multi-route.ts`
- `src/services/route-service.ts`
- `src/services/facility-service.ts`

Current evidence:

- Routing supports shortest-path and multi-stop planning.
- The exposed strategy set is `distance`, `time`, and `mixed`.
- The exposed travel modes are `walk`, `bike`, `shuttle`, and `mixed`.
- Indoor route coverage is exercised by both runtime-service tests and the deterministic demo.
- Nearby facilities are filtered by category and ordered by network distance.

### FR-4 Journals, Search, Compression, And Storyboard Output

Implemented in:

- `src/services/journal-service.ts`
- `src/services/journal-store.ts`
- `src/services/exchange-service.ts`
- `src/algorithms/compression.ts`

Current evidence:

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

Current evidence:

- Food recommendation blends heat, rating, dietary preference matching, and graph distance.
- Food search supports cuisine filtering and typo-tolerant text matching.
- Runtime and integration smoke tests both cover real food-discovery behavior.

### FR-6 Demo And Delivery

Implemented in:

- `src/server/index.ts`
- `public/`
- `scripts/demo.ts`
- `scripts/run-benchmarks.ts`
- `tests/`
- `docs/`

Current evidence:

- The browser surface covers destinations, routes, facilities, journals, exchange, and food.
- `npm run demo` provides a deterministic report centered on `dest-002` / `River Polytechnic`.
- `README.md` and the delivery docs now align with the implemented module structure and verified outputs.

## Non-Functional Requirements

- Zero dependencies: satisfied. The package uses no external npm dependencies.
- Global toolchain only: satisfied. The documented flow uses global `node` and `tsc`.
- Deterministic command surface: satisfied for build, validation, tests, and demo. Benchmark timings remain representative because wall-clock results vary.
- Multi-worker readability: satisfied through clear module boundaries across `src/algorithms/`, `src/services/`, `src/server/`, `scripts/`, and `tests/`.
- Controlled startup errors: satisfied. Restricted environments still surface a clear `Server failed to start: listen EPERM...` message through the CLI wrapper, and the March 18 unrestricted-environment verification also confirmed a successful live bind on `127.0.0.1:3000`.

## Startup Verification Status

March 18 unrestricted-environment verification confirmed a successful bind on `127.0.0.1:3000` plus browser/API smoke coverage across the demo surface.

Earlier sandbox `EPERM` results remain useful only as historical evidence that restricted environments surface bind failures cleanly instead of crashing the server process.
