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
Fix the journal and exchange data flow so destination pickers cover the seeded journal data, duplicate destination names are disambiguated in the UI, and journal/exchange surfaces show human-readable destination and user names without widening scope beyond the targeted regression fix.

Source plan: plan.md

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->

1. AC-1 Complete destination option coverage
   - The destination options used by `#journal-destination` and `#exchange-destination` cover the seeded journal destination IDs called out in `plan.md`, including `dest-001`, `dest-004`, `dest-007`, `dest-010`, `dest-013`, `dest-016`, `dest-019`, `dest-022`, `dest-025`, `dest-028`, `dest-031`, and `dest-034`.
   - The visible label source is no longer limited to the `bootstrap.featured` subset.
   - `<option value>` remains the stable destination ID.

2. AC-2 Stable duplicate-label disambiguation
   - If multiple destinations share the same base `name`, the affected journal/exchange dropdowns render distinct, stable visible labels for those entries.
   - The fix is generic and does not rely on one-off special cases for `"Amber Bay"` or any single destination ID.

3. AC-3 Human-readable journal and exchange rendering
   - Known destination and user IDs in journal/exchange cards or results render as readable names instead of raw `dest-xxx / user-yy` identifiers.
   - Seeded cases such as `journal-12` resolve to readable destination/user text when lookup data is present.

4. AC-4 Safe fallback and interaction preservation
   - Missing destination or user lookup entries do not crash journal/exchange rendering; the UI falls back to the raw ID or another explicit placeholder.
   - Existing journal-card behaviors that key off the journal ID, including `data-journal-id` and view/rate/delete actions, continue to work unchanged.

5. AC-5 TDD coverage and minimal-regression completion
   - Regression tests are added first for destination-option coverage, duplicate destination labels, and readable journal/exchange name mapping.
   - `npm test` passes after the fix.
   - Documentation under `docs/` is updated only if the implementation changes an exposed data contract or user-facing workflow.

---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 1 (Updated: Round 0 initialization)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initialized the tracker from `plan.md` with a focused journal/exchange goal, five acceptance criteria, and a TDD-first task breakdown | Prevent goal drift before implementation starts and keep the round aligned with the plan's minimal-scope fix | AC-1, AC-2, AC-3, AC-4, AC-5 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Add failing regression tests for destination-option coverage, duplicate labels, and raw-ID journal rendering | AC-1, AC-2, AC-3, AC-5 | in_progress | TDD first step to lock the current failures before implementation |
| Replace the featured-only destination source for journal/exchange controls with a source that covers all seeded journal destinations while keeping option values as destination IDs | AC-1 | pending | Fix the underlying data-coverage gap without changing selection semantics |
| Introduce a shared destination-label disambiguation rule for affected dropdowns | AC-2 | pending | Visible labels must stay distinct and stable when names collide |
| Route journal/exchange rendering through destination and user lookups that prefer readable names | AC-3 | pending | Apply the readable-name mapping consistently across affected UI surfaces |
| Add safe fallback handling for missing lookup entries and confirm journal-card interactions still key off journal IDs | AC-4 | pending | Prevent render crashes and protect existing card behavior |
| Run `npm test` and update `docs/` only if the final implementation changes exposed behavior or operator guidance | AC-5 | pending | Final verification and documentation decision gate |

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
