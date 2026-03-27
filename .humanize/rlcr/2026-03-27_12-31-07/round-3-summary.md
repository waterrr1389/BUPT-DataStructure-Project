# Round 3 Summary

## Goal
Record how the reopened guard diagnostics, cwd regression proof, and AC-5 documentation gaps received concrete evidence on the current HEAD and what still needs tracking.

## Implementation Highlights
- `scripts/browser-build.js` now synchronously writes all guard and `tsc` diagnostics before throwing, and `tests/browser-build-guard.test.ts` asserts that `stderr` holds the guard banner and every illegal `public/*.js` path so `spawnSync` callers can observe the failure evidence.
- `tests/integration-smoke.test.ts` now `chdir()`s into a temporary `/tmp` folder, requires the built `dist/src/server/index.js`/`dist/src/services/index.js` modules after that switch, and asserts `GET /` and `GET /app.js` return the built `dist/public` assets with the expected MIME/cache headers so the regression proves cwd independence of the handler.
- Documentation now spells out the runtime-output/exception story and the verification history: `README.md`, `docs/module-design.md`, and `docs/task-description.md` state first-party JavaScript lives only in `public/` TypeScript sources and its `dist/public` build output, while `docs/evaluation-and-improvements.md`, `docs/example-results-and-tests.md`, `docs/requirements-analysis.md`, and `docs/user-guide.md` mark the March 19 recorded command runs and keep the March 18 unrestricted startup record clearly historical.

## Verification Conclusions
- `npm test` (runs `npm run build` and `node dist/tests/index.js`) — passes all 144 tests including the guard and cwd regressions, showing the new diagnostics, built-server behavior, and broader suites are green on this HEAD.
- `git status --short --branch` — shows `## main...origin/main [ahead 29]` with only the immutable goal tracker modified, so no other files were touched this round.
- `rg -n "first-party browser runtime" README.md docs/module-design.md docs/task-description.md` — finds the new statements that first-party runtime `.js` are emitted to `dist/public/`, `public/vendor/**` is the third-party exception, and the docs describe the copy strategy, satisfying the AC-5 evidence requirement.

## Residual Risks
- The new diagnostics path relies on `reportDiagnostics` being invoked everywhere we flag `public/` violations; any future guard that throws before calling `fail` must also use the helper so `spawnSync` keeps receiving stderr output.
- The cwd regression now depends on building `dist/src/server/index.js` before the test loads the handler; if the build output ever moves or splits, the test needs to be updated to rehydrate the handler after the chdir guard.
- The docs now distinguish recorded March 19 evidence from the historical March 18 startup, so reviewers must be careful not to treat the historical unrestricted run as fresh validation once the tracker finally records the new commands.

## Goal Tracker Update Request

### Requested Changes
- Re-open the active work items related to the guard diagnostics capture and the cwd regression so the tracker reflects the current state, noting that `scripts/browser-build.js`, `tests/browser-build-guard.test.ts`, and `tests/integration-smoke.test.ts` now carry the concrete assertions described above.
- Add recorded evidence under the AC-5/verification section that references the README/module-design/task-description wording and the notarized March 19 command runs, making it clear that the runtime-output/static-copy/third-party-exception story is documented and the `npm test` suite now passes.
- Leave AC-7 in the active/in-progress section rather than marking it complete, but record that these new artifacts exist so the next pass can close AC-7 once the independent batches have their acceptance checks documented.

### Justification
- The reviews reopened because `spawnSync` callers and the cwd regression lacked direct evidence; the changes above show that every failure funnels through stderr and the built handler still serves `/` and `/app.js` after a `chdir()` outside the repo.
- The documentation proof for AC-5 now lives in the main product docs and explicitly states the runtime-output behavior, copying strategy, and third-party exceptions, matching what the acceptance criteria demand.
- AC-7 is still mutable-only this round, so we cannot mark it complete until every original batch has independent provenance recorded, but the tracker should list these revived items so whoever next updates it understands the new evidence set.
