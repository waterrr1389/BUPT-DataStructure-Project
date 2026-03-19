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
Unify all destination selectors to a single disambiguated source and introduce deterministic, non-isomorphic destination graph variants without breaking routing, facilities, tests, or required docs.

Source plan: plan.md

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->

1. All five destination selectors (`Route Planner`, `Nearby facilities`, `Food compass`, `Journal studio`, `Exchange lab`) consume one shared option-preparation path with stable duplicate-name disambiguation (e.g., `Amber Bay` labels differ), while submitted values remain canonical `destination.id`.
2. Route/facility/food selectors are aligned to the same authoritative destination catalog as journal/exchange (not `featured`-only), and existing seed IDs used by journal/exchange are selectable across modules.
3. Fallback destination graph generation is deterministic and variant-based (not one reused template): at least two destinations have verifiably different node/edge structure while routing and nearby-facility behavior remains valid.
4. Regression evidence is complete: browser-binding regressions for selector alignment/disambiguation are covered by tests, and `npm run build`, `npm test`, and `npm run validate:data` pass; docs under `docs/` are updated if behavior documentation changed.

---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 1 (Updated: Round 0)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 0 | Mark all planned Round 0 tasks completed and verified | Implementation, tests, docs, and full verification are finished in Round 0 | AC-1, AC-2, AC-3, AC-4 satisfied with commit/test evidence |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| None | - | completed | All Round 0 planned tasks were moved to Completed and Verified. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1 | Extract/extend shared destination option builder so all modules use one disambiguation rule and stable `id` values | 0 | 0 | Implemented in `7ecfa78` (`public/app.js`, `public/journal-consumers.js`) with shared destination-option preparation, duplicate-name disambiguation, and canonical destination `id` submission path; verified by `npm test` passing (30 tests). |
| AC-1, AC-2 | Refactor browser bindings in `public/app.js` and journal/exchange consumers to consume the same authoritative destination source | 0 | 0 | Implemented in `7ecfa78`; route/facility/food selectors consume full destination catalog in parity with journal/exchange while featured destinations remain homepage-card drivers; verified by `npm test` passing (30 tests) and `npm run validate:data` passing. |
| AC-3 | Replace single fallback graph template with deterministic variant generation keyed by destination/type/region and preserve graph integrity constraints | 0 | 0 | Implemented in `90362ac` (`src/services/fallback-data.ts`) with deterministic scenic/campus fallback graph variants and structural divergence; regression coverage added in `tests/runtime-services.test.ts`; verified by `npm test` passing (30 tests) and `npm run validate:data` passing. |
| AC-1, AC-2, AC-3, AC-4 | Add/adjust regression tests for duplicate-label disambiguation, cross-module selector parity, and representative routing/facility behavior across graph variants | 0 | 0 | Test updates in `7ecfa78` (`tests/journal-consumers.test.ts`) and `90362ac` (`tests/runtime-services.test.ts`) cover selector parity/disambiguation and graph variant structure/regression; verification run: `npm test` passed with 30 tests. |
| AC-4 | Run full verification (`npm run build`, `npm test`, `npm run validate:data`) and update impacted docs if behavior descriptions changed | 0 | 0 | Docs aligned in `f673fbc` (`README.md`, `docs/evaluation-and-improvements.md`, `docs/example-results-and-tests.md`, `docs/overall-design.md`, `docs/requirements-analysis.md`, `docs/task-description.md`, `docs/user-guide.md`). Verification results in final Round 0 repo state: `npm run build` passed; `npm test` passed (30 tests); `npm run validate:data` passed with counts `destinations 220`, `buildings 660`, `facilityCategories 10`, `facilities 1100`, `edges 4070`, `users 12`, `journals 12`, `foods 880`. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|
| None | - | - | No deferred items in Round 0. | - |

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| None | - | - | No open issues in Round 0. |
