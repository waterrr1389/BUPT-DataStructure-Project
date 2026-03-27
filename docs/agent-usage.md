# Agent Usage

## Stable Recording Policy

- This file records the stable historical RLCR workspace that the current repository docs depend on; it is not a complete inventory of every workspace under `.humanize/rlcr/`.
- Active loops are intentionally excluded until they finish or stop, because current-round artifact inventories change as soon as review results land.
- Cancelled or superseded workspaces such as `.humanize/rlcr/2026-03-18_20-24-46/` remain available in `.humanize/rlcr/` for auditability, but are omitted here unless they materially affect the project-facing documentation trail.
- The stable historical record below covers `.humanize/rlcr/2026-03-18_14-02-34/`, the loop that stopped after the Round 9 review identified a repeated current-round artifact drift.

## Historical RLCR Environment

- Repository root: `/home/frisk/ds-ts`
- RLCR skill: `/home/frisk/.codex/skills/humanize-rlcr/SKILL.md`
- RLCR runtime root: `/home/frisk/.codex/skills/humanize`
- Recorded RLCR workspace: `.humanize/rlcr/2026-03-18_14-02-34/`
- Outcome: stopped after the Round 9 review because the agent-usage record kept lagging the live artifact set
- Shell: `bash`
- Date context: `2026-03-18`
- Timezone context: `Asia/Shanghai`
- Filesystem mode during that loop: `workspace-write`
- Network access during that loop: restricted
- Approval policy during that loop: `never`
- Project toolchain: npm scripts run using the globally provided `node` runtime alongside the repository-installed `tsc`, while `leaflet` (runtime) and TypeScript tooling (`@types/leaflet`, `typescript`) are managed through the repository's npm dependencies.

## Historical RLCR Artifacts

- [goal-tracker.md](../.humanize/rlcr/2026-03-18_14-02-34/goal-tracker.md)
- [round-0-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-0-prompt.md)
- [round-0-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-0-review-prompt.md)
- [round-0-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-0-review-result.md)
- [round-0-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-0-summary.md)
- [round-1-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-1-prompt.md)
- [round-1-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-1-review-prompt.md)
- [round-1-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-1-review-result.md)
- [round-1-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-1-summary.md)
- [round-2-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-2-prompt.md)
- [round-2-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-2-review-prompt.md)
- [round-2-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-2-review-result.md)
- [round-2-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-2-summary.md)
- [round-3-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-3-prompt.md)
- [round-3-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-3-review-prompt.md)
- [round-3-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-3-review-result.md)
- [round-3-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-3-summary.md)
- [round-4-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-4-prompt.md)
- [round-4-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-4-review-prompt.md)
- [round-4-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-4-review-result.md)
- [round-4-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-4-summary.md)
- [round-5-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-5-prompt.md)
- [round-5-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-5-review-prompt.md)
- [round-5-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-5-review-result.md)
- [round-5-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-5-summary.md)
- [round-6-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-6-prompt.md)
- [round-6-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-6-review-prompt.md)
- [round-6-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-6-review-result.md)
- [round-6-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-6-summary.md)
- [round-7-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-7-prompt.md)
- [round-7-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-7-review-prompt.md)
- [round-7-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-7-review-result.md)
- [round-7-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-7-summary.md)
- [round-8-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-8-prompt.md)
- [round-8-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-8-review-prompt.md)
- [round-8-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-8-review-result.md)
- [round-8-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-8-summary.md)
- [round-9-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-9-prompt.md)
- [round-9-review-prompt.md](../.humanize/rlcr/2026-03-18_14-02-34/round-9-review-prompt.md)
- [round-9-review-result.md](../.humanize/rlcr/2026-03-18_14-02-34/round-9-review-result.md)
- [round-9-summary.md](../.humanize/rlcr/2026-03-18_14-02-34/round-9-summary.md)
- [stop-state.md](../.humanize/rlcr/2026-03-18_14-02-34/stop-state.md)

## Round History

### Round 0

- Established the RLCR goal tracker and initial repository delivery surface.
- Added the zero-dependency TypeScript command contract, source layout, docs, scripts, server, and first-pass tests.
- Later review confirmed that Round 0 implemented substantial code but overstated completion.

### Round 1

- Switched runtime verification to the real seed and external algorithm bundle.
- Expanded tests to cover runtime wiring, invalid `sortBy`, typo-tolerant food search, indoor routing, nearby facilities, and deterministic demo behavior.
- Updated the demo to run against `createAppServices()` and the real dataset.
- Left compression-surface, doc-alignment, and startup-error-handling follow-ups for the next pass until the code-side fixes were completed.

### Round 2

- Code-side Round 2 fixes were already present in the shared workspace before this documentation pass.
- Worker C owned documentation and summary alignment only:
  - rewrote `README.md` and the owned delivery docs to remove planning-era wording,
  - updated counts, test totals, startup behavior, and exchange metrics,
  - recorded route-strategy, indoor-routing, food-discovery, and innovation evidence,
  - added this round's summary artifact and goal-tracker update request.

### Round 3

- Round 3 landed the browser route-visualization surface and the last in-repository AC-6 wording fixes.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-3-prompt.md`
  - `round-3-review-prompt.md`
  - `round-3-review-result.md`
  - `round-3-summary.md`
- The Round 3 summary records the route-map UI work and the wording-alignment follow-up, while the Round 3 review keeps the closed-loop marker regression and missing visualization-level tests open.

### Round 4

- Round 4 landed the closed-loop route-marker fix and direct regression coverage for browser marker placement.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-4-prompt.md`
  - `round-4-review-prompt.md`
  - `round-4-review-result.md`
  - `round-4-summary.md`
- The Round 4 summary records the extracted browser marker helper and the 20-test suite, while the Round 4 review re-opened AC-6 evidence alignment because the delivery docs and agent-usage record still lagged the repository state.

### Round 5

- Round 5 was a docs-only evidence-alignment pass that refreshed the delivery evidence sections to the 20-test repository state and extended this record through Round 4.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-5-prompt.md`
  - `round-5-review-prompt.md`
  - `round-5-review-result.md`
  - `round-5-summary.md`
- The Round 5 summary records the docs-alignment pass, while the Round 5 review kept live-bind verification open and narrowed the remaining AC-6 gap to this file's missing current-round artifact/history entry.

### Round 6

- Round 6 refreshed the delivery evidence to include unrestricted-environment live-start plus browser/API smoke verification, then recorded the follow-up review artifacts that kept the remaining AC-6 docs-alignment task open.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-6-prompt.md`
  - `round-6-review-prompt.md`
  - `round-6-review-result.md`
  - `round-6-summary.md`
- The Round 6 summary records the successful `127.0.0.1:3000` bind evidence, the live browser/API smoke pass, and the tracker-update request that closed AC-5 while leaving one final AC-6 docs-consistency pass for Round 7.

### Round 7

- Round 7 aligned the remaining delivery docs with the March 18 unrestricted-environment verification state after the Round 6 review narrowed AC-6 to documentation consistency only.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-7-prompt.md`
  - `round-7-review-prompt.md`
  - `round-7-review-result.md`
  - `round-7-summary.md`
- The Round 7 summary records the final docs-alignment closure request, while the Round 7 review kept AC-6 open only because this file still lagged the current RLCR workspace by one round.

### Round 8

- Round 8 completed the current-round agent-usage catch-up for the prompt/summary path, then the Round 8 review narrowed the remaining AC-6 gap to the still-missing Round 8 review artifacts.
- Artifact record for this round now exists in the RLCR workspace:
  - `round-8-prompt.md`
  - `round-8-review-prompt.md`
  - `round-8-review-result.md`
  - `round-8-summary.md`
- The Round 8 summary records the final AC-6 closure request from that pass, while the Round 8 review kept the docs gap open only because this file still omitted the current-round review artifacts.

### Round 9

- Round 9 refreshed the agent-usage environment block and tried to close the remaining AC-6 documentation gap without changing product code.
- Artifact record for this round exists in the RLCR workspace:
  - `round-9-prompt.md`
  - `round-9-review-prompt.md`
  - `round-9-review-result.md`
  - `round-9-summary.md`
- The Round 9 summary requested AC-6 closure, but the Round 9 review rejected that request because the file was still using a current-round recording model. `round-9-review-result.md` records the repeated Round 7/8/9 artifact-drift problem and the need for a stable completed/stopped-round strategy, while `stop-state.md` records the stop metadata for the terminated loop.

## Stop Outcome

- `round-9-review-result.md` records that the loop hit a documentation-process circuit breaker after Round 7, Round 8, and Round 9 repeated the same current-round artifact problem.
- `stop-state.md` records only the stop metadata for that terminated loop.
- The remaining cleanup after that stop was documentation-process alignment only; the stopped review did not identify a new product-code regression.

## AI Assistance Record

- Workflow: RLCR review loop with repository-local artifacts under `.humanize/rlcr/2026-03-18_14-02-34/`
- Recorded scope in this file: completed or stopped RLCR history only
- Skill used for this repository: `humanize-rlcr`
- External services: none
- Network usage: local loopback live-start and browser/API smoke verification during completed historical rounds
- Main AI-assisted areas:
  - architecture and repository bootstrapping,
  - algorithm and service implementation review,
  - test and demo expansion,
  - documentation and summary alignment
