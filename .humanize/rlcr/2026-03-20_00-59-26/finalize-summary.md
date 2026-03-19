Simplifications made
- Centralized post detail comment response handling into `applyCommentsResponse()` so availability, counts, pagination state, notice rendering, and form disabled state update in one place.
- Centralized post detail comment failure handling into `applyCommentsError()` so the new degraded-comments behavior keeps one error-state path.
- Removed redundant comment rerender/reset work from the load-more catch block because `refreshComments()` already applies the same error UI before rethrowing.
- Left `public/spa/views/explore.js` unchanged after inspection because the recent contextual map href helper already represented the lowest-risk simplification.

Files modified during Finalize Phase
- `public/spa/views/post-detail.js`
- `.humanize/rlcr/2026-03-20_00-59-26/finalize-summary.md`

Tests still pass
- Ran `npm test`
- Result: pass, 70 tests passed, 0 failed

Notes about refactoring decisions
- This finalize pass stayed inside behavior-preserving deduplication only.
- No comment availability semantics were changed: the form is still enabled or disabled only from successful comment responses, and comment load failures still surface both the inline error state and the propagated status message.
- `public/spa/views/explore.js` was intentionally not edited because further reduction there would mostly reshuffle data passed into the existing helper without materially improving safety or readability.
