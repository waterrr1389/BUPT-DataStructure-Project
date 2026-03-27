# Round 4 Summary

## Goal
Capture the fd-level guard diagnostics, the child-process `cwd` proof, and the updated verification narrative so reviewers know what landed on the current HEAD, what was reverified, and which tracker updates remain.

## Implementation Highlights
- `scripts/browser-build.js` now flushes guard and `tsc` diagnostics synchronously through the helper that writes to the relevant file descriptors before throwing, so every `spawnSync` caller observes the guard banner plus every unexpected `public/` path before the build exits with failure.
- `tests/support/built-server-cwd-proof.ts` chdirs outside the repo, requires the built `dist/src/server/index.js` + `dist/src/services/index.js`, and asserts that `/` and `/app.js` still serve the compiled assets with the expected headers, proving the built handler is resilient to fresh child-process cwd changes.
- Delivery docs now highlight that the March 27 rerun of `npm test` provides the latest verification evidence and explicitly differentiate that the March 19 recorded command runs, including `npm run demo`, remain the historical reference. `docs/requirements-analysis.md` in particular splits FR-2 and FR-3 evidence so the selector-parity/disambiguation statements link to the rerun while the foundational search and routing facts stay tied to the March 19 run.

## Verification Conclusions
- `npm test` passes 144 tests (itself running `npm run build` and `node dist/tests/index.js`), confirming the new guard diagnostics, built handler proof, and the full automated suite are green on this HEAD.
-- `git status --short --branch` reports `## main...origin/main [ahead 36]` with only `.humanize/rlcr/2026-03-27_12-31-07/goal-tracker.md` modified after these docs and summary edits landed, so the workspace is otherwise clean once the tracker entry is accepted.
- Direct guard repro: created a `public/.browser-build-guard-repro-*` folder containing `illegal-first-party.js` and ran `node scripts/browser-build.js`; `spawnSync` exits with status `1` and stderr begins with the guard banner while listing the injected `public/.../illegal-first-party.js` path, demonstrating the diagnostic output is now steady.
- `git ls-files 'public/*.js' 'public/spa/**/*.js' 'public/vendor/**/*.js'` returns just `public/vendor/leaflet/leaflet.js`, showing no first-party runtime `.js` files live under `public/`.
- `docs/evaluation-and-improvements.md` now notes: “Verification: this round (March 27, 2026) reran `npm test` (which itself performs `npm run build`) and passed on the current HEAD; the March 19 recorded runs continue to document `npm run validate:data`, `npm run benchmark`, and `npm run demo`, while the March 18 unrestricted-environment checks remain the historical record that browser/API startup worked on `127.0.0.1:3000`,” so the docs match the current-versus-historical verification framing described in this summary.

## Residual Risks
- Any future guard path that throws before calling the helper must still write the banner and illegal paths to stderr so spawnSync callers observe the evidence.
- The built-handler proof relies on `dist/src/server/index.js` and `dist/src/services/index.js` remaining intact with the same exports; if the build layout shifts, the proof must be updated to reference the new artifacts.
- The docs explicitly treat the March 19 recorded runs and the March 18 unrestricted startup as historical, so reviewers must rerun those commands before claiming them as fresh verification evidence again.

## Goal Tracker Update Request

### Requested Changes
- Note in the tracker that Round 4 delivered the fd-level guard diagnostic rewrite, the `tests/support/built-server-cwd-proof.ts` child-process `cwd` statement, and the docs updates that place March 27 verification on the current HEAD while March 19/18 entries stay historical.
- Capture the verification evidence that `npm test` (144 tests) succeeded on this HEAD, that the guard repro exits with status `1` while listing the injected `public/.../illegal-first-party.js`, and that `public/vendor/leaflet/leaflet.js` is the only runtime `.js` tracked under `public/`.
- Keep the tracker entry open until reviewers accept the summary and documentation alignment; the goal-tracker file is the only uncommitted change, so updating it here keeps the workspace tidy.

### Justification
- The reviews reopened because guard diagnostics, the built handler `cwd` proof, and the docs narrative needed definitive current-HEAD evidence; those artifacts now exist and should be recorded explicitly in the tracker.
- Only `.humanize/rlcr/2026-03-27_12-31-07/goal-tracker.md` remains modified, so noting these outcomes there avoids any unstaged drift while the round-4 summary sits ready to land.
