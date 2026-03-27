# Evaluation and Improvements

## Recent Recorded Evaluation

- Feature coverage: the repository implements destination recommendation and search, routing, nearby facilities, journals, journal exchange, food discovery, benchmarks, demo scripting, and a browser-facing surface.
- Data scale: the March 19 recorded `npm run validate:data` run reported `220` destinations, `660` buildings, `10` facility categories, `1100` facilities, `4070` edges, `12` users, `12` journals, and `880` foods.
- Algorithm ownership: ranking, prefix/text search, fuzzy matching, routing, multi-stop planning, and compression all live in `src/algorithms/`.
- Verification: this round (March 27, 2026) reran `npm test` (which itself performs `npm run build`) and passed on the current HEAD; the March 19 recorded runs continue to document `npm run validate:data`, `npm run benchmark`, and `npm run demo`, while the March 18 unrestricted-environment checks remain the historical record that browser/API startup worked on `127.0.0.1:3000`.
- Startup behavior: the CLI now supports both the verified unrestricted-environment startup path and clean restricted-environment failure reporting when a sandbox returns `EPERM`.
- Documentation: the delivery docs now describe the implemented repository and recorded evidence instead of Round 0 planning assumptions.

## Strengths

- One shared graph model supports scenic and campus destinations, indoor nodes, transport-constrained edges, and route-strategy selection.
- One authoritative destination-option preparation path now keeps all five destination selectors in parity while still separating homepage featured cards from the full selector catalog.
- Facility discovery uses graph distance, which keeps nearby results aligned with the routing model.
- Journal exchange combines exact-title lookup, full-text search, reversible compression, decompression, and storyboard output in a single service surface.
- Food discovery covers both recommendation and typo-tolerant search on the real dataset.
- Deterministic scenic and campus fallback graph variants give regression tests more structural coverage than the earlier effectively reused template shape.
- The project stays inspectable while relying on `leaflet` for browser maps and on TypeScript tooling (`@types/leaflet`, `typescript`) during builds without overstating its runtime dependency profile.

## Operational Note

There is no remaining live-start verification blocker in the documented March 18 state, and that recorded unrestricted-environment startup/smoke evidence shows a successful bind while the CLI still reports clean `EPERM` failures when restricted sandboxes refuse socket binds.

## Improvement Directions

- Capture screenshots or a short recording from the already verified browser surface if the course review expects presentation artifacts in addition to the reproducible demo and API smoke record.
- Add benchmark history snapshots if future coursework requires tracking algorithm regressions over time rather than showing a single representative run.
- Add more scenario fixtures around multi-stop routing and journal-exchange edge cases if broader acceptance testing is required later.
