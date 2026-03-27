# User Guide

## Prerequisites

- Node.js 20 or newer available globally
- Install project dependencies with `npm install`

## Core Commands

Run the full local verification flow with:

```bash
npm run build
npm run validate:data
npm test
npm run benchmark
npm run demo
```

`npm run build` runs the browser build flow and then the server build flow, using project-installed dependencies from `node_modules` (including TypeScript).

Start the browser-facing app with:

```bash
npm run start
```

`npm run start` runs `npm run build` and then launches `dist/src/server/index.js`, the built output of `src/server/index.ts`.

## What The System Exposes

- Routed browser shell views for Home, Explore, Map, Feed, Compose, and Post Detail
- Destination recommendation and search
- Single-target, indoor, and world-mode route planning
- Nearby facility lookup by category and network distance
- Journal create, browse, view, rate, recommend, and feed flows
- Journal exchange: exact-title lookup, full-text search, compression/decompression, and storyboard generation
- Food recommendation and typo-tolerant search
- Map-based routing anchors cohesive planning: origin/destination, segment details, and overlays are arranged in a single hierarchy, the map legend tracks the visible path types (outdoor route, indoor route, bike lane, shuttle lane) and marker cues (start, end, transition, turn) so the colors and labels match what is on-screen, the copy guides the next action, and the route cards borrow the journal/feed treatment so everything feels connected.
- The homepage featured deck remains a curated 12-item subset; route, facility, food, journal, exchange, and feed selectors use the full destination catalog.

## Deterministic Demo

Use `npm run demo` for the reproducible walkthrough. The current scripted report uses the real app runtime and the real seed dataset, centered on `dest-002` (`River Polytechnic`).

The demo covers:

1. Destination search and recommendation
2. Indoor route planning from `dest-002-gate` to `dest-002-archive`
3. Nearby `info` facility lookup
4. Journal create, get, record-view, rate, and recommend
5. Journal exchange exact-title search, full-text search, compression/decompression, and storyboard
6. Food search and recommendation

## Browser/API Notes

- `GET /api/health` reports the runtime source bundle, including whether data/algorithms/validation are external or fallback.
- `src/server/index.ts` is the server entry source. The running server serves generated browser assets from `dist/public/**` plus JSON API endpoints, so source and served runtime output stay separated.
- First-party browser sources live in `public/*.ts` and `public/spa/**/*.ts`.
- `dist/public/**` is generated runtime output only, not an authored source tree.
- `public/vendor/**` remains the third-party browser asset exception and is emitted to `dist/public/vendor/**`.
- The current browser/API surface includes local routing endpoints, world-summary/detail/plan endpoints under `/api/world*`, and the journal feed endpoint at `GET /api/feed`.
- Route, facility, food, journal, exchange, and feed destination selectors draw from the same full destination catalog and use the same duplicate-name disambiguation. The featured destination subset stays reserved for homepage cards.
- Invalid destination `sortBy` inputs are rejected instead of being silently treated as `rating`.

## Troubleshooting

- If `npm run start` fails with `EPERM` on `127.0.0.1:3000` inside a restricted sandbox, treat that as an environment limitation rather than a known compile/runtime issue in the repo. The March 18 unrestricted-environment verification recorded elsewhere in the delivery docs remains the historical confirmation that the app can also start successfully and serve the browser/API surface.
- If you change browser TypeScript under `public/*.ts` or `public/spa/**/*.ts`, rerun `npm run build` so the served JavaScript in `dist/public/` is refreshed.
- If you change `public/journal-consumers.ts`, `public/journal-presentation.ts`, or `public/route-visualization-markers.ts`, keep their browser-global and CommonJS-compatible behavior intact because they are compiled as script-style helpers rather than ESM modules.
- If demo output changes, rerun `npm test` because `tests/integration-smoke.test.ts` asserts the deterministic demo report structure.
- If fallback-only runtime behavior changes, rerun `npm test` because `tests/runtime-services.test.ts` now checks the deterministic scenic and campus graph variants directly.
- If validation fails, inspect `src/data/seed.ts` and `src/data/validation.ts`; `scripts/validate-data.ts` now checks the real runtime dataset, not a toy sample.
