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
基于 `docs/world/README.md`、`docs/world/spec.md` 和 `docs/world/contract.md`，在不改写现有 local map、现有 `/api/routes/plan` 和现有 SVG 渲染链路的前提下，先交付一个可运行、可验证、可回滚的 read-only world mode 基础版本。这个基础版本必须完成 optional `world` seed 能力、world 数据校验、轻量 summary 与重型 details 接口、`/map?view=world` 的 `Leaflet + CRS.Simple` 容器与基础交互，并把完整 world routing 与 cross-map handoff 明确放到后续扩展里，而不是混进首轮交付。计划默认采用 TDD 驱动的验证口径，并要求相关文档持续与实际实现保持一致。

## Acceptance Criteria

### Goal
在保留现有各 `destination` 局部地图与局部路由能力不变的前提下，引入一个新的 world mode，用于：

- 展示多个 `destination` 的大地图分布
- 支持跨 `destination` 的世界级导航
- 保持实现复杂度可控，并优先复用成熟地图能力

### Acceptance Criteria
1. **AC-1: Optional `world` seed data is modeled, validated, and loadable without affecting existing seeds.**
   - Positive Tests (PASS): seeds without `world` still validate/bootstrap, seeds with valid `world` load and pass cross-record integrity checks for regions, destinations, graphs, portals, and portal node references.
   - Negative Tests (FAIL): seeds missing required fields, duplicating ids, providing invalid coordinates, or referencing unknown region/portal/node ids (including non-portal world nodes for `portal.worldNodeId`) are rejected.
2. **AC-2: The world HTTP surface exposes summary/details endpoints plus capability metadata, with frozen unavailable behavior.**
   - Positive Tests (PASS): `GET /api/world` returns `enabled = true`, approved summary content, and capability flags when world data exists; `GET /api/world/details` returns the full dataset for rendering.
   - Negative Tests (FAIL): `GET /api/world` leaking details fields, misreporting unavailable state, or `/api/bootstrap` exposing world graph/portal details fails the contract.
3. **AC-3: `/map?view=world` renders a Leaflet + CRS.Simple read-only surface while the legacy SVG map continues to operate untouched.**
   - Positive Tests (PASS): world view loads summary/details, initializes Leaflet, renders backgroundImage, regions, destination markers, and routes destination clicks back to `/map?destinationId=...` without altering existing local behavior; non-world `view` requests still render the legacy SVG/local experience.
   - Negative Tests (FAIL): unavailable or invalid world data must surface a recoverable empty state instead of breaking `/map`, and local map rendering must never depend on Leaflet/world assets.
4. **AC-4: Deterministic coverage and documentation capture the read-only boundary and freeze future routing work.**
   - Positive Tests (PASS): automated suites verify seed/world validation, `/api/world` + `/api/world/details`, unavailable degradation, world view rendering, destination deep links, and no regression on the local map; documentation lists the frozen routing prerequisites (step schema/enums, cost model, error contracts, portal rules, local/world adjacencies).
   - Negative Tests (FAIL): surfacing `/api/world/routes/plan`, merging local/world graphs, or otherwise exposing routing stories before freeze is considered a failure.

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 3 (Updated: Round 2)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 1 | Retired the stale routing deferment and reopened routing verification because Round 1 landed `/api/world/routes/plan`, world polyline UI, and handoff links, but the routing contract still has unresolved mismatches. | The tracker must reflect the actual repo state instead of keeping routing deferred after implementation landed. | Immutable AC text stays unchanged; AC-1, AC-2, and AC-3 evidence are refreshed, and AC-4 remains active until the routing contract and error surface are aligned. |
| 2 | Verified the Round 1 routing mismatches as closed in code, docs, and automated coverage, while keeping tracking open for one remaining status-artifact cleanup task. | Round 2 aligned portal ranking, prefix-leg typing, numeric validation bounds, and invalid-request normalization, but the required cleanup of stale Round 1 summary claims was not completed. | AC-1 evidence is refreshed with the numeric-bound checks. AC-4 code and contract work is verified, but AC-4 remains active until the Round 1 summary stops overstating completion. |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Correct the stale Round 1 summary so it no longer claims the routing contract freeze and portal direction typing were already complete before the Round 2 fixes landed. | AC-4 | pending | `round-1-summary.md` still says the routing contract was frozen in Round 1 and that the domain models already aligned for portal direction typing, even though those claims were explicitly rejected in the Round 1 review and only closed in Round 2. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1 | Extend seed loading, world modeling, validation, and runtime capability wiring for optional `world` data, including integrity checks for regions, destinations, portals, placements, portal node semantics, and the frozen world value domains. | 1 | 2 | `npm run build` passed. `npm run validate:data` passed with `Seed data validation passed.` and the expected dataset counts. `npm test` passed `110/110`, including `validateSeedData keeps world optional for local-only seed data`, `validateSeedData rejects invalid world references and portal semantics`, `validateSeedData accepts frozen world portal directions inbound and outbound`, `world edge distance must stay within the frozen max`, `world portal transferDistance must stay within the frozen max`, `world portal transferCost must stay within the frozen max`, and `world seed keeps the Boston-inspired structural constraints deterministic`. |
| AC-2 | Implement the world service, contracts, runtime capability surface, and `GET /api/world` plus `GET /api/world/details`, while keeping `/api/bootstrap` lightweight and freezing unavailable behavior. | 0 | 1 | `npm test` passed `99/99`, including `server exposes read-only world summary and details while keeping bootstrap lightweight`, `server returns disabled world summary and a conflict for details when world mode is unavailable`, `server returns world_unavailable for world route planning and keeps bootstrap free of world payload`, and `runtime derives read-only world capabilities and world service keeps summary and details separate`. |
| AC-3 | Branch `/map` for `view=world`, preserve the existing SVG local-map flow, and keep disabled, failed, or malformed world payloads recoverable instead of breaking the page. | 1 | 1 | `npm test` passed `99/99`, including `map world view renders an unavailable state when the backend disables world mode`, `map world view falls back to an unavailable state when world details fail`, `map world view downgrades to unavailable when world details payload is malformed`, `map local view keeps using local route planning endpoints after world route enhancements`, and `app shell parseRoute preserves the world view param alongside actor and destination context`. |
| AC-4 | Reconcile portal selection ranking across the prompt, frozen docs, runtime contracts, service behavior, and end-to-end regression coverage. | 2 | 2 | `npm test` passed `110/110`, including `world route service ranks portal priority ahead of cheaper transfer cost` and `server ranks portal priority ahead of cheaper transfer cost for cross-map route planning`. |
| AC-4 | Align cross-map route contracts with the documented `reachable = false` prefix-leg behavior and remove unsafe itinerary casts. | 2 | 2 | `npm test` passed `110/110`, including `world route service returns empty cross-map prefix legs when origin portal direction blocks outbound transfer`, `world route service returns destination and world prefix legs when destination local traversal is unreachable`, `server returns empty cross-map prefix legs when origin portal direction blocks outbound transfer`, and `server returns destination and world cross-map prefix legs when destination local traversal is unreachable`. |
| AC-4 | Enforce the frozen world-route numeric ranges in seed validation and regression coverage. | 2 | 2 | `npm test` passed `110/110`, including the max-plus-one validation failures for world edge distance, portal transferDistance, and portal transferCost in `tests/data-seed.test.ts`. |
| AC-4 | Normalize `POST /api/world/routes/plan` invalid-request handling to the frozen `world_route_invalid_request` contract. | 2 | 2 | `npm test` passed `110/110`, including `world route plan maps malformed JSON to world_route_invalid_request`, `world route plan maps non-object payloads to world_route_invalid_request`, `world route plan keeps schema validation failures in world_route_invalid_request`, and `world route plan maps oversized payloads to world_route_invalid_request`. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|
| None. | - | - | No work is currently deferred. The old routing deferment is stale because the routing surface has already landed and now needs contract corrections rather than another deferment. | - |

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| `round-1-summary.md` still claims the routing contract freeze and portal direction typing were already complete in Round 1, even though those claims were explicitly rejected and only closed by the Round 2 fixes. | 2 | AC-4 | Update the Round 1 summary so its scope, tracker request, and remaining-risk sections match the reviewed state instead of preserving the stale overclaim. |
