# Example Results and Tests

## Command Matrix

The repository regression surface is:

- `npm run build`
- `npm run validate:data`
- `npm test`
- `npm run benchmark`
- `npm run demo`
- `npm run start`

## Current Verified Results

The figures below reflect the verified workspace state for March 18, 2026, including the Round 4 regression fix and the Round 5 documentation alignment pass.

### Build

- `npm run build` passed.

### Data Validation

- `npm run validate:data` passed against `src/data/seed.ts`.
- Reported counts:
  - destinations: `220`
  - buildings: `660`
  - facilityCategories: `10`
  - facilities: `1100`
  - edges: `4180`
  - users: `12`
  - journals: `12`
  - foods: `880`

### Automated Tests

- `npm test` passed with `20` tests.
- Current automated coverage includes:
  - top-k, trie, inverted-index, fuzzy matching, graph, multi-route, and compression algorithms
  - sample and real-seed validation
  - external runtime/source verification
  - invalid destination `sortBy` rejection
  - typo-tolerant food search
  - journal exact-title and full-text search behavior
  - indoor route planning and nearby facility lookup
  - deterministic end-to-end demo report coverage

### Benchmarks

- `npm run benchmark` passed.
- Representative output from one verified run:
  - `top-k: 6.250 ms over 25 iteration(s) with sample size 1000`
  - `search: 27.531 ms over 25 iteration(s) with sample size 1000`
  - `graph: 3.149 ms over 25 iteration(s) with sample size 64`
  - `compression: 11.428 ms over 25 iteration(s) with sample size 2640`

The benchmark harness uses fixed workloads, but the wall-clock timings vary by rerun and machine. Treat the numbers as representative evidence, not immutable constants.

## Example Demo Results

`npm run demo` currently produces a deterministic report built from `createAppServices()` and the real seed/runtime data.

Representative deterministic outputs:

- Runtime:
  - dataSource: `external`
  - destinationCount: `220`
  - userCount: `12`
  - seedJournalCount: `12`
  - focus destination: `dest-002` / `River Polytechnic`
- Destination flow:
  - query: `river polytechnic`
  - top ids: `dest-002`, `dest-022`, `dest-042`
- Route flow:
  - start: `dest-002-gate`
  - end: `dest-002-archive`
  - reachable: `true`
  - indoor step count: `4`
  - used modes: `walk`, `bike`
- Facility flow:
  - category: `info`
  - nearest id: `dest-002-facility-4`
  - nearest distance: `480`
- Journal flow:
  - created id: `journal-13`
  - exact-title hit: `journal-13`
  - full-text top hit: `journal-13`
- Exchange metrics:
  - inputLength: `179`
  - compressedLength: `162`
  - compressionRatio: `0.9050279329608939`
  - algorithmCompressionRatio: `0.7430167597765364`
  - spaceSavings: `0.0949720670391061`
  - decompressedMatches: `true`
- Food flow:
  - query: `noodle lab`
  - top food id: `dest-002-food-3`
  - top food cuisine: `noodle lab`

## Startup Behavior

- `timeout 15s npm run start` now fails in a controlled way with:
  - `Server failed to start: listen EPERM: operation not permitted 127.0.0.1:3000`
- That output confirms the bind error is handled and surfaced cleanly.
- The only remaining non-doc gap is external live-bind verification in an environment that permits sockets.
