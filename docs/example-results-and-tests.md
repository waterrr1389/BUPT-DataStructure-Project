# Example Results and Tests

## Command Matrix

The repository exposes these regression commands:

- `npm run build`
- `npm run validate:data`
- `npm test`
- `npm run benchmark`
- `npm run demo`
- `npm run start`

## Current Verified Results

### Build

- `npm run build` passes.

### Data Validation

- `npm run validate:data` passes against `src/data/seed.ts`.
- Current reported counts:
  - destinations: `220`
  - buildings: `660`
  - facilityCategories: `10`
  - facilities: `1100`
  - edges: `4180`
  - users: `12`
  - journals: `12`
  - foods: `880`

### Automated Tests

- `npm test` passes with `17` tests.
- The package-level test surface currently covers:
  - top-k, trie, inverted-index, fuzzy matching, graph, multi-route, and compression algorithms
  - sample and real-seed validation
  - real runtime/source verification
  - invalid `sortBy` rejection
  - typo-tolerant food search
  - journal exact-title and full-text search behavior
  - indoor route planning and nearby facility lookup
  - deterministic end-to-end demo report coverage

### Benchmarks

- `npm run benchmark` passes with deterministic output:
  - `top-k: 5.801 ms over 25 iteration(s) with sample size 1000`
  - `search: 26.677 ms over 25 iteration(s) with sample size 1000`
  - `graph: 3.456 ms over 25 iteration(s) with sample size 64`
  - `compression: 11.865 ms over 25 iteration(s) with sample size 2640`

## Example Demo Results

`npm run demo` currently produces a deterministic report built from `createAppServices()` and the real seed/runtime data.

Representative outputs:

- Destination search:
  - query: `river polytechnic`
  - top ids: `dest-002`, `dest-022`, `dest-042`
- Indoor route:
  - start: `dest-002-gate`
  - end: `dest-002-archive`
  - reachable: `true`
  - indoor step count: `4`
- Nearby facility:
  - category: `info`
  - nearest id: `dest-002-facility-4`
  - nearest distance: `480`
- Journal flow:
  - created id: `journal-13`
  - exact-title exchange hit: `journal-13`
  - full-text exchange hit: `journal-13`
- Food flow:
  - query: `noodle lab`
  - top food id: `dest-002-food-3`

## Environment Limitation

- Live server bind/start verification is still blocked in this sandbox because listening on `127.0.0.1:3000` raises `EPERM`.
- This is an environment verification gap only; the compiled server and package command surface otherwise pass local verification.
