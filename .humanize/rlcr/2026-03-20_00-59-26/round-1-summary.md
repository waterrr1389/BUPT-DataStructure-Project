# Round 1 Summary

## What Was Implemented

- `5a2c357` updated `public/spa/views/explore.js` so Explore food and facility "Open in map" links now use actor-aware route context, matching the actor-preserving behavior already present for destination cards and Map rewrites.
- `a945680` updated `public/spa/views/post-detail.js` so initial comments-load failures no longer collapse the whole Post Detail route; the journal surface stays mounted and the failure is surfaced through the comments notice/body instead of the missing-endpoint degraded state.
- `e6f0c98` extended `tests/spa-regressions.test.ts` with deterministic coverage for the Explore food/facility actor-preservation cases and the Post Detail comments-failure rendering path that Codex flagged in the Round 0 gate.

## Files Modified

- Integrated branch: `public/spa/views/explore.js`
- Integrated branch: `public/spa/views/post-detail.js`
- Integrated branch: `tests/spa-regressions.test.ts`
- Bookkeeping: `.humanize/rlcr/2026-03-20_00-59-26/round-1-summary.md`

## Tests Added/Passed

- `e6f0c98` added a Post Detail regression proving the journal hero/story content remains visible and an in-view comments error is rendered when the initial comments request fails.
- `e6f0c98` added Explore food-link regressions proving recommendation/search map links preserve `actor` when present and stay clean when no actor exists.
- `e6f0c98` added Explore facility-link regressions proving facility result map links preserve `actor` when present and stay clean when no actor exists.
- The team leader verified the integrated branch with `npm test`, which passed with `70 tests, 0 failures`.

## Any Remaining Items

- None for the Round 1 gate scope. The two gaps called out in `round-0-review-result.md` were closed by `5a2c357`, `a945680`, and `e6f0c98`, and the integrated branch is green.

## Goal Tracker Update Request

### Requested Changes

- Add a Round 1 `Plan Evolution Log` row recording that Codex gate feedback reopened AC-2, AC-4, and AC-5 because Explore food/facility map hand-offs and Post Detail comments-failure behavior were still incomplete after Round 0, and that Round 1 resolved those gaps with targeted fixes plus regression coverage.
- Update the existing AC-2 completed evidence so it includes `5a2c357` and `e6f0c98`, because the Round 0 tracker entry covered destination-card and Map paths but did not cover Explore food/facility map links that were still dropping `actor`.
- Update the existing AC-4 completed evidence so it includes `a945680` and `e6f0c98`, because the tracker currently stops at API-level comments classification while Round 1 fixed and verified the remaining view-level requirement: real comments failures stay scoped to the comments surface instead of taking down Post Detail.
- Update the existing AC-5 completed evidence so it includes the new Round 1 regressions from `e6f0c98` and the integrated `npm test` result of `70 tests, 0 failures`, because the prior evidence did not cover the two gate-identified missing scenarios.

### Justification

- These are the minimum justified tracker corrections because the current tracker overstates what Round 0 had verified for AC-2, AC-4, and AC-5.
- No new deferred items or open issues are warranted: the Round 1 fixes landed on `main`, the missing regressions were added, and the integrated branch test run passed.
