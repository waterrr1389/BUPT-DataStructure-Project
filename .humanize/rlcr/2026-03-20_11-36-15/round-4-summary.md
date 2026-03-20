# Round 4 Summary

## Issues Fixed
- Floor-change turn legend badges had label text that conflicted with the rendered marker pills because `createContextMarkers()` only populated `legendBadgeLabel` from `marker.shortLabel` for transition markers.
- The waypoint placeholder implied human-readable node names, but submit still required comma-separated `waypointNodeIds`.

## How They Were Resolved
- Updated `public/route-visualization-markers.js` and its regression test so floor-change turns now inherit `marker.shortLabel` for `legendBadgeLabel`, aligning the legend badges with the rendered marker pills while leaving the main turn legend label unchanged (`b897f69`).
- Adjusted `public/spa/views/map.js` and added a surrounding regression test to clarify that waypoint submission expects comma-separated node IDs by phrasing the placeholder as “Waypoint node IDs, comma-separated” (`732d3b1`).

## Validation
- `npm test -- tests/spa-regressions.test.ts`
- `npm test` (74 tests, 0 failed)

## Unresolved Issues
- None remain from the round-4 review findings.
