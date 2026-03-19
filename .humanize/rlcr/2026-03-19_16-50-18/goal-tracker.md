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

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Extract/extend shared destination option builder so all modules use one disambiguation rule and stable `id` values | AC-1 | in_progress | selector unification/disambiguation |
| Refactor browser bindings in `public/app.js` and journal/exchange consumers to consume the same authoritative destination source | AC-1, AC-2 | in_progress | browser binding alignment |
| Replace single fallback graph template with deterministic variant generation keyed by destination/type/region and preserve graph integrity constraints | AC-3 | in_progress | deterministic graph variants |
| Add/adjust regression tests for duplicate-label disambiguation, cross-module selector parity, and representative routing/facility behavior across graph variants | AC-1, AC-2, AC-3, AC-4 | in_progress | regression tests |
| Run full verification (`npm run build`, `npm test`, `npm run validate:data`) and update impacted docs if behavior descriptions changed | AC-4 | pending | docs/verification |

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
