# Example Results and Tests

## Command Matrix

The repository regression surface is:

- `npm run build`
- `npm run validate:data`
- `npm test`
- `npm run benchmark`
- `npm run demo`
- `npm run start`

## Recorded Evidence Summary

The notes below cover:

- March 27, 2026 automated re-verification (`npm test`, which itself runs `npm run build`) executed for this round, plus targeted code-level confirmation where noted
- March 19, 2026 recorded command runs for `npm run validate:data`, `npm run benchmark`, and `npm run demo` (the earlier automated-test pass is also part of that historical record)
- March 18, 2026 unrestricted live-start and browser/API smoke evidence (historical)

This round reran only `npm test`/`npm run build`; the remaining command evidence stays with the March 19 or March 18 records, and the unrestricted March 18 smoke pass remains historical.

### Build

- Verified on March 27, 2026 when the round's `npm test` script (which runs `npm run build`) passed; the March 19, 2026 run also recorded `npm run build`, providing the historical baseline for the standalone build command.

### Data Validation

- Recorded in the March 19, 2026 run (not rerun during this round), `npm run validate:data` passed against `src/data/seed.ts`.
- Recorded counts:
  - destinations: `220`
  - buildings: `660`
  - facilityCategories: `10`
  - facilities: `1100`
  - edges: `4070`
  - users: `12`
  - journals: `12`
  - foods: `880`

### Automated Tests

- March 27, 2026 reran `npm test` (which runs `npm run build` and `node dist/tests/index.js`) and passed with `144` tests.
- Recorded March 27 automated-test evidence from this round includes:
  - top-k, trie, inverted-index, fuzzy matching, graph, multi-route, and compression algorithms
  - sample and real-seed validation
  - external runtime/source verification
  - bootstrap contract coverage for the `12`-item featured deck plus the full destination catalog used by route, facility, food, journal, and exchange selectors
  - invalid destination `sortBy` rejection
  - typo-tolerant food search
  - journal exact-title and full-text search behavior
  - duplicate destination-label disambiguation while preserving stable destination ids across every destination selector
  - readable journal and exchange destination and user labels with safe fallback when lookups are missing
  - selector-parity coverage in `tests/journal-consumers.test.ts` for one authoritative destination-option preparation path, shared selector bindings, full-catalog reachability from `bootstrap.destinations`, and journal actions remaining anchored to `data-journal-id`
  - deterministic graph-variant regression coverage in `tests/runtime-services.test.ts` for distinct scenic and campus fallback graph structures
  - indoor route planning and nearby facility lookup
  - deterministic end-to-end demo report coverage
- A March 19 recorded code inspection also confirmed that `dist/public/app.js` uses the shared destination-selector binding helper exercised by those automated selector-parity tests; that implementation detail remains tied to the March 19 run because it was not rerun this round, and the public browser URL remains stable.

### Benchmarks

- Recorded in the March 19, 2026 benchmarking run (not rerun during this round), `npm run benchmark` passed.
- Representative output from that recorded run:
  - `top-k: 6.250 ms over 25 iteration(s) with sample size 1000`
  - `search: 27.531 ms over 25 iteration(s) with sample size 1000`
  - `graph: 3.149 ms over 25 iteration(s) with sample size 64`
  - `compression: 11.428 ms over 25 iteration(s) with sample size 2640`

The benchmark harness uses fixed workloads, but the wall-clock timings vary by rerun and machine. Treat the numbers as representative evidence, not immutable constants.

## Example Demo Results

`npm run demo` produced a deterministic report in the recorded March 19, 2026 run (not rerun during this round), built from `createAppServices()` and the real seed/runtime data.

Representative deterministic outputs recorded from that run:

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

## Historical Startup Behavior

- Recorded on March 18, 2026, `node dist/src/server/index.js` successfully listened on `http://127.0.0.1:3000` in an unrestricted environment after the build step completed.
- The March 18 unrestricted live browser/API smoke verification against that server succeeded for:
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
- Verified smoke highlights from the March 18 live run:
  - `/api/health` returned `ok: true` with external data, algorithms, and validation sources
  - `/api/bootstrap` returned `12` users, `12` featured destinations, `20` categories, and `8` cuisines
  - destination search returned `dest-002`, `dest-022`, `dest-042` as the top ids for `river polytechnic`
  - route planning succeeded for `distance`, `time`, and `mixed`
  - facility lookup returned `dest-002-facility-4` at distance `480`
  - journal create/get/list/view/rate/recommendation succeeded on the live server
  - journal exchange exact-title lookup, full-text search, compression/decompression, and storyboard generation succeeded on the live server
  - food recommendation and cuisine-filtered search both returned `dest-002-food-3` with cuisine `noodle lab`
- Earlier `EPERM` bind failures were specific to restricted-environment rounds and do not reflect the unrestricted March 18 verification state.
