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
Evolve the repo to a pure TypeScript model by removing committed first-party browser JS from the source tree, moving runtime outputs to a dedicated dist/public directory, and keeping build, server, tests, and docs aligned with stable public URLs and documented exceptions.

Source plan: plan.md

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->

1. First-party browser runtime JS is no longer committed under the source tree public paths, and every first-party browser asset maps to a TypeScript source plus a runtime output location.
2. The runtime output directory is dist/public (or an equivalent dist subdirectory), public URLs remain unchanged, and the server serves static assets from the runtime output directory instead of public/.
3. Automated tests validate the runtime output directory contract, including SPA entry, helper globals/CommonJS compatibility, and dynamic import resolution, and fail when outputs or static root are broken.
4. The build pipeline produces a complete runtime output directory without manual steps, with clear separation between browser build, static copy, and server build, and recoverable behavior on failure.
5. Documentation states the meaning of “pure TypeScript,” the runtime output directory, the stable public URLs, and the explicit third-party JS exceptions.
6. Newly touched first-party reusable functions and public contracts retain concise English JSDoc and avoid process-style comments.

---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 4 (Updated: Round 4 review)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 2 | Reopened verification and bookkeeping work after the Round 2 review found three failing regressions on current HEAD and the mutable tracker still omitted original-plan AC-7. | The Round 2 summary claimed green verification that is not reproducible, so the tracker must carry the reopened work instead of reporting no active tasks. | 1, 2, 3, 4, 5, 7 |
| 3 | Kept the reopened work active after the Round 3 review, but tightened the issue statements to match current HEAD: the browser-build guard still drops diagnostics for `spawnSync`, the cwd regression still over-claims module-load-time proof under the compiled test path, and the docs issue is inconsistent historical-evidence framing rather than a literal current-HEAD green claim. | Current `npm test` still fails the browser-build guard regressions, and the passing cwd test reuses a cached compiled server module instead of re-evaluating after `chdir()`. | 1, 2, 3, 4, 5, 7 |
| 4 | Closed the reopened guard-diagnostics and child-process cwd-proof work after fresh current-HEAD verification, but kept the docs/bookkeeping batch open for one remaining verification-attribution mismatch. | Round 4 now verifies `npm test` at 144 passing tests, the direct `spawnSync` guard repro emits the banner plus injected `public/.../illegal-first-party.js`, and the built-server child-process proof exits successfully after `chdir()`. `docs/requirements-analysis.md` and `round-4-summary.md` still need one more wording pass to keep the review artifacts fully aligned with that state. | 1, 2, 3, 4, 5, 7 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Reconcile `docs/requirements-analysis.md`, `round-4-summary.md`, and the mutable bookkeeping with the verified current state. | 5, 7 | Narrowed | The guard diagnostics, child-process cwd proof, and `npm test` rerun are now verified on current HEAD, but `docs/requirements-analysis.md` still mixes March 27 rerun-backed automated-test evidence into March 19 historical notes, and `round-4-summary.md` still reports the earlier ahead-count / modified-tracker workspace state instead of the current clean tree. Keep AC-7 explicit in mutable tracking because the immutable section cannot be edited. |

#### AC-7 Batch Evidence Status
| Batch | Acceptance Command Or Check | Current Evidence | Status | Notes |
|------|------------------------------|------------------|--------|-------|
| Browser output directory switch | `npm run build`; inspect `dist/public/app.js` and `dist/public/spa/app-shell.js` | Round 4 reran `npm test`, which itself runs `npm run build`, and the runtime-output contract remained green on current HEAD. | Verified | `dist/public` remains the only served runtime tree, and the rerun preserved the stable `/app.js` and `/spa/app-shell.js` outputs. |
| Server static directory switch | Check server static root against runtime output and keep `/` fallback aligned | The child-process cwd proof and the integration smoke suite both confirm that the built handler still serves `/` and `/app.js` from `dist/public` after `chdir()`. | Verified | The reopened cwd-proof gap is closed by `tests/support/built-server-cwd-proof.ts` plus the green Round 4 `npm test` rerun. |
| Test baseline switch | `npm test`; inspect integration smoke, SPA harness, and helper contract tests | `npm test` passed with 144 tests on March 27, 2026, including the browser guard regressions, runtime-output contract checks, helper/global/CommonJS coverage, and the child-process cwd proof. | Verified | The suite now re-closes the previously reopened browser-build and cwd regressions on current HEAD. |
| First-party JS removal and guard | `git ls-files 'public/*.js' 'public/spa/**/*.js'`; `npm test` | `git ls-files` still returns only `public/vendor/leaflet/leaflet.js`, and the direct `spawnSync` guard repro exits 1 with stderr starting at the banner while listing the injected illegal `public/.../illegal-first-party.js`. | Verified | The fd-level diagnostics fix makes the guard evidence observable to piped `spawnSync` callers again. |
| Docs update | Review README and delivery docs for `dist/public`, static-copy behavior, and `public/vendor/**` exception wording | README and the main delivery docs distinguish the March 27 current-HEAD rerun from the March 19 and March 18 historical records, but one verification-attribution mismatch remains in `docs/requirements-analysis.md`. | Reopened | Keep this batch open until `docs/requirements-analysis.md` and `round-4-summary.md` fully match the verified current-HEAD wording. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| 2 | Define dist/public as the only runtime output directory and route browser build output there while preserving public URLs. | 0 | 0 | Commits 2593f7a, cce1cdd; runtime path checks updated in code/docs alignment. |
| 2 | Switch server static root to the runtime output directory and keep index fallback consistent. | 0 | 0 | Commit c862c23. |
| 3 | Update tests and harnesses to load assets from the runtime output directory and assert helper/global/CommonJS contracts. | 0 | 0 | Commits 9bf2524, a505c74; npm test passed. |
| 4 | Split build responsibilities for browser output and static copy; ensure build is repeatable and recoverable. | 0 | 0 | Commits 2593f7a, cce1cdd; npm test passed. |
| 1 | Remove first-party committed browser JS from public/ and add safeguards to prevent reintroduction. | 0 | 0 | Commits 2593f7a, cce1cdd; `git ls-files 'public/*.js' 'public/spa/**/*.js'` returns only `public/vendor/leaflet/leaflet.js`. |
| 5 | Update docs to describe pure TypeScript meaning, runtime output directory, stable URLs, and exceptions. | 0 | 0 | Commits c8b1b26, d95b890, e412634, d45260f; docs and runtime path checks were updated. |
| 6 | Audit new or moved first-party public contracts for concise English JSDoc. | 0 | 0 | Reviewed touched code/comments for English-only and process-comment discipline; no new production public contract exports were introduced. |
| 1, 3, 4 | Restore browser-build guard diagnostics so `spawnSync` callers capture the banner and every offending `public/*` path, then reverify the guard on current HEAD. | 4 | 4 | March 27, 2026 `npm test` passed 144 tests; the direct `spawnSync` repro exits `1` with stderr beginning at the guard banner while listing the injected `public/.../illegal-first-party.js`; `git ls-files 'public/*.js' 'public/spa/**/*.js' 'public/vendor/**/*.js'` still returns only `public/vendor/leaflet/leaflet.js`. |
| 2, 3 | Replace the cwd regression with a child-process proof that loads the built server after `chdir()` and reverify the runtime-output contract. | 4 | 4 | `tests/support/built-server-cwd-proof.ts` changes cwd to `/tmp/...`, then requires `dist/src/server/index.js` plus `dist/src/services/index.js`; `node dist/tests/support/built-server-cwd-proof.js` exits `0`; March 27, 2026 `npm test` passed 144 tests. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| `docs/requirements-analysis.md` still mixes March 27 rerun-backed automated-test evidence into March 19 historical evidence notes, and `round-4-summary.md` still reports the earlier ahead-count / modified-tracker workspace state instead of the current clean tree. | 4 | 5, 7 | Reword the FR-2 / FR-3 evidence labels and refresh the Round 4 summary's repo-state note, then rerun the doc/bookkeeping consistency check. |
| The immutable tracker still omits original-plan AC-7 and cannot be edited under the RLCR rules. | 2 | 7 | Keep AC-7 explicit in mutable tracking via the batch-evidence table plus active/completed task mapping. |
