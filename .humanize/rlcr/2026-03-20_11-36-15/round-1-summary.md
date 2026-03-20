# Round 1 Summary

## Task Goal
Secure the remaining pieces of the Map-area alignment from the plan: share the map stage shell, surface-friendly copy, documentation, and regression safeguards so the Map page delivers the planned experience without leaking implementation terminology or unsafe regressions.

## Subtask Results
- **Map shell consistency and copy cleanup:** `public/spa/views/map.js` now wraps the route-result area in the `map-stage-empty-shell` surface so it shares the same `surface-card` treatment as the map stage, and `public/spa/map-rendering.js` removes the remaining implementation-facing copy while updating the result copy to `Route ready to follow.` and `Route details`. Together these edits ensure the inline fallback and planned-route summary follow the expected messaging and card geometry (`3e355c2`, `34e301e`, `54fb236`).
- **Styling and documentation alignment:** `public/styles.css` introduces the map-specific `map-stage-empty-shell` styling that enforces the 24px desktop/18px mobile radius, no inner border on `.empty-state`, and the shared return-link/button-row layout, while `docs/journal-social-design-style.md` and `docs/user-guide.md` now describe the actual legend semantics and map guidance that ship in production (`d00ce9b`, `b200ac5`).
- **Regression coverage:** `tests/spa-regressions.test.ts` gained assertions for the Destination → Start/End field order, `details/summary` Advanced routing disclosure, `.ghost` secondary button, return link outside the button row, the `surface-card map-stage-empty-shell` hook, absence of the `/map?destinationId=...&from=...&to=...` raw query, and a non-Map consumer for the shared helper; the final route-summary copy expectations were also tightened (`988f145`, `8e6b34d`).

## Verification Conclusion
`npm test` (full suite) completed with 73 passes and 0 fails after the round-1 changes. Manual browser verification on http://127.0.0.1:3001/map confirmed the desktop 1280×900 viewport renders a two-column grid, the route-result shell carries `surface-card map-stage-empty-shell` with a 24px radius, its inner `.empty-state` loses the old border, the `Return to Explore` link sits outside the button row, and `Advanced routing` remains a `details/summary` disclosure; the mobile 390×844 viewport showed the same shell class, an 18px radius, no inner border, and the same disclosure/button structure. A final independent review reported no findings and agreed the round-1 outcome matches the plan.

## Remaining Risks / Follow-up Suggestions
No outstanding issues remain; continue to rerun `npm test` after any future map-area tweaks and keep an eye on shared helper consumers when touching the empty-state markup.

## Files Modified
- `public/spa/views/map.js`, `public/spa/map-rendering.js`, `public/styles.css` (map stage shell, copy, and styling updates)
- `docs/journal-social-design-style.md`, `docs/user-guide.md` (legend semantics and map guidance sync)
- `tests/spa-regressions.test.ts` (regression assertions covering the new hooks and copy expectations)

## Tests Added/Passed
- `tests/spa-regressions.test.ts` – added assertions for Destination order, Advanced routing disclosure, `.ghost` secondary button, return-link placement, `map-stage-empty-shell`, raw query absence, non-Map helper usage, and updated route-result copy expectations.
- `npm test` (full suite) – 73 passed, 0 failed.

## Goal Tracker Update Request
### Requested Changes:
- Mark AC-1 as resolved with the new `map-stage-empty-shell` wrapper that aligns the route-result card with the map shell and refreshed copy (`3e355c2`, `34e301e`, `54fb236`).
- Mark AC-5 as resolved now that all remaining implementation-facing words are removed from the Map UI and supporting copy (`34e301e`, `54fb236`).
- Mark AC-7 as resolved because `docs/journal-social-design-style.md` and `docs/user-guide.md` now document the shipped legend and map guidance (`b200ac5`).
- Mark AC-8 as resolved given the expanded SPA regression suite that locks in field order, disclosure structure, `.ghost` hook, shell CSS/design, absence of the raw `/map?destinationId=...&from=...&to=...` example, and non-Map helper safety, plus the tighter route-result copy expectations (`988f145`, `8e6b34d`).
- Update AC-6 evidence to cite the verified desktop 1280×900 and mobile 390×844 viewport checks on the `/map` page.
- Note that no open issues remain after the round-1 fixes.
### Justification:
The commits listed above deliver the missing map shell, copy, docs, and regression coverage the plan asked for, the manual viewports prove the styling and disclosure requirements in AC-6, `npm test` passes, and an independent review surfaced no further findings, so the tracker can safely mark those ACs as complete.
