Fixed issues:
- [P1] World-edge mode mismatch now returns `422 world_route_mode_not_allowed` instead of falling through to `reachable=false` with `world_segment_unreachable`.
- [P2] Misconfigured portals outside the surviving direction/mode candidate set no longer poison otherwise valid cross-map routing.

How the issues were resolved:
- Updated cross-map failure selection in `world-route-service` so any deterministic world-edge mode rejection wins over true world disconnection once destination-local success candidates are exhausted. This preserves the documented 422 contract when at least one candidate pair is topologically connected in the world graph but rejected by the requested mode.
- Kept the requested-mode world search and covered the world-only edge case with a regression test that verifies the stable `allowedModes` payload when only world edges block the request.
- Added an API contract regression where one candidate pair is mode-rejected by world edges and another is truly disconnected, confirming the service now freezes on the 422 payload instead of returning a 200 unreachable itinerary.
- Added a runtime regression showing a lower-priority misconfigured portal is filtered out after direction/mode candidate selection, allowing a valid portal pair to route successfully.

Unresolved issues:
- None identified in this round.
