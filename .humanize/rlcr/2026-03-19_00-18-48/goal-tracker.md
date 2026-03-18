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

### Plan Version: 3 (Updated: Round 0 remediation bookkeeping)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initialized the tracker from `plan.md` with a focused journal/exchange goal, five acceptance criteria, and a TDD-first task breakdown | Prevent goal drift before implementation starts and keep the round aligned with the plan's minimal-scope fix | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 0 | Recorded the integrated Round 0 implementation result after the service, presentation, and docs commits landed and `npm test` passed with 25 tests | Close the round with evidence-backed task completion and keep the tracker aligned with the verified branch state | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 0 | Applied the review-driven remediation after `round-0-review-result.md` identified missing consumer-path coverage and overstated March 19 docs evidence wording | Bring the mutable tracker back in line with the actual verified branch state before final Round 0 closure | AC-1, AC-3, AC-4, AC-5 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1, AC-5 | Add regression coverage for destination-option coverage and land the service-side catalog support for journal/exchange consumers | 0 | 0 | Commit `20b4005` updated `src/services/destination-service.ts` and `src/services/index.ts` so `bootstrap.destinations` exposes the full catalog while `bootstrap.featured` remains the 12-item featured deck, with contract coverage in `tests/runtime-services.test.ts`. Review remediation in commit `5d64dab` then added `public/journal-consumers.js` plus `tests/journal-consumers.test.ts` to prove the live journal/exchange consumer path uses `bootstrap.destinations`, preserves destination IDs as option values, and keeps the seeded journal destination set reachable end to end. The integrated branch finally passed `npm test` with 27 total passing tests |
| AC-1 | Replace the featured-only destination source for journal/exchange controls with a source that covers the seeded journal destinations while keeping option values as destination IDs | 0 | 0 | Commit `20b4005` exposed the full destination catalog from bootstrap. Commit `c4daa81` moved the selector rendering toward the shared presentation path, and remediation commit `5d64dab` updated `public/app.js` to call `prepareJournalExchangeDestinationBindings(...)` from `public/journal-consumers.js`, locking the journal and exchange controls to the full catalog instead of the featured subset |
| AC-2 | Introduce a shared duplicate-safe destination-label rule for affected dropdowns | 0 | 0 | Commit `c4daa81` added `public/journal-presentation.js` and `tests/journal-presentation.test.ts`, implementing and covering stable duplicate-name label disambiguation for destination options so same-name entries no longer surface as indistinguishable labels such as repeated `Amber Bay` |
| AC-3 | Route journal/exchange rendering through destination and user lookups that prefer readable names | 0 | 0 | Commit `c4daa81` wired `public/app.js` through `public/journal-presentation.js` so journal and exchange cards render readable destination and user names instead of raw `dest-xxx / user-yy` IDs, while keeping fallback behavior test-covered. Remediation commit `5d64dab` added consumer-path regression coverage to ensure the live bindings continue to feed that readable presentation path correctly |
| AC-4 | Add safe fallback handling for missing lookup entries and preserve journal-card interactions that depend on journal IDs | 0 | 0 | Commit `c4daa81` added safe lookup fallback coverage in `tests/journal-presentation.test.ts`. Review remediation in commit `5d64dab` extracted the journal action request path into the testable helper module `public/journal-consumers.js` and added `tests/journal-consumers.test.ts` coverage proving `data-journal-id` plus `view`, `rate`, and `delete` actions remain anchored to the journal ID rather than any destination or user lookup field |
| AC-5 | Run the full test suite and update docs only for the exposed bootstrap/data-flow change | 0 | 0 | The integrated branch passed `npm test` with 27 passing tests after remediation. Documentation stayed scoped to the exposed behavior changes: earlier Round 0 docs alignment updated `docs/overall-design.md`, and remediation commit `9081fe0` revised `docs/example-results-and-tests.md` so March 19 automated/code-level evidence is clearly separated from the older March 18 live smoke evidence |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
