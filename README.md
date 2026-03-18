# Personalized Travel System

This repository is a zero-dependency TypeScript course project for a personalized travel system. It is no longer a scaffold-only starter: the current repository includes implemented source under `src/`, `scripts/`, `public/`, and `tests/` alongside the course-delivery documentation.

The implementation covers destination recommendation, destination and journal search, route planning, nearby facility lookup, journal management and exchange, food discovery, benchmark and demo scripts, and a browser-based demo surface.

## Constraints

- No external npm dependencies.
- Use global `node` and `tsc`.
- Compile all TypeScript to `dist/`.
- Keep core algorithms custom rather than delegating to database-native ranking, search, or routing features.

## Repository Layout

```text
src/
  domain/models.ts
  data/seed.ts
  data/validation.ts
  algorithms/
    top-k.ts
    trie.ts
    inverted-index.ts
    fuzzy.ts
    graph.ts
    multi-route.ts
    compression.ts
  services/
    ...
  server/index.ts
public/
  ...
scripts/
  validate-data.ts
  run-benchmarks.ts
  demo.ts
tests/
  ...
docs/
  task-description.md
  requirements-analysis.md
  overall-design.md
  data-structures-and-dictionary.md
  module-design.md
  example-results-and-tests.md
  evaluation-and-improvements.md
  user-guide.md
  innovation-notes.md
  agent-usage.md
```

## Commands

The command contract in `package.json` is live and was verified in this workspace on March 18, 2026. The build, test, validate, benchmark, and demo commands currently succeed; `npm run start` compiles successfully, but live bind verification was not possible in this sandbox because listening on `127.0.0.1:3000` failed with `EPERM`.

- `npm run build` compiles TypeScript into `dist/`.
- `npm test` rebuilds and runs `dist/tests/index.js`; it currently passes 11 tests.
- `npm run validate:data` rebuilds and runs `dist/scripts/validate-data.js`; it currently passes and reports 200 destinations, 200 buildings, 10 facility categories, 200 facilities, 200 edges, 10 users, 20 journals, and 200 foods.
- `npm run benchmark` rebuilds and runs `dist/scripts/run-benchmarks.js`; it currently prints deterministic benchmark results.
- `npm run start` rebuilds and runs `dist/src/server/index.js`; the compile step succeeds, but in this sandbox the process then fails to bind `127.0.0.1:3000` with `EPERM`, so live server verification needs an environment that allows listening sockets.
- `npm run demo` rebuilds and runs `dist/scripts/demo.js`; it currently prints a deterministic demo report.

## Delivery Documents

The `docs/` directory contains the course-delivery material for requirements, architecture, module boundaries, testing expectations, user flow, innovation notes, and agent usage tracking. The docs are written to stay aligned with the implemented module split so future updates can preserve the current command contract and acceptance criteria.

## Collaboration Assumptions

- Keep new product code inside the existing `src/`, `scripts/`, `tests/`, and `public/` paths.
- Preserve the zero-dependency rule.
- If Node runtime APIs need types, add local shims in the owning area rather than introducing external type packages.
- Keep docs in sync with any structural changes that affect the command contract or acceptance criteria.
