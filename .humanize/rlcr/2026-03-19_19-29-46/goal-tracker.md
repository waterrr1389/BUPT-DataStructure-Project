# Goal Tracker

<!--
This file tracks the ultimate goal, acceptance criteria, and plan evolution.
It prevents goal drift by maintaining a persistent anchor across all rounds.

RULES:
- IMMUTABLE SECTION: Do not modify after initialization
- MUTABLE SECTION: Update each round, but document all changes
- Every task must be in one of: Active, Completed, or Deferred
- Deferred items require explicit justification
-->

## IMMUTABLE SECTION
<!-- Do not modify after initialization -->

### Ultimate Goal
Rework the current single-page `public/` demo into a multi-view social travel SPA centered on journals, while preserving the existing TypeScript service, algorithm, and server layers plus all course-delivery capabilities. The default implementation path must stay compatible with the current zero-dependency Node plus `tsc` workflow; a React-based frontend is only acceptable if the repository intentionally adopts new frontend tooling first.

## Acceptance Criteria

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->


Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: The domain and service contracts support journal social interactions without breaking existing journal data flows.
  - Positive Tests (expected to PASS):
    - Service-level tests can create and list flat comments for a valid `journalId` and `userId`, and comment metadata includes stable ids and timestamps.
    - Service-level tests can record and remove a like for a valid `journalId` and `userId`, and feed/detail summaries expose `likeCount`, `commentCount`, `viewerHasLiked`, `destinationLabel`, `userLabel`, and a summary body.
    - Existing journal create, update, delete, view, recommend, and rate tests continue to pass against the updated contracts.
  - Negative Tests (expected to FAIL):
    - A duplicate like from the same user on the same journal is rejected and does not increase `likeCount`.
    - Comment creation fails for unknown journals, unknown users, or empty bodies.
    - Feed summary payloads do not expose full comment collections or unrelated destination graph data.

- AC-2: The HTTP API adds social endpoints while preserving the current course-facing journal and travel APIs.
  - Positive Tests (expected to PASS):
    - `GET /api/feed` returns paginated summary items and supports `cursor`, `limit`, `destinationId`, and `userId` filters.
    - `GET /api/journals/:id`, `GET /api/journals/:id/comments`, `POST /api/journals/:id/likes`, `DELETE /api/journals/:id/likes`, `POST /api/journals/:id/comments`, `DELETE /api/comments/:id`, and `POST /api/journals` return deterministic JSON responses and mutate runtime state as expected.
    - Existing endpoints for destinations, routes, facilities, journal rating, exchange, and food remain reachable and behaviorally compatible.
  - Negative Tests (expected to FAIL):
    - Invalid cursors, invalid limits, unknown ids, and malformed bodies return error payloads and leave persisted state unchanged.
    - `GET /api/feed` does not return full comment threads or large per-destination map payloads.
    - Unknown API paths still fail with the existing error contract instead of falling through silently.

- AC-3: The browser experience becomes a routed SPA with distinct Explore, Map, Feed, Post Detail, and Compose views.
  - Positive Tests (expected to PASS):
    - Direct requests to `/`, `/explore`, `/map`, `/feed`, `/compose`, and `/posts/<journalId>` serve the SPA shell and boot the correct view.
    - In-app navigation updates the active view without rendering the previous all-in-one dashboard.
    - Deep links such as `/map?destinationId=dest-001&from=dest-001-gate&to=dest-001-hall-l1` hydrate the map view with the correct context.
  - Negative Tests (expected to FAIL):
    - The initial route does not render every course feature form in one long page.
    - Unknown frontend routes resolve to a deliberate default or not-found view instead of a blank shell or server 404.
    - The routed shell does not force full-page reloads for normal in-app navigation.

- AC-4: Existing course-delivery capabilities are preserved across the new information architecture.
  - Positive Tests (expected to PASS):
    - Explore still supports destination search/recommendation, food discovery, and nearby facility lookup.
    - Map still supports route planning and the current visualization logic, including destination graph rendering.
    - Journal exchange remains reachable as a secondary surface tied to journal flows or a utility panel rather than being removed.
  - Negative Tests (expected to FAIL):
    - The redesign does not remove exchange, route, facility, food, or recommendation capabilities to make room for the social feed.
    - Explore does not eagerly fetch full destination detail graphs until the user opens map-related context.
    - Map does not become the only place where non-journal course features are accessible.

- AC-5: Journal feed, detail, and compose flows prioritize social browsing instead of raw record management.
  - Positive Tests (expected to PASS):
    - Feed cards show summary-first journal content with author, destination, counts, like action, comment entry point, and open-in-map action.
    - Post Detail loads full body content and paginated comments on demand, and supports comment creation plus like/unlike actions.
    - Compose supports destination selection, title, body, tags, and optional media placeholders, then returns the user to a sensible post-create destination such as feed or detail.
  - Negative Tests (expected to FAIL):
    - Feed does not render full article bodies and complete comment threads for every card on initial load.
    - The first phase does not attempt nested reply trees, realtime messaging, or notification systems.
    - Compose does not regress into the original generic admin-style input sheet.

- AC-6: Performance constraints are enforced in the API, view loading, and map rendering paths.
  - Positive Tests (expected to PASS):
    - Non-active views are deferred or lazy-loaded so the initial route does not initialize all page logic at once.
    - Search, filter, and route-preview inputs use debounce or equivalent request coalescing.
    - Map projection and derived overlay data are cached per destination instead of being recomputed on unrelated state changes.
    - JSON responses are emitted compactly, and static asset caching is more specific than a blanket `no-store` policy for every asset.
  - Negative Tests (expected to FAIL):
    - `/api/bootstrap` does not expand to include full journal bodies, comment collections, or full destination graphs.
    - Navigating to feed or explore does not trigger destination-detail requests for the entire catalog.
    - Visual polish work does not depend on heavyweight UI libraries or costly realtime effects.

- AC-7: The redesign ships with a coherent visual system that matches the draft's editorial and lifestyle direction and remains responsive.
  - Positive Tests (expected to PASS):
    - The implemented visual language aligns with `docs/journal-social-design-style.md` for palette, typography, spacing, atmosphere, and page-specific mood.
    - Shared CSS tokens define palette, typography, spacing, surface treatments, and motion across all primary views.
    - Desktop and mobile layouts both expose clear entry points to Explore, Map, Feed, and Compose.
    - Motion is limited to low-cost opacity, transform, and blur effects that reinforce view transitions and map emphasis.
  - Negative Tests (expected to FAIL):
    - The landing experience does not regress to the current admin-console-like grid of all tools.
    - The visual system does not rely on high-saturation blue or purple tech styling or heavy autoplay media to signal polish.
    - Styling decisions do not require a large component framework to be maintainable.
---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 3 (Updated: Round 2, verified integrated state)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 0 | Task status reconciled against integrated workspace verification and test pass (`npm test`: 34 passing, 0 failures). | Round 0 implementation completed across backend social services, API/server, SPA routes, and tests. | No scope change; closes planned AC work for Round 0. |
| 1 | Round 0 completion status was corrected after review, and the remaining social pagination/browser-regression work was re-opened for implementation. | Round 0 and Round 1 summaries overstated closure; review found four real gaps spanning invalid over-max limits, post-detail pagination verification, Explore lazy destination-detail verification, and feed fallback viewer-context wiring. | No scope change; re-opened AC-2, AC-4, AC-5, and AC-6 verification work until the missing fixes and tests were complete. |
| 2 | Round 2 completed the remaining browser-regression work from the Round 1 review and aligned tracker status with verified integrated state (`npm test`: 39 passing, 0 failures). | Round 2 added fallback viewer-context propagation in the SPA shell plus deterministic regression coverage for post-detail pagination/reset behavior and Explore lazy destination-detail loading. | No scope change; closes the residual AC-4, AC-5, and AC-6 browser-verification gaps and restores full plan alignment. |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| None | - | complete | All tracked implementation and verification tasks are complete after the Round 2 review. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1, AC-2 | Backend social contracts/services/persistence for likes and comments. | 0 | 0 | `src/services/contracts.ts`, `src/services/journal-service.ts`, `src/services/journal-store.ts`, and `src/services/index.ts` now provide like/comment operations, compact feed summaries, enriched detail views, and persisted social records. |
| AC-2, AC-6 | API and bootstrap/cache refinements for social journal flows and SPA support. | 0 | 0 | `src/server/index.ts` includes `GET /api/feed`, journal like/comment endpoints, comment deletion endpoint, bootstrap usage for selectors, and static-asset cache-control refinement for SPA delivery. |
| AC-3, AC-4 | Routed SPA shell replacing the monolithic one-page browser app. | 0 | 0 | `public/index.html`, `public/app.js`, and `public/spa/app-shell.js` now serve/boot routed views with route parsing/navigation and fallback handling. |
| AC-3, AC-4, AC-6 | Explore/Map migration into dedicated route modules while preserving course tools. | 0 | 0 | `public/spa/views/explore.js` and `public/spa/views/map.js` now own destination search/recommendation, facilities, food, route planning, deep-link hydration, and map-scene caching paths (`public/spa/**`). |
| AC-3, AC-5, AC-7 | Feed, Post Detail, and Compose route flows for summary-first social browsing and interactions. | 0 | 0 | `public/spa/views/feed.js`, `public/spa/views/post-detail.js`, `public/spa/views/compose.js`, plus `public/styles.css` and journal helpers deliver feed summaries, like/unlike/comment actions, detail reads, compose submission, and routed not-found handling. |
| AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | Verification and smoke coverage updates for social API and SPA behavior. | 0 | 0 | Updated tests: `tests/integration-smoke.test.ts`, `tests/journal-consumers.test.ts`, `tests/journal-presentation.test.ts`, and `tests/runtime-services.test.ts`; integrated `npm test` passed with 34 passing and 0 failures. |
| AC-6, AC-7 | Performance and UX polish baseline integrated in routed implementation. | 0 | 0 | `public/spa/app-shell.js` lazy-loads route modules; Explore/Map inputs are debounced (`public/spa/views/explore.js`, `public/spa/views/map.js`); map projections/overlays are cached per destination (`public/spa/map-rendering.js`); shared styling moved into `public/styles.css`. |
| AC-2, AC-6 | Over-max social feed/comment limits reject with the existing error contract and are covered at service/runtime plus HTTP levels. | 1 | 1 | Commit `6f1dbcc`; `src/services/service-helpers.ts`, `tests/runtime-services.test.ts`, and `tests/integration-smoke.test.ts` now reject over-max social pagination limits instead of silently clamping them. |
| AC-3, AC-5 | Feed fallback viewer-context propagation now preserves `viewerUserId` when `/api/feed` is unavailable. | 2 | 2 | `public/spa/app-shell.js` now forwards `viewerUserId` through both the primary `/api/feed` and fallback `/api/journals` branches; deterministic coverage added in `tests/spa-regressions.test.ts`; integrated `npm test` passed with 39 passing and 0 failures. |
| AC-5, AC-6 | Deterministic SPA regression coverage verifies post-detail comment pagination append behavior and reset-after-post behavior. | 2 | 2 | `tests/support/spa-harness.ts`, `tests/spa-regressions.test.ts`, and `tests/index.ts` add no-dependency browser coverage for bounded initial comment requests, load-more append behavior, and first-page reset after comment creation; integrated `npm test` passed with 39 passing and 0 failures. |
| AC-4, AC-6 | Deterministic SPA regression coverage verifies Explore defers destination-detail loading until the facility surface is first touched. | 2 | 2 | `tests/support/spa-harness.ts`, `tests/spa-regressions.test.ts`, and `tests/index.ts` assert Explore boot does not call `ensureDestinationDetails` and that the first facility-surface interaction triggers exactly one destination-detail fetch; integrated `npm test` passed with 39 passing and 0 failures. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|
| None | - | - | - | - |

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| None | - | - | No residual blocking issues remain after the Round 2 review and integrated green test run (`npm test`: 39 passing, 0 failures). |
