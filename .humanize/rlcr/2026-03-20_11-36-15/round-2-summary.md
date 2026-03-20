# Round 2 Summary

## Task Goal
Lock down the route-stage radius contract so every shell surface on the Map page (map stage card, empty shell, and planned-route summary) inherits the `route-stage-shell` treatment, confirm the responsive token override order works in mobile, and capture the regression protections so the shell hook stays intact.

## Subtask Results
- **Map-stage shell hook and rendering surface:** `public/spa/views/map.js` now factors the route-result area into the shared `route-stage-shell` surface so it lives inside `map-stage-empty-shell`, and `public/spa/map-rendering.js` applies that hook to both `.map-stage-card` and `.route-summary-card`, aligning the DOM hook structure between the inline fallback and the planned summary cards (`63b3711`, `3f0279c`).
- **Shared radius styling and responsive token order:** `public/styles.css` introduces the shared `route-stage-shell` radius contract that governs the desktop tokens for the map stage, the empty shell, and the planned summary cards, while the later fix ensures the mobile 20px radius token takes precedence when the override order changes (`eabf343`, `06f941b`).
- **Regression assertions:** `tests/spa-regressions.test.ts` now asserts the presence of the shared shell contract for the map stage, the empty shell, and the planned-route summary cards so the hook and its radius rules stay verified (`354ab23`).

## Verification Conclusion
`npm test` (full suite) still returns 73 passed, 0 failed. Browser checks on http://127.0.0.1:3001/map after the final CSS-order fix show desktop 1280×900 renders the main map card, empty shell, and the planned summary cards all at 24px radius, mobile 390×844 renders them at 20px, and the inner `.route-result .empty-state` keeps no border. The discrete tests, viewport verifications, and the independent review (no findings, consistent with the plan and the round-1 review feedback) confirm the shell hook, radius contract, and responsive tokens now behave as intended.

## Remaining Risks / Follow-up Suggestions
Continue to rerun the regression suite when touching shell controls and keep an eye on any other components that share `route-stage-shell` in case their radius needs further coordination or a future responsive token change.

## Files Modified
- `public/spa/views/map.js`, `public/spa/map-rendering.js` (route-stage-shell hook placements)
- `public/styles.css` (shared shell radius contract plus mobile override order fix)
- `tests/spa-regressions.test.ts` (new radius-contract assertions)

## Tests Added/Passed
- `tests/spa-regressions.test.ts` – added assertions for the route-stage shell contract on the map stage, empty shell, and planned-route summary cards.
- `npm test` – 73 passed, 0 failed.

## Goal Tracker Update Request
### Requested Changes:
- Mark AC-1 resolved with the round-2 shell-hook additions plus responsive-token assurances from the desktop and mobile checks.
- Clear the open issue about the narrow-screen radius mismatch by citing the CSS-order fix that lets the 20px mobile token win and the 390×844 viewport verification.
- Update the plan evolution/evidence section so it records the shell-hook implementation, the responsive override fix, the regression assertions, and the final verification sweep that completed in round 2.

### Justification:
The commits `63b3711`, `3f0279c`, `eabf343`, `06f941b`, and the regression guard `354ab23` deliver the shell, styling, and tests the plan requested, the latest `npm test` plus the desktop/mobile map browser checks prove the radius contract and responsive token handling, and the independent review reported no findings, so the tracker can consider these items complete.
