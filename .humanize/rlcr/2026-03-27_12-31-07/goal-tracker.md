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
| Define dist/public as the only runtime output directory and route browser build output there while preserving public URLs. | 2 | pending | Aligns build output with stable URLs. |
| Switch server static root to the runtime output directory and keep index fallback consistent. | 2 | pending | Server should not serve source public/. |
| Update tests and harnesses to load assets from the runtime output directory and assert helper/global/CommonJS contracts. | 3 | pending | Include negative coverage for broken outputs. |
| Split build responsibilities for browser output and static copy; ensure build is repeatable and recoverable. | 4 | pending | No manual steps. |
| Remove first-party committed browser JS from public/ and add safeguards to prevent reintroduction. | 1 | pending | Leave third-party exceptions intact. |
| Update docs to describe pure TypeScript meaning, runtime output directory, stable URLs, and exceptions. | 5 | pending | Keep commands consistent with structure. |
| Audit new or moved first-party public contracts for concise English JSDoc. | 6 | pending | Avoid process-style comments. |

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
