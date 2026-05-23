# Catalog, Identity, And World Map Upgrade Plan

## Goal Description

修复 Trail Atlas 当前最影响产品可信度的三组问题：目的地目录需要摆脱模板化重复命名并与 world data 对齐；登录后的写笔记、评论、点赞、评分和删除操作需要统一使用当前登录用户；world map 需要从低细节路线 demo 升级为可浏览、可选点、可规划路线的地图体验。

实现应沿用当前 Node HTTP server、service 层、deterministic seed、vanilla TypeScript SPA、Leaflet world mode 和 SVG local map 架构。修复结果应保持现有算法、local route、journal、feed、browser build 和 world route contract 的核心行为稳定。

## Acceptance Criteria

Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: Destination catalog uses credible unique display names and keeps stable ids.
  - Positive Tests (expected to PASS):
    - Seed catalog exposes the same destination ids as before for existing records.
    - `seedData.destinations` contains no duplicate `name` values.
    - Generated names avoid obvious repeated-word combinations.
    - Destination search, recommendation, route planning, facility lookup, food lookup, journal lookup, and demo flows continue to work with updated fixture names.
  - Negative Tests (expected to FAIL):
    - Any duplicate `destination.name` in the deterministic seed catalog fails data or service-level validation tests.
    - A generated name with repeated identical adjacent words fails fixture quality tests.
    - Updating names without updating deterministic test expectations fails regression tests.

- AC-2: World data visible labels align with the destination catalog.
  - Positive Tests (expected to PASS):
    - Every `world.destinations[].destinationId` resolves to a real destination.
    - Every world placement, portal label, and portal world-node label displays the same destination name as the catalog.
    - World summary/details do not expose stale destination labels.
    - Shared destination selectors still expose unique labels and stable id values.
  - Negative Tests (expected to FAIL):
    - A world placement label that names a different destination than its `destinationId` fails tests.
    - A portal pointing to a missing local node, missing world node, or wrong destination fails existing world validation.
    - Selector options with duplicate visible labels fail browser helper tests.

- AC-3: Browser journal writes use the authenticated current user rather than actor or author dropdowns.
  - Positive Tests (expected to PASS):
    - Compose renders the current user identity and does not render an author selector.
    - Creating a journal from the browser records `userId` from the session user.
    - Comments, likes, unlikes, ratings, and deletes use the session user.
    - New registered users can create content in the same runtime session and see their user name in created content.
  - Negative Tests (expected to FAIL):
    - A logged-in request with a forged body/query `userId` must not create or mutate content as that forged user.
    - An unauthenticated HTTP write request must return a stable 401 response.
    - Compose, Feed, or Post Detail rendering actor controls for write identity fails SPA regression tests.

- AC-4: Feed and Post Detail preserve useful filters while removing identity confusion.
  - Positive Tests (expected to PASS):
    - Feed keeps author and destination filters for browsing content.
    - Feed action buttons use current-user like state.
    - Post Detail shows journal author and current user separately.
    - Delete controls are only available when the current user is allowed to delete.
  - Negative Tests (expected to FAIL):
    - A browsing filter changes the identity used for a write action.
    - A Post Detail actor dropdown can cause comments, likes, ratings, or deletes as another user.
    - Removing actor controls breaks feed filtering or post navigation.

- AC-5: World map has a coordinate-aligned high-resolution visual baseline.
  - Positive Tests (expected to PASS):
    - The decoded world background asset dimensions match the configured world coordinate system, or a dedicated mapping test proves the configured image bounds preserve the asset aspect ratio.
    - The browser build copies the world asset to `dist/public/assets/**` and the built server serves it with the expected image content type.
    - Browser visual checks confirm `/map?view=world` renders a nonblank Leaflet map, the image layer contributes non-background pixels, and marker/route layers remain visible over the raster.
    - Manual visual review confirms the background has no embedded text labels and no obvious black borders, stretched placeholder blocks, or low-detail draft artifacts.
  - Negative Tests (expected to FAIL):
    - A decoded image smaller than the configured world bounds without an explicit non-distorting mapping fails asset checks.
    - A background with baked-in destination labels fails the map asset contract.
    - Missing background asset or broken copied asset fails integration tests.

- AC-6: World map renders meaningful map layers before route planning.
  - Positive Tests (expected to PASS):
    - World map always renders destination markers, region boundaries, hub/junction/portal markers, and visible world road network layers.
    - Road styles distinguish road, rail, trail, bridge, tunnel, and ferry when present.
    - Destination markers open a detail panel with catalog-aligned name, region, tags, route actions, and local map handoff.
    - Marker, route, and tooltip layers remain readable on desktop and mobile viewports.
  - Negative Tests (expected to FAIL):
    - The world graph is invisible until a route is planned.
    - All road types render with the same visual style.
    - Destination details show stale world labels or raw ids as primary text.
    - Mobile layout hides the map or essential route controls.

- AC-7: World route planning can be driven from the map rather than raw local-node input.
  - Positive Tests (expected to PASS):
    - Users can set world route origin and destination by clicking map markers or detail-panel actions.
    - World-only route planning generates the existing `/api/world/routes/plan` payload without requiring raw ids from the user.
    - Cross-map route planning defaults to the best available portal for each destination.
    - Route results render a visible polyline, readable explanation, and local map handoff links.
  - Negative Tests (expected to FAIL):
    - The primary cross-map flow requires manually typing a local node id.
    - Planning a route clears the map or leaves stale polylines after reset.
    - Route result explanation exposes internal ids as primary user-facing labels when readable labels exist.

- AC-8: Regression coverage protects the repaired paths.
  - Positive Tests (expected to PASS):
    - Full build and test pass after fixture updates.
    - Data validation covers catalog uniqueness and world label alignment.
    - HTTP integration covers authenticated journal writes and unauthenticated rejection.
    - SPA regression covers Compose, Feed, Post Detail, world map layers, route selection, and local map no-regression.
    - Browser asset guard still enforces first-party source and generated-output boundaries.
  - Negative Tests (expected to FAIL):
    - Updating fixture names without updating deterministic demo assertions fails tests.
    - Reintroducing actor write controls fails SPA tests.
    - Replacing map visual quality checks with Leaflet stubs only fails review expectations.

## Path Boundaries

Path boundaries define the acceptable range of implementation quality and choices.

### Upper Bound (Maximum Acceptable Scope)

The implementation may include a redesigned deterministic naming generator, catalog/world label alignment helpers, stricter seed tests, authenticated write enforcement for journal HTTP endpoints, removal or reclassification of actor UI, a new high-resolution generated or programmatic raster world asset, additional world graph nodes/edges, always-visible Leaflet road and node layers, destination detail panels, map-driven route origin/destination selection, mobile layout updates, and visual/browser regression tests.

This upper bound does not include production user persistence, role-based authorization, real GIS import, OSM tile integration, replacing Leaflet, rewriting the local SVG map, or migrating the SPA to a frontend framework.

### Lower Bound (Minimum Acceptable Scope)

The minimum acceptable implementation must make the deterministic seed catalog free of duplicate destination names; align all world placement and portal labels with the catalog; remove author/actor controls from browser write identity flows; enforce current-session identity for journal HTTP writes; replace the stretched low-resolution world image with a coordinate-aligned high-resolution asset; render the world road network and important world nodes by default; and verify the repaired paths through focused data, HTTP, SPA, and build tests.

### Allowed Choices

- Can use: existing TypeScript modules, existing service/store patterns, deterministic generation helpers, `Leaflet + CRS.Simple`, generated raster imagery, programmatic canvas/SVG-to-raster tooling, current browser copy module, current test harnesses, focused visual checks, and current world route contracts.
- Cannot use: changing destination ids casually, moving world graph into `/api/bootstrap`, merging world and local graphs, baking text labels into the background image, requiring manual local node id entry as the primary route flow, allowing body/query `userId` to override a session user, replacing Leaflet, migrating local map to Leaflet, or adding a full frontend framework.

> **Note on Deterministic Designs**: Destination ids, API contracts, local graph structure, world route response shape, and Leaflet usage are already fixed. The main implementation choices are how to generate better names, how to present current-user identity, and how to create a richer world map without turning the project into a GIS system.

## Feasibility Hints and Suggestions

> **Note**: This section is for reference and understanding only. These are conceptual suggestions, not prescriptive requirements.

### Conceptual Approach

A practical rollout can use this shape:

```text
catalog repair
  -> unique deterministic names
  -> world label alignment
  -> tests update

identity repair
  -> currentUser lookup
  -> remove author/actor write controls
  -> session-based HTTP writes
  -> tests update

world map upgrade
  -> new coordinate-aligned background
  -> always-visible road/node layers
  -> destination detail panel
  -> click-to-select route endpoints
  -> route rendering and visual checks
```

The catalog repair should land before the world map visual upgrade because marker labels, portal labels, tooltip text, and any new asset coordinate pass depend on stable world data. The identity repair can proceed in parallel because it mostly touches auth, journal HTTP routes, and SPA views.

### Relevant References

- `src/services/fallback-data.ts` - deterministic destination generation.
- `src/data/seed.ts` - seed catalog and worldData.
- `src/data/validation.ts` - seed and world validation.
- `src/services/index.ts` - bootstrap user and current user payload.
- `src/services/auth-service.ts` - session lookup.
- `src/services/user-store.ts` - seed and registered user records.
- `src/services/journal-service.ts` - journal write service behavior.
- `src/server/index.ts` - auth and journal HTTP routes.
- `public/journal-presentation.ts` - destination select label disambiguation.
- `public/journal-consumers.ts` - shared selector binding preparation.
- `public/spa/app-shell.ts` - current user cache, route actor parsing, journal actions.
- `public/spa/views/compose.ts` - write journal UI.
- `public/spa/views/feed.ts` - feed filters and journal actions.
- `public/spa/views/post-detail.ts` - detail actions and comments.
- `public/spa/views/map.ts` - local/world map branch.
- `public/spa/world-rendering.ts` - Leaflet world map UI.
- `public/assets/world-map/` - world background assets.
- `docs/world/spec.md` - frozen world mode boundaries.
- `docs/world/contract.md` - world data and route contracts.
- `tests/data-seed.test.ts` - data validation coverage.
- `tests/auth.test.ts` - auth behavior.
- `tests/integration-smoke.test.ts` - HTTP and deterministic demo coverage.
- `tests/runtime-services.test.ts` - service behavior.
- `tests/spa-regressions*.test.ts` - browser UI regressions.
- `tests/world-route-error-contracts.test.ts` - world route error payloads.

## Dependencies and Sequence

### Milestones

1. Catalog And World Data Alignment: Make destination names credible and align world labels.
   - Update deterministic name generation.
   - Update journal fixture names and deterministic expected outputs.
   - Derive or verify world placement and portal labels against catalog names.
   - Add data tests for uniqueness and alignment.
2. Authenticated Identity Flow: Make browser writes use the current user.
   - Ensure current user is available in frontend lookup state.
   - Remove Compose author selector.
   - Remove actor-driven write identity from Feed and Post Detail.
   - Enforce session identity in journal HTTP writes.
   - Update HTTP and SPA regression tests.
3. World Visual Foundation: Replace the rough background and expose map structure.
   - Add coordinate-aligned high-resolution world image.
   - Render road network, hubs, junctions, portals, and destination markers by default.
   - Add roadType-specific styles and legend/copy as needed.
4. World Map Interaction Upgrade: Make route planning map-driven.
   - Add destination detail panel.
   - Add start/end selection from marker or panel actions.
   - Remove primary raw local-node input flow.
   - Render route result and local handoff links with readable labels.
5. Verification Sweep: Prove the repaired product paths.
   - Run focused data, HTTP, SPA, and browser build tests.
   - Run full test suite.
   - Record residual limitations around non-production auth persistence and non-GIS map precision.

Catalog alignment and identity flow can be implemented in parallel if they use separate branches. World map work should wait for catalog/world label alignment because route labels, marker tooltips, and destination detail panels depend on the corrected catalog.

## Task Breakdown

Each task must include exactly one routing tag:
- `coding`: implemented by the implementation agent
- `analyze`: executed by a review or investigation agent

| Task ID | Description | Target AC | Tag (`coding`/`analyze`) | Depends On |
|---------|-------------|-----------|----------------------------|------------|
| task1 | Audit deterministic catalog names, fixture assertions, and world label mismatches | AC-1, AC-2 | analyze | - |
| task2 | Update destination name generation and fixture expectations while preserving ids | AC-1 | coding | task1 |
| task3 | Align world placement, portal, and world-node visible labels with the catalog | AC-2 | coding | task1, task2 |
| task4 | Add data and selector tests for unique names, label alignment, and stable option ids | AC-1, AC-2 | coding | task2, task3 |
| task5 | Audit auth-dependent browser write flows and HTTP journal write endpoints | AC-3, AC-4 | analyze | - |
| task6 | Remove Compose author selector and create journals with current user identity | AC-3 | coding | task5 |
| task7 | Remove actor-driven write identity from Feed and Post Detail while preserving filters | AC-3, AC-4 | coding | task5 |
| task8 | Enforce session identity and unauthenticated rejection for journal HTTP writes | AC-3, AC-4 | coding | task5 |
| task9 | Add auth, HTTP, and SPA regressions for current-user writes and no actor controls | AC-3, AC-4 | coding | task6, task7, task8 |
| task10 | Produce or generate a coordinate-aligned high-resolution world background asset | AC-5 | coding | task3 |
| task11 | Render always-visible world road, hub, junction, portal, and marker layers | AC-6 | coding | task10 |
| task12 | Add destination detail panel and map-driven route endpoint selection | AC-6, AC-7 | coding | task11 |
| task13 | Remove primary raw local-node entry flow and default cross-map routing through portals | AC-7 | coding | task12 |
| task14 | Add browser visual and interaction regressions for world map quality | AC-5, AC-6, AC-7 | coding | task10, task11, task12, task13 |
| task15 | Run complete verification and summarize remaining risks | AC-8 | analyze | task4, task9, task14 |

## Agent Coordination Model

Two workstreams may run in parallel after the initial audits:

- Identity Flow Worker owns auth, journal HTTP routes, Compose, Feed, Post Detail, and related tests.
- Catalog Data Worker owns fallback data, seed data, world label alignment, and data tests.

The World Map Worker should begin only after Catalog Data Worker has stabilized destination names and world labels. This avoids reworking marker labels, route text, and image-coordinate assumptions.

Agents must not revert unrelated changes. Each worker should report changed files, tests run, and any interface assumptions needed by later workers.

## Pending Decisions

- DEC-1: World map asset creation method
  - Recommended Decision: Use a generated or programmatic high-resolution raster asset with no embedded text.
  - Tradeoff Summary: AI-generated or procedural imagery avoids manual drawing work; keeping labels in Leaflet layers preserves testability and localization control.
  - Decision Status: recommended

- DEC-2: Seed destination name strictness
  - Recommended Decision: Enforce uniqueness for the deterministic demo seed, while keeping selector disambiguation for future real-world duplicate names.
  - Tradeoff Summary: Real places can share names, but this project currently uses synthetic fixture data where repeated names read as low quality.
  - Decision Status: recommended

- DEC-3: Actor simulation controls
  - Recommended Decision: Remove actor controls from normal UI write flows. If a demo viewer switch remains, isolate it as an explicit read-only preview/debug tool outside primary flows.
  - Tradeoff Summary: Keeping hidden simulation capability may help demos, but primary UI must not imply users can write as someone else.
  - Decision Status: recommended

## Implementation Notes

### Code Style Requirements

- Implementation code and comments must NOT contain plan-specific terminology such as "AC-", "Milestone", "Step", "Phase", or similar workflow markers.
- These terms are for plan documentation only, not for resulting code.
- Code identifiers, CSS class names, data attributes, API fields, comments, commit messages, and PR text must remain English.
- User-facing UI copy may be Chinese and should follow the existing `public/spa/copy.ts` pattern where practical.
- Spec and implementation references should identify concepts and files, not depend on line numbers.

### Delivery Guardrails

- Keep `dist/**` treated as generated output unless the existing build flow requires verification.
- Do not commit generated first-party `.js` runtime files under `public/**`; authored browser `.ts` sources under `public/*.ts` and `public/spa/**/*.ts` remain the edit targets.
- Keep `/api/bootstrap` lightweight.
- Preserve local map behavior for `/map?destinationId=...`.
- Preserve world route error contracts unless the plan explicitly updates tests and contracts together.
- Keep generated world image labels outside the raster image.
- Ensure mobile layout is checked for world map, detail panel, and route controls.
- Run `npm run build` before browser or integration tests that depend on compiled output.
