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

Implement one bounded SPA convergence pass that fixes the remaining actor-propagation and error-taxonomy issues exposed in the cancelled RLCR review, without restarting RLCR or rewriting the router. The implementation should treat `actor` as first-class route state across Explore, Map, Post Detail, and shell hand-offs, distinguish missing social endpoints from real request failures, and lock the result down with deterministic regressions in the existing SPA harness.

For this plan, the draft's quantitative references such as `59 passing` are treated as historical evidence, not hard acceptance thresholds. The only hard verification metric is that the current branch's test suite passes after the scoped refactor.

Language has been unified to English for repository-plan consistency.
Repository documentation must remain consistent with the implemented behavior and verified evidence after the scoped change set.

## Acceptance Criteria

<!-- Each criterion must be independently verifiable -->
Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: Shared route-context helpers provide one authoritative way to build actor-aware SPA URLs without pulling DOM or network concerns into the helper layer.
  - Positive Tests (expected to PASS):
    - A helper in `public/spa/lib.js` or a very small adjacent SPA-only module can build URLs such as `/map?destinationId=dest-1&actor=user-2`, `/compose?actor=user-2&destinationId=dest-1`, and `/feed?actor=user-2` from route or actor input.
    - `public/spa/app-shell.js` keeps `buildMapHref()` and `buildPostHref()` as app-facing entry points, but routes shared query assembly through the new helper.
    - Touched views no longer hard-code actor-bearing route strings when a shared helper or shell wrapper is available.
  - Negative Tests (expected to FAIL):
    - Blank or missing `actor` values do not produce `actor=` in generated URLs.
    - Helper code does not mutate route state, touch the DOM, or perform `fetch` calls.

- AC-2: The Round 14 Explore and Map regressions stop dropping actor context during both initial render and client-side URL rewrites.
  - Positive Tests (expected to PASS):
    - Rendering Explore with `route.params.actor = "user-2"` produces featured destination cards whose map and compose hand-off links retain `actor=user-2`.
    - Rendering Explore with `route.params.actor = "user-2"` and then replacing the featured deck with search or recommendation results still produces actor-preserving destination links.
    - Rendering Map with `/map?destinationId=dest-1&actor=user-2` and changing route controls causes `navigate(..., { render: false })` to keep `actor=user-2` in every rewritten URL.
    - The Map fallback redirect for a missing destination and the "Return to Explore" link preserve actor when actor exists.
  - Negative Tests (expected to FAIL):
    - When the incoming route has no actor, the generated Explore and Map links remain clean instead of inventing a default actor query param.
    - Existing stale-response protections in Explore and Map continue rejecting outdated destination-detail responses after the refactor.

- AC-3: Post Detail no longer diverges from the shared actor-propagation rules on nearby route hand-offs.
  - Positive Tests (expected to PASS):
    - `Open destination in map` preserves the active actor.
    - Compose links in Post Detail continue preserving actor while using the shared route-context rules instead of bespoke duplication where feasible.
    - Delete success redirects return to `/feed?actor=...` when an actor is active.
    - Actor changes in Post Detail still update the current route with `render: false` navigation and refresh visible detail state.
  - Negative Tests (expected to FAIL):
    - The convergence patch does not regress existing Feed and shell behaviors that already preserve actor context.
    - The solution does not require a router rewrite, a new global state manager, or a view-by-view copy of URL-building logic.

- AC-4: Social endpoint error taxonomy distinguishes missing capabilities from real request failures.
  - Positive Tests (expected to PASS):
    - `fetchJournalComments()` in `public/spa/app-shell.js` returns `{ available: false, ... }` only for genuine missing-endpoint conditions such as `404` or an `"Unknown API endpoint"` response.
    - When the comments endpoint is genuinely missing, Post Detail keeps the intentional degraded behavior: unavailable empty state, disabled comment form, and explanatory notice.
    - Existing Feed fallback behavior for a genuinely missing `/api/feed` endpoint remains unchanged.
  - Negative Tests (expected to FAIL):
    - `400`, `500`, and other non-missing comment failures reject with `Error` instead of being converted into `"Comments unavailable"`.
    - Real comment-fetch failures no longer silently clear the thread or disable posting as though the capability were absent.

- AC-5: Deterministic regression coverage proves the scoped refactor and verification ends with a green current-branch test run.
  - Positive Tests (expected to PASS):
    - `tests/spa-regressions.test.ts` gains deterministic regressions for Map URL rewrite actor preservation, Explore destination-card actor preservation, and comment error taxonomy.
    - Test fixtures that currently serialize only `destinationId` are upgraded so assertions can cover arbitrary query params such as `actor`.
    - The `AppShellModule` test type is extended as needed so the comments API can be exercised directly.
    - `npm test` passes on the final branch state.
  - Negative Tests (expected to FAIL):
    - Acceptance is not tied to restoring the historical `59 passing` snapshot; current green tests are the only hard bar.
    - No plan-complete state is accepted if the new actor-propagation and error-taxonomy paths are left without deterministic regression coverage.

- AC-6: Repository documentation and code readability rules stay aligned with the implemented outcome.
  - Positive Tests (expected to PASS):
    - If the scoped SPA changes invalidate any checked-in documentation claims, the affected repository docs are updated in the same change set.
    - Verification-oriented docs do not claim stale evidence once the implementation or test surface has materially changed.
    - New code comments are added only where a short explanation materially reduces maintenance risk, such as missing-endpoint taxonomy or stale-response guards.
  - Negative Tests (expected to FAIL):
    - Documentation is not left claiming behavior that the new implementation no longer provides.
    - The refactor does not add broad explanatory comments to otherwise self-descriptive code.

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 1 (Updated: Round 0 execution-state sync)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 0 | Realigned active-task statuses so implemented shared-helper/app-shell and comments-taxonomy work stay active as review-pending items, while Explore, Map, and Post Detail hand-off execution moves to `in_progress`. | The tracker needed to reflect actual execution state without overstating unreviewed implementation as verified completion. | AC-1, AC-2, AC-3, AC-4 |
| 0 | Synced the tracker to the pre-regression handoff: Explore, Map, and Post Detail implementation moved to `pending-review`, regression coverage/verification moved to `in_progress`, and docs audit remained `pending` as a separate follow-up. | Implementation work for the route hand-offs is complete and awaiting team-leader/test verification, while a test worker is now starting the regression pass and docs should not be marked active yet. | AC-2, AC-3, AC-5, AC-6 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Add the shared actor-aware route-context helper and route `buildMapHref()` / `buildPostHref()` through it without introducing DOM or fetch behavior. | AC-1 | pending-review | Implementation is already landed in worker-owned code, but team-leader review has not yet verified the shared helper/app-shell convergence. |
| Correct `fetchJournalComments()` missing-endpoint classification so only genuine missing capabilities degrade to `{ available: false }`. | AC-4 | pending-review | Implementation is already landed in worker-owned code, but team-leader review has not yet verified the comments taxonomy behavior. |
| Update Explore destination-card hand-offs for featured, search, and recommendation flows to preserve actor through the shared helper rules. | AC-2 | pending-review | Implementation is landed and awaiting team-leader/test verification for the Explore hand-off paths that now consume the shared helper behavior. |
| Update Map query rewrites, missing-destination fallback navigation, and the return-to-Explore link to preserve actor on every `render: false` route update. | AC-2 | pending-review | Implementation is landed and awaiting team-leader/test verification for Map URL rewrites and fallback preservation. |
| Align Post Detail map, compose, and delete-return links with the shared route-context rules while preserving current `render: false` actor updates. | AC-3 | pending-review | Implementation is landed and awaiting team-leader/test verification for the Post Detail hand-offs while keeping the existing `render: false` actor update flow intact. |
| Extend SPA regression fixtures and `AppShellModule` typing so tests can assert arbitrary query params and exercise the comments API directly. | AC-5 | pending | Should land before or alongside the first new regression that needs actor-aware query serialization. |
| Add deterministic regressions for actor preservation and comment error taxonomy, then run `npm test` for current-branch verification. | AC-5 | in_progress | A test worker is starting the regression/verification pass now that the implementation hand-offs are ready for coverage. |
| Audit affected docs and update repository claims only if the implemented behavior changed checked-in documentation. | AC-6 | pending | Leave docs work pending until regression evidence is available or a checked-in claim clearly needs adjustment. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
