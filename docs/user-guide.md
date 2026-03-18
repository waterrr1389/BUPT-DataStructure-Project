# User Guide

## Prerequisites

- Node.js 20 or newer available globally.
- TypeScript compiler `tsc` available globally.
- No external package installation is required.

## Build and Run

After the worker team implements the planned source files, use:

```bash
npm run build
npm run validate:data
npm run test
npm run start
```

Optional commands:

```bash
npm run benchmark
npm run demo
```

## Intended User Flow

1. Validate the seed dataset.
2. Start the server and open the browser demo served from `src/server/index.ts` and `public/`.
3. Explore destination recommendation and destination search.
4. Request a route and nearby facilities for a selected area.
5. Browse journals, search journal content, and inspect compression or AIGC demo outputs.
6. Review food recommendations tied to the active destination or campus.

## Troubleshooting

- If `npm run build` fails because an entry file is missing, confirm that the planned `src/`, `scripts/`, and `tests/` files have been implemented.
- If validation fails, inspect the seed dataset counts and referential integrity rules.
- If the server starts but a demo feature is empty, confirm that the corresponding service and public assets were built against the same seed data.

## Demo Operator Notes

- Keep at least one deterministic demo scenario for each feature area.
- Prefer fixed IDs and fixed user profiles in demo scripts so reviewers can reproduce results exactly.
