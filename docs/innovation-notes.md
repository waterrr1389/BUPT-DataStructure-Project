# Innovation Notes

## Implemented Innovation Points

### 1. One Graph Model Covers Scenic, Campus, And Indoor Routing

The repository uses a single destination graph model for scenic areas, campuses, and building interiors. That model supports:

- outdoor and indoor nodes in the same destination record,
- `distance`, `time`, and `mixed` route strategies,
- `walk`, `bike`, `shuttle`, and `mixed` travel modes, and
- nearby-facility ranking by network distance instead of Euclidean distance.

Evidence:

- `tests/runtime-services.test.ts` verifies indoor routing and nearby facility lookup on the real dataset.
- `tests/integration-smoke.test.ts` asserts the deterministic `River Polytechnic` indoor path.
- `dist/public/index.html` exposes route-strategy and route-mode controls in the browser demo at stable public URLs.

### 2. Journal Exchange Goes Beyond Basic Diary CRUD

The post-trip workflow is broader than simple journal storage. The exchange surface combines:

- exact-title lookup,
- full-text search with match excerpts,
- reversible compression and decompression, and
- storyboard generation from journal text.

Evidence:

- `tests/integration-smoke.test.ts` asserts exchange search hits, compression round-trip behavior, and storyboard frame generation.
- The verified demo report for `dest-002` records `inputLength 179`, `compressedLength 162`, `compressionRatio 0.9050279329608939`, `algorithmCompressionRatio 0.7430167597765364`, and `spaceSavings 0.0949720670391061`.

### 3. Food Discovery Uses Both Recommendation And Typo-Tolerant Search

Food coverage is treated as a first-class discovery surface rather than a small add-on list. The runtime supports:

- ranking by heat, rating, dietary preference bonus, and graph distance,
- cuisine filtering, and
- typo-tolerant search across food name, venue, cuisine, and keywords.

Evidence:

- `tests/runtime-services.test.ts` checks that a typo query such as `nodle` still returns `noodle lab kitchen 4`.
- `tests/integration-smoke.test.ts` covers deterministic food search and recommendation results for `dest-002`.
- `dist/public/index.html` and `dist/public/app.js` expose both food search and recommendation actions at stable public URLs.

### 4. Lightweight Dependency Delivery Keeps The System Inspectable

The project keeps external dependencies limited while preserving direct inspectability for ranking, search, routing, compression, demo, and server logic.

Evidence:

- `package.json` declares external/runtime and development dependencies (`leaflet`, `@types/leaflet`, `typescript`).
- The verified command surface uses npm scripts after dependency installation, including project-local TypeScript tooling.
- `npm run benchmark` reports representative timings for the custom top-k, search, graph, and compression modules.

## Boundaries

- Innovation claims are tied to implemented behavior and current verification evidence.
- Benchmark timings are representative measurements, not fixed promises.
- Storyboard output is demonstrable and mockable; it is not documented as a production media-generation system.
