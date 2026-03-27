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

### Plan Version: 1 (Updated: Round 0)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initialized goal, acceptance criteria, and workstreams from `plan.md` | Establish a stable execution anchor before parallel work begins | Defined AC1-AC6 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Add high-value comments to algorithm hotspots | AC1 | in_progress | Focus on invariants, ordering rules, compression behavior, and graph or multi-route constraints in the named algorithm files. |
| Add high-value comments to services and server entrypoints | AC2 | in_progress | Cover runtime orchestration, fallback selection, data sourcing boundaries, and server bootstrap assumptions. |
| Align core design and requirements documents | AC3 | in_progress | Normalize terminology, module roles, repository paths, commands, and current capability descriptions across design and requirements docs. |
| Align user-facing and reference documents | AC4 | in_progress | Update usage, examples, outputs, and reference guidance to match the current repository behavior and layout. |
| Clarify world, history, and process document boundaries | AC5 | in_progress | Mark special-mode, retrospective, and process material with explicit scope or historical context. |
| Run final verification and consistency checks | AC6 | pending | Execute existing tests and targeted `rg` checks after the content workstreams land. |

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
