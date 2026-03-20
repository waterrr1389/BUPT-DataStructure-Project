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
| None. | - | - | Round 0 implementation tasks were completed and verified below. |

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1 | Extend seed loading, world modeling, validation, and runtime capability wiring for optional `world` data, including integrity checks for regions, destinations, portals, placements, and portal node semantics. | 0 | 0 | `npm run build` passed. `npm run validate:data` passed with `Seed data validation passed.` and the expected dataset counts. `npm test` passed `86/86`, including `validateSeedData keeps world optional for local-only seed data`, `validateSeedData rejects invalid world references and portal semantics`, and `world seed keeps the Boston-inspired structural constraints deterministic`. |
| AC-2 | Implement the world service, contracts, runtime capability surface, and `GET /api/world` plus `GET /api/world/details`, while keeping `/api/bootstrap` lightweight and freezing unavailable behavior. | 0 | 0 | `npm test` passed `86/86`, including `server exposes read-only world summary and details while keeping bootstrap lightweight`, `server returns disabled world summary and a conflict for details when world mode is unavailable`, and `runtime derives read-only world capabilities and world service keeps summary and details separate`. |
| AC-3 | Branch `/map` for `view=world`, load summary/details on demand, initialize `Leaflet + CRS.Simple`, render the read-only world surface, and preserve the existing SVG local-map flow. | 0 | 0 | `npm test` passed `86/86`, including `map world view renders Leaflet layers, preserves actor context, and removes the map on cleanup`, `map world view renders an unavailable state when the backend disables world mode`, `map world view falls back to an unavailable state when world details fail`, and `app shell parseRoute preserves the world view param alongside actor and destination context`. |
| AC-4 | Add deterministic automated coverage for the read-only boundary and confirm the routing freeze remains documented without changing the frozen docs unnecessarily. | 0 | 0 | `npm run validate:data` passed and `npm test` passed `86/86`, covering validation, summary/details contracts, unavailable degradation, deep links, and local-map non-regression. `git diff --name-only -- docs/world` returned no output, so no doc patch was required: existing `docs/world/*.md` already matched the implemented read-only boundary and routing freeze. |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|
| Implement world routing, cross-map handoff controls, and any public `/api/world/routes/plan` surface. | AC-4 | 0 | The round delivered the frozen read-only boundary only. Existing `docs/world/*.md` already place routing behind a later contract freeze, so no documentation edit was required for this deferment. | Revisit after the step schema, enums, units/ranges, cost model, error contracts, portal selection rules, and local/world/local itinerary boundaries are frozen. |

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
| None for the read-only delivery scope after Round 0 verification. | 0 | - | Keep future routing work isolated from `/api/bootstrap`, the local SVG map path, and the frozen unavailable semantics. |
