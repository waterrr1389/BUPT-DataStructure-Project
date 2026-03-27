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

### Plan Version: 3 (Updated: Round 3 review)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 2 | Reopened verification and bookkeeping work after the Round 2 review found three failing regressions on current HEAD and the mutable tracker still omitted original-plan AC-7. | The Round 2 summary claimed green verification that is not reproducible, so the tracker must carry the reopened work instead of reporting no active tasks. | 1, 2, 3, 4, 5, 7 |
| 3 | Kept the reopened work active after the Round 3 review, but tightened the issue statements to match current HEAD: the browser-build guard still drops diagnostics for `spawnSync`, the cwd regression still over-claims module-load-time proof under the compiled test path, and the docs issue is inconsistent historical-evidence framing rather than a literal current-HEAD green claim. | Current `npm test` still fails the browser-build guard regressions, and the passing cwd test reuses a cached compiled server module instead of re-evaluating after `chdir()`. | 1, 2, 3, 4, 5, 7 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Restore browser-build guard diagnostics so `spawnSync` callers capture the illegal-path banner and every offending `public/*` path, then rerun `npm test`. | 1, 3, 4 | Reopened | Current `npm test` still fails both browser-build guard regressions because the guard path writes to piped `stderr` in a way that leaves captured `stdout` and `stderr` empty for `spawnSync(..., { encoding: "utf8" })`. |
| Replace the cwd regression with a writable, module-load-time proof that loads the built server and runtime helper after `chdir`, then rerun `npm test`. | 2, 3 | Reopened | The source test now uses `/tmp` and passes, but under `npm test` the compiled test file already loads `dist/src/server/index.js` at file load, so the later `require()` after `chdir()` reuses a cached module instead of proving module-load-time cwd independence. |
| Reconcile docs and mutable bookkeeping with the real current state: keep the positive runtime-output/static-copy/vendor-exception docs, clean up inconsistent historical verification wording, and carry original-plan AC-7 explicitly until each batch has acceptance evidence. | 5, 7 | Reopened | The product docs align on `dist/public` and `public/vendor/**`, but the recorded March 19 evidence is still framed inconsistently across the docs set, and the immutable tracker still omits AC-7 from the original plan. |

#### AC-7 Batch Evidence Status
| Batch | Acceptance Command Or Check | Current Evidence | Status | Notes |
|------|------------------------------|------------------|--------|-------|
| Browser output directory switch | `npm run build`; inspect `dist/public/app.js` and `dist/public/spa/app-shell.js` | Completed rows for the `dist/public` output switch remain accurate. | Tracked | No new blocker was found in this review. |
| Server static directory switch | Check server static root against runtime output and keep `/` fallback aligned | Completed server-static-root evidence remains accurate. | Tracked | The remaining gap is the dedicated cwd regression proof, not the static-root implementation itself. |
| Test baseline switch | `npm test`; inspect integration smoke, SPA harness, and helper contract tests | Runtime-output contract coverage is present, and the cwd regression was updated to use `/tmp`. | Reopened | The compiled test path preloads the server module before `chdir()`, so the reopened cwd proof is still incomplete. |
| First-party JS removal and guard | `git ls-files 'public/*.js' 'public/spa/**/*.js'`; `npm test` | `git ls-files` still returns only `public/vendor/leaflet/leaflet.js`. | Reopened | The guard diagnostics are still not captured by `spawnSync`, so the regression tests stay red. |
| Docs update | Review README and delivery docs for `dist/public`, static-copy behavior, and `public/vendor/**` exception wording | Main product docs describe the runtime-output model and third-party exception correctly. | Reopened | Verification-language cleanup is still needed before the docs/bookkeeping batch can close. |

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

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| Browser-build guard failures are not emitted in a way that `spawnSync(..., { encoding: "utf8" })` captures, leaving the new illegal-`public/*.js` regression tests red. | 2 | 1, 3, 4 | Route all build-failure diagnostics through a synchronous stderr path, then rerun the injected-illegal-file repro plus `npm test`. |
| The cwd regression now uses `/tmp`, but under the compiled `npm test` path the test file already imports `dist/src/server/index.js` before `chdir()`, so the later `require()` reuses a cached module and does not prove module-load-time cwd independence. | 2 | 2, 3 | Run the cwd proof in a fresh child process or otherwise guarantee the compiled server module is first loaded only after `chdir()`, then rerun the targeted regression and `npm test`. |
| Mutable tracking still omits original-plan AC-7 in the immutable section, and the docs still frame the recorded March 19 verification history inconsistently across the delivery set. | 2 | 5, 7 | Keep AC-7 explicit in mutable tracking, add batch-by-batch acceptance evidence, and only re-close the docs/bookkeeping work after the verification language matches the real rerun state. |
