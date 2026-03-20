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
在不改变现有路由能力、深链接行为、缓存策略和后端接口的前提下，收敛 `Map` 页面当前最明显的体验问题：让右侧地图核心卡片与全局卡片视觉语言一致，让图例与真实渲染语义一致，重建左侧控制区的信息层级与字段分组，移除暴露给终端用户的内部空状态标签和开发者式文案，并拉开主次操作与辅助文本的视觉层级。

本计划默认保留现有英文 UI 文案，但会移除不应出现在终端正文中的实现说明或深链接示例，并要求实现结果与 `docs/` 中相关文档同步。

## Acceptance Criteria

### Acceptance Criteria
<!-- Each criterion must be independently verifiable -->
<!-- Claude must extract or define these in Round 0 -->


以下验收项遵循 TDD 思路组织；每项都包含应通过的正向验证和应被阻止的反向验证。

- AC-1: 右侧地图核心卡片与页面其他卡片保持一致的圆角体系
  - Positive Tests (expected to PASS):
    - `Amber Bay` 这类目的地标题下方、图例上方的地图主画布外层容器与左侧操作面板、右下角摘要或空状态卡片使用同一套圆角标准，不再出现视觉上突兀的直角矩形。
    - 地图外层容器、内部 frame 和 SVG 画布之间的裁切关系正确，地图内容不会在圆角边界处露出直角或穿帮。
    - 样式实现优先复用现有卡片圆角 token、共享 card class 或明确的 map 局部变量，而不是额外引入一套仅此处使用的随意半径值。
  - Negative Tests (expected to FAIL):
    - 不允许右侧核心地图区域继续呈现与页面其余卡片不一致的直角或近似直角外观。
    - 不允许为 map 主卡片单独引入一个与现有卡片体系明显不一致的新圆角标准。

- AC-2: 图例、路径、端点与上下文标记共享一致的视觉语义
  - Positive Tests (expected to PASS):
    - 当存在已规划路线时，`renderRouteVisualization` 输出的 legend 项与 SVG 中实际渲染的路径和 marker 使用同一套语义映射，`Outdoor route`、`Indoor route`、`Key turn`、`Start`、`End` 都能在实际地图层中找到对应表现。
    - `Start` / `End` 在 legend 中的表达与地图上的端点标记策略一致；如果地图继续保留“形状 + 文本胶囊”，legend 也必须使用等价表示，而不是互相矛盾的几何 swatch。
    - `tests/route-visualization-markers.test.ts` 现有闭环与非闭环端点行为继续通过，且不会把 preview marker 误解释为 active route marker。
  - Negative Tests (expected to FAIL):
    - 不允许 legend 描述一种地图中根本不存在的形状、颜色或语义。
    - 不允许地图实际使用的主要端点样式与 legend 对 `Start` / `End` 的说明继续冲突。

- AC-3: 左侧控制区的信息层级和字段分组符合路由任务流
  - Positive Tests (expected to PASS):
    - `Route Planning` 成为左侧控制区的主标题，`Choose the spatial context first` 降级为说明性副文案或辅助文本，不再在层级上压过模块名。
    - `Destination` 作为空间上下文选择独立占位；`Start node` 与 `End node` 在 DOM 结构和视觉布局上作为一组连续出现，可以是垂直排列，也可以是单独分组后的并排布局。

---

## MUTABLE SECTION
<!-- Update each round with justification for changes -->

### Plan Version: 1 (Updated: Round 0)

#### Plan Evolution Log
<!-- Document any changes to the plan with justification -->
| Round | Change | Reason | Impact on AC |
|-------|--------|--------|--------------|
| 0 | Initial plan | - | - |
| 0 | Marked key AC-2/AC-3/AC-5 tasks as in_progress to signal the first implementation wave | First work started on legend semantics, control panel structure, and empty-state copy | AC-2, AC-3, AC-5 |
| 0 | Set AC-1, AC-4, and AC-6 CSS/visual tasks to in_progress to record the CSS worker kickoff | Card radius work, advanced section/button restyle, and auxiliary label contrast all started | AC-1, AC-4, AC-6 |
| 0 | Started final wave by marking docs sync and regression/test tasks in_progress | Documentation and regression coverage work now underway | AC-7, AC-8 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
| Task | Target AC | Status | Notes |
|------|-----------|--------|-------|
| Audit right-hand map card, frame, and surrounding summary containers to adopt the shared card radius tokens, verify clipping relationships, and remove any bespoke corner values | AC-1 | in_progress | Will adjust CSS/classes so the map canvas shell matches other cards |
| Centralize legend and route marker semantics (renderRouteVisualization + marker helpers) so legend items and SVG rendering draw from the same mapping and existing tests stay green | AC-2 | in_progress | Will reconcile Start/End/route swatches and keep `route-visualization-markers.test.ts` reliable |
| Restructure the left control panel: promote `Route Planning` to the dominant title, demote auxiliary copy, and group `Destination`, `Start node`, and `End node` into a cohesive spatial context block | AC-3 | in_progress | Aimed at DOM/visual grouping changes in `public/spa/views/map.js` |
| Restyle the Advanced routing section and action buttons so Advanced routing behaves like an accordion, Plan route stays primary, Clear route is ghost, and Return to Explore reads as navigation | AC-4 | in_progress | Includes updating map-side button hierarchy and any necessary hooks for regression tests |
| Remove the `Calm Empty State` label, strip developer-focused deep-link copy from hero/body, and ensure the empty state helper only surfaces user-facing text | AC-5 | in_progress | Will touch empty state helper and verify no internal names reach the UI |
| Improve auxiliary label contrast/weight for map-specific tags and ensure added styles reuse existing tokens without destabilizing other pages | AC-6 | in_progress | Requires CSS adjustments scoped to map context |
| Update `docs/user-guide.md` and `docs/journal-social-design-style.md` (and others as needed) so the documentation matches the refreshed map layout, legend semantics, and copy | AC-7 | in_progress | Documentation changes must ship alongside code |
| Expand regression coverage for map structure, legend semantics, empty state copy, and run `npm test` to confirm no behavior regressions | AC-8 | in_progress | Includes SPA regression assertions and marker/legend test checks |

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
