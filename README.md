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

These results reflect the verified workspace state for March 18, 2026, including the Round 4 regression fix and the Round 5 documentation alignment pass:

- `npm run build` passed.
- `npm run validate:data` passed with counts:
  - destinations `220`
  - buildings `660`
  - facilityCategories `10`
  - facilities `1100`
  - edges `4180`
  - users `12`
  - journals `12`
  - foods `880`
- `npm test` passed with `20` tests.
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
- `timeout 15s npm run start` failed in a controlled way with `Server failed to start: listen EPERM: operation not permitted 127.0.0.1:3000`.

All in-repository delivery work is now reflected in the docs. The only active non-doc follow-up is external live-bind verification in an environment that permits listening on `127.0.0.1:3000`.

Benchmark timings are representative wall-clock measurements from one run, not permanent constants.

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

The remaining operational limitation is external live-bind verification. The compiled server now reports bind failures cleanly, but this sandbox does not permit listening on `127.0.0.1:3000`, so a full live-start check still has to be repeated in an unrestricted environment.
