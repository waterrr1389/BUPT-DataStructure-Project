# Personalized Travel System

This repository is a zero-dependency TypeScript course project that now delivers the implemented travel system rather than a scaffold. The codebase covers destination recommendation and search, route planning, nearby facility lookup, journal management and exchange, food discovery, a browser-facing demo, and reproducible validation and benchmark scripts.

## Implemented Scope

- Destination search and recommendation backed by custom ranking and text-search helpers.
- Indoor and outdoor routing with `distance`, `time`, and `mixed` strategies plus `walk`, `bike`, `shuttle`, and `mixed` travel modes.
- Nearby facility lookup ordered by graph distance instead of straight-line distance.
- Journal create, browse, view, rate, and recommend flows.
- Journal exchange features for exact-title lookup, full-text search, reversible compression, decompression, and storyboard generation.
- Food recommendation plus cuisine-filtered and typo-tolerant search.
- Browser and JSON API surface from `src/server/index.ts` and `public/`.

## Repository Layout

```text
src/
  domain/models.ts
  data/seed.ts
  data/validation.ts
  algorithms/
  services/
  server/index.ts
public/
scripts/
  validate-data.ts
  run-benchmarks.ts
  demo.ts
tests/
docs/
```

## Command Surface

The package scripts are the delivery contract:

- `npm run build`
- `npm run validate:data`
- `npm test`
- `npm run benchmark`
- `npm run demo`
- `npm run start`

## Current Verified Evidence

These results reflect the verified workspace state for March 19, 2026. They combine the current automated evidence below with the earlier March 18 unrestricted live-start and smoke-verification record.

- `npm run build` passed.
- `npm run validate:data` passed with counts:
  - destinations `220`
  - buildings `660`
  - facilityCategories `10`
  - facilities `1100`
  - edges `4070`
  - users `12`
  - journals `12`
  - foods `880`
- `npm test` passed with `30` tests.
- `npm run benchmark` produced representative output:
  - `top-k: 6.250 ms over 25 iteration(s) with sample size 1000`
  - `search: 27.531 ms over 25 iteration(s) with sample size 1000`
  - `graph: 3.149 ms over 25 iteration(s) with sample size 64`
  - `compression: 11.428 ms over 25 iteration(s) with sample size 2640`
- `npm run demo` passed and produced the deterministic `dest-002` / `River Polytechnic` report, including exchange metrics:
  - inputLength `179`
  - compressedLength `162`
  - compressionRatio `0.9050279329608939`
  - algorithmCompressionRatio `0.7430167597765364`
  - spaceSavings `0.0949720670391061`
- `node dist/src/server/index.js` successfully bound to `http://127.0.0.1:3000` in an unrestricted environment.
- Browser/API smoke verification against that live server succeeded for `/`, `/api/health`, `/api/bootstrap`, destination search and recommendation, route planning with `distance` / `time` / `mixed`, nearby facility lookup, journal create/get/list/view/rate/recommendation, journal exchange, and food discovery.

The current implementation also keeps all five destination selectors on one authoritative destination-option preparation path, applies the same duplicate-name disambiguation across route, facility, food, journal, and exchange selectors, and preserves the `12`-item featured deck specifically for homepage destination cards.

Fallback seed graph generation now uses deterministic scenic and campus variants instead of effectively reusing one template shape, and the test suite includes explicit selector-parity and graph-variant regression coverage.

All in-repository delivery work and unrestricted-environment startup verification are now reflected in the docs.
The remaining repository cleanup is documentation-process alignment around RLCR history and handoff materials, not missing product implementation in `src/`, `public/`, `tests/`, or `scripts/`.

The counts, benchmark timings, and demo metrics listed here are evidence snapshots from the verified March 18-19 state, not new permanent product constraints.

## Delivery Docs

The required course-delivery material lives in `docs/`:

- `docs/task-description.md`
- `docs/requirements-analysis.md`
- `docs/overall-design.md`
- `docs/module-design.md`
- `docs/data-structures-and-dictionary.md`
- `docs/example-results-and-tests.md`
- `docs/evaluation-and-improvements.md`
- `docs/user-guide.md`
- `docs/innovation-notes.md`
- `docs/agent-usage.md`

## Environment Note

Earlier `EPERM` bind failures came from restricted-environment rounds. March 18 unrestricted-environment verification confirmed that the compiled server can listen on `127.0.0.1:3000` and serve the browser/API demo surface successfully.
Any remaining follow-up after that verification is documentation-only alignment of the RLCR record and handoff docs.
