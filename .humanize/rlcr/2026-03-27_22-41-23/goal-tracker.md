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
Bring high-value English comments to the project's hardest-to-read first-party code and realign the `docs/` corpus with the current repository structure, terminology, scope boundaries, and history markers without changing behavior.

Source plan: plan.md

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->

1. Complex files in `src/algorithms/**` include minimal English comments or JSDoc that explain invariants, ranking logic, fallback rules, or hidden constraints rather than restating code.
2. Complex files in `src/services/**` and `src/server/index.ts` include minimal English comments or JSDoc for orchestration, runtime assumptions, and fallback or boundary behavior without changing execution logic.
3. Core design and requirements documents use consistent terminology, module descriptions, paths, commands, and current capability statements across the main `docs/*.md` design and requirements set.
4. User-facing and reference documents describe the current repository layout, commands, outputs, and usage flow without stale or contradictory statements.
5. World, history, and process documents explicitly mark their own scope and time context so they cannot be mistaken for current product behavior.
6. The full comment and documentation pass remains behavior-neutral and is validated by existing checks plus targeted repository searches for terminology, path, and boundary consistency.

---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 4 (Updated: Round 2 Review)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initialized goal, acceptance criteria, and workstreams from `plan.md` | Establish a stable execution anchor before parallel work begins | Defined AC1-AC6 |
| 0 | Synchronized tracker state with integrated Round 0 outcomes and local verification evidence | Close out launched workstreams after merge to `main` without changing the plan | No AC change |
| 1 | Added supplemental original-plan coverage matrices plus the missing Round 1 verification and reference-check evidence in the mutable section | The Round 0 immutable AC extraction was lossy, and the mutable tracker omitted Milestone 1 inventory coverage, the auxiliary reference-check closure, and the full Round 1 verification record | No immutable AC change; restores traceability for the original `plan.md` scope |
| 1 review | Reopened the remaining core-doc closeout work for two documentation-precision gaps | Review confirmed that `docs/requirements-analysis.md` still over-broadly attributes March 27 evidence and `docs/module-design.md` still omits the first-party browser asset tree from the module inventory | AC-2 and Milestone 3 remain open until those doc facts are corrected |
| 2 review | Closed the browser asset-tree inventory gap and narrowed the remaining March 27 evidence-attribution issue | Round 2 fixed `docs/module-design.md` and reran verification, but `docs/requirements-analysis.md` still credits browser-side regression coverage for selector-pipeline wiring that the repo keeps on the March 19 recorded inspection | AC-2 and Milestone 3 stay open for one remaining requirements-analysis precision fix; Round 2 verification evidence recorded |

#### Original Plan AC Coverage Matrix
| Original AC | Status | Current Evidence |
|-------------|--------|------------------|
| AC-1 | Closed | The hardest-to-read code paths now carry minimal English comments that explain invariants, fallback order, tie-breaks, or hidden constraints. Round 0 covered `src/algorithms/compression.ts`, `src/services/fallback-data.ts`, and `src/server/index.ts`; Round 1 closed the remaining hotspots in `src/algorithms/graph.ts`, `src/algorithms/multi-route.ts`, `src/services/fallback-algorithms.ts`, and `src/services/runtime.ts`. |
| AC-2 | In progress | Core design, requirements, task, user, and reference docs mostly align on repository structure, module boundaries, command surface, and current capability statements, including `public/**` versus `dist/public/**`, the broader `scripts/**` surface, the implemented browser/API endpoints, and the repaired `public/assets/**` versus `dist/public/assets/**` inventory in `docs/module-design.md`; review narrowed the remaining precision gap to the March 27 selector-parity wording in `docs/requirements-analysis.md`, which still credits browser-side regression coverage for shell wiring that the repo keeps on the March 19 recorded inspection. |
| AC-3 | Closed | World, history, and process documents now mark their own scope and time context explicitly. `docs/world/README.md`, `docs/world/spec.md`, `docs/world/contract.md`, `docs/world/plan.md`, `docs/agent-usage.md`, and `docs/rlcr-concurrency-retrospective-2026-03-20.md` no longer present themselves as the current repository's primary source of truth. |
| AC-4 | Closed | The pass remained behavior-neutral and was re-verified on `main`. Rounds 1 and 2 reran `npm test` successfully (`144` passed each time), and Round 2 also reran the targeted date-boundary and asset-tree `rg` checks plus manual review while keeping the remaining work confined to docs and tracker evidence. |
| AC-5 | Closed | Source comments remain English-only and explanatory rather than procedural, and the documentation pass stayed focused on terminology/boundary convergence instead of process narration. Round 1 manual review confirmed comment quality and documentation-boundary consistency, and repository search found no Chinese comments under `src/**/*.ts`. |
| AC-6 | Closed | The work stayed split into independently reviewable batches: algorithm comments, service/runtime/server comments, core-doc alignment, world/history/process boundary alignment, auxiliary reference checks, and final verification. Round 1 recorded the targeted repository searches and manual review needed to close the verification batch. |

#### Milestone Coverage Matrix
| Milestone | Status | Current Evidence |
|-----------|--------|------------------|
| Milestone 1: establish terminology baseline and hotspot inventory | Closed | The implemented file grouping across Rounds 0-1 now records the required baseline explicitly: comment hotspots in `src/algorithms/graph.ts`, `src/algorithms/multi-route.ts`, `src/algorithms/compression.ts`, `src/services/runtime.ts`, `src/services/fallback-algorithms.ts`, `src/services/fallback-data.ts`, and `src/server/index.ts`; doc-role inventory across core docs, user/reference docs, and world/history/process docs; terminology and path baseline for `public/**`, `dist/public/**`, `scripts/**`, and the March 27 / March 19 / March 18 evidence split. |
| Milestone 2: complete code comment enrichment | Closed | Round 0 and Round 1 together closed the algorithm, service, runtime, fallback, and server comment hotspots without changing behavior. |
| Milestone 3: align the main delivery docs | In progress | The core design/requirements/task/user/reference docs were updated across Rounds 0-2, and Round 2 closed the browser asset-tree inventory fix in `docs/module-design.md`, but review kept one remaining March 27 evidence-attribution precision fix open in `docs/requirements-analysis.md`. |
| Milestone 4: align special document boundaries | Closed | The world-mode, history, and process document set now carries explicit scope/time markers and reference-only framing where required. |
| Milestone 5: unify verification and closeout | Closed | Round 1 reran `npm test`, recorded the exact targeted `rg` checks, and preserved the manual review note covering comment quality plus terminology/path/history-boundary consistency. Round 2 reran `npm test`, reran the date-boundary and asset-tree searches, and used manual review to narrow the remaining work to a single requirements-analysis wording gap. |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Tighten the March 27 selector-parity wording in `docs/requirements-analysis.md` | AC-2 | Open | Keep the March 19 versus March 27 boundary fix and the runtime-service graph-variant attribution, but stop crediting browser-side regression coverage for the authoritative selector-pipeline wiring unless that coverage is actually automated. |

### Completed and Verified
<!-- Track completed tasks together with their current verification state -->
| Scope | Task | Completed Round | Verified Round | Evidence |
|-------|------|-----------------|----------------|----------|
| Milestone 1, AC-2, AC-3, AC-6 | Recorded the terminology baseline, hotspot inventory, and doc-role inventory that drove the pass | 0-1 | 1 | The current tracker now preserves the inventory that had been implicit in the work split: algorithm/runtime/server hotspots, core-doc alignment scope, world/history/process boundary scope, `public/**` versus `dist/public/**`, `scripts/**`, and the March 27 / March 19 / March 18 evidence boundaries. |
| AC-1 | Added high-value comments to algorithm hotspots | 0-1 | 1 | `src/algorithms/compression.ts`, `src/algorithms/graph.ts`, and `src/algorithms/multi-route.ts` now carry explanatory comments for dictionary seeding, time/fallback precedence, deterministic tie-breaks, path-tree reuse, and heuristic boundaries. |
| AC-1 | Added high-value comments to services, runtime helpers, fallback helpers, and the server entrypoint | 0-1 | 1 | `src/services/runtime.ts`, `src/services/fallback-algorithms.ts`, `src/services/fallback-data.ts`, and `src/server/index.ts` now explain runtime capability gates, fallback routing policy, deterministic fallback data generation, asset resolution, and static-serving safety boundaries. |
| AC-2, AC-3 | Aligned most of the core design, requirements, task, user, and reference documents to the current repository | 0-2 | 2 | `README.md`, `docs/overall-design.md`, `docs/task-description.md`, `docs/user-guide.md`, `docs/example-results-and-tests.md`, `docs/evaluation-and-improvements.md`, `docs/innovation-notes.md`, `docs/data-structures-and-dictionary.md`, and `docs/journal-social-design-style.md` align on structure, paths, commands, surfaces, and dated evidence boundaries; Round 2 closed the `docs/module-design.md` asset-inventory follow-up, but review kept one narrower March 27 evidence-attribution issue open in `docs/requirements-analysis.md`. |
| AC-3 | Clarified world, history, and process document boundaries | 0-1 | 1 | `docs/world/README.md`, `docs/world/spec.md`, `docs/world/contract.md`, `docs/world/plan.md`, `docs/agent-usage.md`, and `docs/rlcr-concurrency-retrospective-2026-03-20.md` now mark their scope and time context explicitly. |
| AC-2, AC-3 | Closed the auxiliary reference-check scope without content edits | 1 | 1 | `docs/world/examples/boston-inspired.seed-fragment.json` and `docs/tsconfig-placeholder.d.ts` were checked for live references and boundary consistency; no edits were required. |
| AC-4, AC-5, AC-6 | Completed unified verification and consistency checks, then reran them after the Round 2 doc follow-ups | 1-2 | 2 | `npm test` reran successfully on `main` in both Round 1 and Round 2 with `144 passed, 0 failed`; Round 1 also recorded `rg -n '^\\s*(//|/\\*|\\*|\\*/)' src/algorithms src/services src/server/index.ts --glob '*.ts'`, `rg -n 'public/index\\.html|public/styles\\.css|public/assets/\\*\\*|public/vendor/\\*\\*|dist/public/\\*\\*|scripts/browser-build\\.js|scripts/sample-data\\.ts|scripts/benchmark-support\\.ts' README.md docs`, `rg -n 'March 27, 2026|March 19, 2026|March 18, 2026|historical|recorded evidence|rerun' README.md docs`, `rg -n '/map\\?view=world|/api/world|/api/world/details|/api/world/routes/plan|world mode|world-route|feed browsing|post-detail' README.md docs`, and `rg -n 'boston-inspired\\.seed-fragment\\.json|world-map-boston-inspired\\.seed-fragment\\.json|docs/tsconfig-placeholder\\.d\\.ts' docs README.md tsconfig.json`; Round 2 reran `rg -n 'March 27, 2026|March 19, 2026|March 18, 2026|historical|recorded evidence|rerun' README.md docs` and `rg -n 'public/assets/\\*\\*|dist/public/assets/\\*\\*|public/index\\.html|public/styles\\.css|public/vendor/\\*\\*|dist/public/vendor/\\*\\*' README.md docs`; manual review confirmed that the new source comments remain English-only and explanatory, that `docs/module-design.md` now reflects the browser asset tree, and that one narrower March 27 wording issue remains in `docs/requirements-analysis.md`. |
| AC-2, Milestone 3 | Added the first-party browser asset tree to the module inventory | 2 | 2 | `docs/module-design.md` now inventories `public/assets/**` and `dist/public/assets/**`, matching the repository tree and the later asset-copy description in the same document. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| `docs/requirements-analysis.md` still partly attributes the March 27 selector-parity evidence to browser-side regression coverage even though the live shell's helper wiring remains tied to the March 19 recorded inspection. | 2 review | AC-2 | Rewrite the March 27 selector-parity bullets to attribute the automated rerun to the selector-binding tests directly, keep the graph-variant line on the runtime-service suite, and leave the shell-wiring fact on the March 19 recorded inspection unless new automated coverage is added. |
