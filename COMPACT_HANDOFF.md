# Compact Handoff For Catalog, Identity, And World Map Work

## Purpose

This temporary handoff is written for a zero-context agent or developer who needs to continue the current work after conversation compaction. It summarizes the project constraints, investigation findings, documents created, review feedback, current workspace state, and recommended next implementation order.

This file is a temporary coordination artifact. It is not intended as a long-term product document unless the user explicitly decides to keep it.

## Repository Context

Project path:

```text
/home/frisk/ds-ts
```

Project name:

```text
Trail Atlas
```

Product summary:

Trail Atlas is a TypeScript travel exploration demo. It combines destination discovery, route planning, facilities, food discovery, journal/feed/social interactions, authentication, and a world map mode.

Important structure:

- `src/domain/models.ts`: shared domain model.
- `src/data/seed.ts`: seed catalog and world map data.
- `src/services/fallback-data.ts`: deterministic generated destination catalog.
- `src/data/validation.ts`: seed and world data validation.
- `src/services/**`: business services.
- `src/server/index.ts`: Node HTTP server and `/api/*` routes.
- `public/spa/**`: authored browser TypeScript SPA.
- `public/assets/world-map/**`: world map assets.
- `tests/**`: algorithm, service, API, browser build, SPA, world route, and regression tests.
- `dist/**`: generated build output.
- `.humanize/**`: local coordination/review state; do not commit.

Key commands:

```bash
npm run build
npm run validate:data
npm test
npm run benchmark
npm run demo
```

Use Node `>=20`.

## Project And Editing Constraints

From `AGENTS.md` and developer instructions:

- Before implementation, state the approach.
- If requirements are ambiguous, high risk, or broad, clarify before writing code.
- "Plan" means plan only, no code.
- Code identifiers, comments, protocol values, CSS classes, data attributes, commit messages, and PR text must be English.
- User-facing UI copy may be Chinese.
- Do not use `/init`.
- Do not commit `.humanize`.
- Do not add development-process notes to `README.md`.
- Do not use plan/process labels like `FIXED`, `Step`, `Week`, `Section`, `Phase`, `AC-x` in code comments, commit messages, or PR body.
- Do not mention AI tool names in code comments, commit messages, or PR body.
- Use `rg`/`rg --files` for search.
- Use `apply_patch` for manual file edits.
- Do not revert user changes.
- Treat `public/*.ts` and `public/spa/**/*.ts` as authored browser source.
- Do not commit generated first-party `.js` runtime files under `public/**`; generated runtime output belongs under `dist/public/**`.
- `public/vendor/**` is the third-party browser asset exception.

## Skills Used

The user explicitly asked to write a humanize-style plan. The `humanize` skill was used for plan structure guidance.

Relevant skill file read:

```text
/home/frisk/.codex/skills/humanize/SKILL.md
```

The plan follows the expected structure:

- `Goal Description`
- `Acceptance Criteria`
- `Path Boundaries`
- `Feasibility Hints and Suggestions`
- `Dependencies and Sequence`
- `Task Breakdown`
- `Implementation Notes`

## User-Reported Problems

The user reported:

1. Many destinations have names like `Amber Bay`, and dropdowns appear duplicated.
2. Login exists, but posting still seems tied to hardcoded seed user lists.
3. World map is very rough; the desired direction was closer to an open-world map, but the current result feels poor.
4. The user cannot manually draw the world map and wants an implementation spec and humanize plan before coding.

The user later asked for this handoff before context compaction.

## Investigation Summary

### Destination Catalog

Findings:

- `src/data/seed.ts` uses `fallbackSeedData.destinations`.
- The actual deterministic name generation is in `src/services/fallback-data.ts`.
- Scenic destination names are generated from limited adjective/noun lists.
- Current built seed has `220` destinations but only `120` unique names.
- Ten scenic names repeat 11 times each, including `Amber Bay`.
- `Harbor Harbor` is caused by mechanical name composition.
- `src/data/validation.ts` validates ids and graph references, but does not enforce unique `destination.name`.
- The shared destination select pipeline already disambiguates duplicate visible labels using region and id.

Useful observed stats from built output:

```text
destinations: 220
uniqueNames: 120
duplicateGroups: 10
duplicateRecords: 110
Amber Bay: 11
Juniper Reserve: 11
Harbor Harbor: 11
Misty Valley: 11
Velvet Terrace: 11
Lantern Cliff: 11
Silver Lookout: 11
Granite Garden: 11
Maple Promenade: 11
Cedar Museum Park: 11
```

Shared destination select logic:

- `public/journal-presentation.ts`
  - `createDestinationSelectOptions`
  - adds `region`, then `id`, when names collide.
- `public/journal-consumers.ts`
  - `prepareDestinationSelectorBindings`
  - uses `bootstrap.destinations` first, falling back to `bootstrap.featured`.
  - covers:
    - `#explore-facility-destination`
    - `#explore-food-destination`
    - `#map-destination`
    - `#feed-destination-filter`
    - `#feed-exchange-destination`
    - `#compose-destination`

Read-only check showed current shared options have `220` unique visible labels, so repeated-looking dropdowns are probably caused by raw data, world-specific selectors, or stale labels rather than the shared selector path appending duplicates.

### World Data Alignment

Findings:

- `src/data/seed.ts` contains hand-written `worldData`.
- `worldData.destinations[].label` is not derived from the main destination catalog.
- 11 of 12 world placement labels currently mismatch the actual destination names generated in `fallbackSeedData`.

Observed mismatches from built output:

```text
dest-007 world="Silver Lookout · North Belt" actual="Misty Valley"
dest-002 world="River Polytechnic · River Arc" actual="North Institute"
dest-008 world="Lotus Learning Hub · River Arc" actual="Summit School"
dest-004 world="Summit Learning Hub · West Ridge" actual="River College"
dest-010 world="Vertex Polytechnic · West Ridge" actual="Harbor Polytechnic"
dest-006 world="Pioneer Polytechnic · Central Axis" actual="Central Learning Hub"
dest-012 world="River Learning Hub · Central Axis" actual="Pioneer Research Park"
dest-003 world="Harbor Harbor · Harbor Line" actual="Juniper Reserve"
dest-009 world="Maple Promenade · Harbor Line" actual="Velvet Terrace"
dest-005 world="Velvet Terrace · East Loop" actual="Harbor Harbor"
dest-011 world="Amber Bay · East Loop" actual="Lantern Cliff"
```

This is a key source of low product credibility in world map labels, route handoff labels, marker tooltips, and possibly user perception of duplicated locations.

### Authentication And Posting

Findings:

- Login/register exists and uses `trail_atlas_session` HttpOnly cookie.
- `src/services/auth-service.ts` stores sessions in memory.
- `src/services/user-store.ts` initializes seed users with default password `trail-atlas`; registered users are in-memory only.
- SPA startup in `public/spa/app-shell.ts` calls `/api/auth/me`.
- `/api/bootstrap` can also return `currentUser`.
- Server journal write routes call `resolveCurrentUserId()`.
- When a valid session cookie exists, server write routes use the session user and override body/query `userId`.
- Without a valid session, many routes currently fall back to body/query `userId`.

Old UI design remains:

- `public/spa/views/compose.ts`
  - still renders author selector `#compose-user`.
  - submits `userId: authorSelect.value`.
  - default author can come from URL `actor`, `currentUser`, or first seed user.
- `public/spa/views/feed.ts`
  - still renders `#feed-actor`.
  - uses actor in URLs and write actions.
- `public/spa/views/post-detail.ts`
  - still renders `#post-actor`.
  - uses selected actor for view/rate/delete/like/comment actions.
- `public/spa/app-shell.ts`
  - still parses `actor` query param.
  - `createComment()` and `sendJournalAction()` still accept selected user id.
- `src/services/index.ts`
  - `bootstrap.users` currently maps only `runtime.seedData.users`, so newly registered users are not automatically included in the seed-user actor dropdowns.

Conclusion:

Normal logged-in HTTP writes are mostly protected by session override, but the browser still looks like an old seed-user simulator. The UI should be changed so writes use current user identity and actor controls are removed or isolated as explicit read-only preview/debug controls.

### World Map Quality

Findings:

- Current world map specs already freeze:
  - `Leaflet + CRS.Simple`
  - `/map?view=world`
  - local SVG map remains unchanged
  - world/local graph separation
  - portals as the only bridge
- Runtime world data currently has:
  - width `4096`
  - height `3072`
  - 6 regions
  - 12 destination placements
  - 22 world nodes
  - 25 world edges
  - 12 portals
- Current background asset:
  - `public/assets/world-map/atlas-boston-inspired-v1.png`
  - actual size `1024x768`
  - file size around `159K`
  - used as background for `4096x3072`, so it is effectively stretched.
- Visually, the current asset is a rough abstract color-block image, not a credible open-world map.
- `public/spa/world-rendering.ts` currently renders:
  - Leaflet image overlay
  - translucent region polygons
  - circle markers for destinations
  - route polyline only after planning
  - side-form driven route planning
- It does not normally show road network, hub/junction/portal layers, roadType differentiation, or map-driven route selection.
- Cross-map UI currently exposes raw local node id input.

Conclusion:

The world map is functionally a route-planning demo, not an open-world style exploration map. The upgrade should use a high-resolution text-free raster background and render labels/roads/markers/route layers through Leaflet or DOM.

## Documents Created In Current Work

Two new docs were added:

```text
docs/catalog-identity-world-map-spec.md
docs/catalog-identity-world-map-plan.md
```

### Spec Document

Path:

```text
docs/catalog-identity-world-map-spec.md
```

Purpose:

Defines the product/technical specification for:

- destination catalog naming quality
- world data label alignment
- authenticated identity flow
- world map visual and interaction upgrade

Important sections:

- `Goal`
- `Context Boundary`
- `Current Problems To Resolve`
- `Frozen Decisions`
- `Product Shape`
- `Data Contracts`
- `API Surface`
- `UI Requirements`
- `Validation And Safety`
- `Testing Contract`
- `Rollout Model`
- `Non-Goals`

### Humanize Plan Document

Path:

```text
docs/catalog-identity-world-map-plan.md
```

Purpose:

Defines a humanize-style implementation plan for the same work.

Important sections:

- `Goal Description`
- `Acceptance Criteria`
- `Path Boundaries`
- `Feasibility Hints and Suggestions`
- `Dependencies and Sequence`
- `Task Breakdown`
- `Agent Coordination Model`
- `Pending Decisions`
- `Implementation Notes`

The plan contains 8 acceptance criteria:

- `AC-1`: destination catalog unique credible names with stable ids
- `AC-2`: world visible labels align with catalog
- `AC-3`: browser journal writes use authenticated current user
- `AC-4`: Feed/Post preserve filters while removing identity confusion
- `AC-5`: world map has coordinate-aligned high-resolution visual baseline
- `AC-6`: world map renders meaningful layers before route planning
- `AC-7`: world route planning is map-driven rather than raw local-node input
- `AC-8`: regression coverage protects repaired paths

The plan includes a 15-task breakdown:

- `task1` through `task4`: catalog and world label work
- `task5` through `task9`: identity flow work
- `task10` through `task14`: world map work
- `task15`: verification

## Review Agent Results

A review agent inspected the spec and plan.

Findings:

1. Medium: The initial delivery guardrail said not to write first-party JavaScript into `public/**`, which conflicted with the repo's authored browser TypeScript source boundary.
2. Low: Initial world visual acceptance criteria used subjective wording without enough operational checks.

Both were addressed.

Current plan now says:

```text
Do not commit generated first-party `.js` runtime files under `public/**`; authored browser `.ts` sources under `public/*.ts` and `public/spa/**/*.ts` remain the edit targets.
```

Current `AC-5` now includes concrete checks:

- decoded image dimensions or non-distorting bounds mapping
- asset copy and server content type
- browser visual checks for nonblank map, image-layer pixels, visible marker/route layers
- manual review for subjective map quality

No high-severity issues remained after review.

## Current Workspace State

At the time this handoff was written, expected untracked/modified files are:

```text
?? COMPACT_HANDOFF.md
?? docs/catalog-identity-world-map-plan.md
?? docs/catalog-identity-world-map-spec.md
```

No business code has been changed in this planning work.

Tests were not run for this docs-only work.

## Recommended Branch And Agent Strategy

Recommended branch sequencing:

1. `fix/catalog-world-data`
   - destination naming quality
   - world placement/portal labels aligned with catalog
   - data and selector tests
2. `fix/auth-identity-flow`
   - can run in parallel with catalog branch
   - removes author/actor write identity controls
   - enforces session identity for writes
   - HTTP and SPA tests
3. `feature/world-map-upgrade`
   - should start after catalog/world data alignment
   - new background asset
   - always-visible road/node layers
   - detail panel
   - map-driven route selection
   - visual/browser tests

Recommended agent assignment:

- Catalog Data Worker:
  - owns `src/services/fallback-data.ts`, `src/data/seed.ts`, `src/data/validation.ts`, data tests, deterministic fixture updates.
- Identity Flow Worker:
  - owns `src/server/index.ts`, journal auth behavior, `public/spa/app-shell.ts`, `compose.ts`, `feed.ts`, `post-detail.ts`, auth/HTTP/SPA tests.
- World Map Worker:
  - waits for catalog alignment.
  - owns world asset, `public/spa/world-rendering.ts`, styles, world map tests.

Important dependency:

World map upgrade depends on catalog/world label alignment. Do not start serious map asset/coordinate work before destination names and world labels stabilize.

## Suggested Next Implementation Order

If continuing from this handoff, do this:

1. Read:
   - `AGENTS.md`
   - `README.md`
   - `docs/catalog-identity-world-map-spec.md`
   - `docs/catalog-identity-world-map-plan.md`
   - `docs/world/spec.md`
   - `docs/world/contract.md`
2. Confirm with user whether to begin implementation or only refine docs.
3. If implementation begins, state the method first.
4. Start with catalog data alignment:
   - make destination names unique and credible
   - fix world label mismatches
   - update deterministic expected outputs
   - add validation/tests
5. In parallel or next, handle identity flow:
   - remove Compose author selector
   - remove actor-driven write identity
   - enforce session writes
   - add HTTP and SPA tests
6. After data alignment, start world map upgrade:
   - generate/produce a high-resolution text-free map
   - render world road/node layers
   - add destination detail panel
   - add map-driven route selection
   - add visual regression checks

## Verification Expectations For Future Work

Focused checks likely needed:

```bash
npm run build
npm run validate:data
npm test
```

Depending on scope, also:

```bash
npm run demo
npm run benchmark
```

Visual/world-map changes should include browser-level checks, not only Leaflet stubs. The plan explicitly calls for nonblank map/pixel/visibility checks plus manual visual review for subjective background quality.

## Important Risks

- Changing destination names will break deterministic tests and demo assertions until expectations are updated.
- Enforcing 401 for unauthenticated write routes may break old tests that relied on body/query `userId`; tests should be updated intentionally.
- Removing actor controls may require careful preservation of author filters and viewer state.
- New registered users are currently in-memory only; this is acceptable for this spec, but UI lookup must still display current user names.
- World map asset changes can desynchronize coordinates if `world.width`, `world.height`, regions, placements, and graph nodes are not kept aligned.
- If only the raster background is improved but road/marker/label layers remain sparse, the map will still feel like a demo.
- If world graph density increases, world route tests may need updated route expectations.
- Do not accidentally commit `.humanize`, generated `dist/**`, or generated first-party `.js` files under `public/**`.

## Current User Intent

The user wants planning/context preservation before compacting conversation context. They have not yet asked to implement the plan. The next agent should not start coding unless the user asks for implementation or clearly authorizes the next step.
