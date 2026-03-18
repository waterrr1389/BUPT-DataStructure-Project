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

The figures below reflect the verified workspace state as of March 19, 2026. The unrestricted live-start and browser smoke evidence still comes from the March 18, 2026 verification pass.

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

- `npm test` passed with `25` tests.
- Current automated coverage includes:
  - top-k, trie, inverted-index, fuzzy matching, graph, multi-route, and compression algorithms
  - sample and real-seed validation
  - external runtime/source verification
  - bootstrap contract coverage for the `12`-item featured deck plus the full destination catalog used by seeded journal lookups
  - invalid destination `sortBy` rejection
  - typo-tolerant food search
  - journal exact-title and full-text search behavior
  - duplicate destination-label disambiguation while preserving stable destination ids
  - readable journal and exchange destination and user labels with safe fallback when lookups are missing
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

- `node dist/src/server/index.js` successfully listened on `http://127.0.0.1:3000` in an unrestricted environment after the build step completed.
- Live browser/API smoke verification against that server succeeded for:
  - `/`
  - `/api/health`
  - `/api/bootstrap`
  - `/api/destinations`
  - `/api/destinations/recommendations`
  - `/api/routes/plan`
  - `/api/facilities/nearby`
  - `/api/journals`
  - `/api/journals/recommendations`
  - `/api/journal-exchange/destination`
  - `/api/journal-exchange/title`
  - `/api/journal-exchange/search`
  - `/api/journal-exchange/compress`
  - `/api/journal-exchange/decompress`
  - `/api/journal-exchange/storyboard`
  - `/api/foods/recommendations`
  - `/api/foods/search`
- Verified smoke highlights from that live run:
  - `/api/health` returned `ok: true` with external data, algorithms, and validation sources
  - `/api/bootstrap` returned `12` users, `12` featured destinations, `20` categories, and `8` cuisines; the current contract also returns `destinations` with the full destination catalog used by the journal and exchange destination controls
  - destination search returned `dest-002`, `dest-022`, `dest-042` as the top ids for `river polytechnic`
  - route planning succeeded for `distance`, `time`, and `mixed`
  - facility lookup returned `dest-002-facility-4` at distance `480`
  - journal create/get/list/view/rate/recommendation succeeded on the live server
  - journal exchange exact-title lookup, full-text search, compression/decompression, and storyboard generation succeeded on the live server
  - food recommendation and cuisine-filtered search both returned `dest-002-food-3` with cuisine `noodle lab`
- Current browser behavior uses the full bootstrap destination catalog for the journal and exchange destination selectors, disambiguates duplicate destination names in those controls, and renders readable destination or user names on journal and exchange cards when lookup data exists.
- Earlier `EPERM` bind failures were specific to restricted-environment rounds and do not reflect the unrestricted March 18 verification state.
