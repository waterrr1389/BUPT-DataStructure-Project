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
  - Negative Tests (expected to FAIL):
    - 不允许继续出现 `Destination` 与 `Start node` 并列、但 `End node` 被拆到另一视觉组的布局。
    - 不允许辅助说明继续以更高视觉权重替代模块标题。

- AC-4: 高级选项和按钮层级符合常见交互预期
  - Positive Tests (expected to PASS):
    - `Advanced routing` 采用明确的 accordion / disclosure 表达，去除当前类似拖拽上传区或未激活态的虚线外框观感。
    - `Plan route` 是控制区唯一 primary action；`Clear route` 明确为 ghost / secondary；`Return to Explore` 表现为返回导航。
    - `tests/spa-regressions.test.ts` 新增 DOM/class 断言，验证主次按钮结构与返回链接角色。
  - Negative Tests (expected to FAIL):
    - 不允许 `Advanced routing` 继续保留虚线边框的上传区暗示。
    - 不允许次级操作在视觉权重上接近或混淆 primary action。

- AC-5: 地图页面的用户可见文案不暴露内部命名、实现说明或深链接示例
  - Positive Tests (expected to PASS):
    - `#map-route-result` 空状态保留 `Route summary appears after planning` 及解释性文本，不再显示 `Calm Empty State`。
    - Hero/body 不再包含 `Direct entry works on /map?...` 之类开发者式 deep-link 示例；必要说明放入 docs。
    - 相关 helper 改动保持其他页面结构无残留。
    - `tests/spa-regressions.test.ts` 验证空状态/hero copy 中没有内部命名。
  - Negative Tests (expected to FAIL):
    - 不允许任何设计系统内部名、组件占位名或开发备注出现在终端 UI。
    - 不允许把原始 query path 或调试提示混入面向用户的正文或核心信息区。

- AC-6: 辅助标签和次级文案的可读性提升，但不破坏全站主题层级
  - Positive Tests (expected to PASS):
    - `Route Planning`、`Spatial context` 等 map 标签使用更强颜色 token / map 专用样式，确保浅色背景下可读。
    - 样式调整通过现有 token 或 map 局部类完成，不影响其他页面。
    - 桌面和窄屏人工检查确认辅助标签、返回导航、ghost button 层级清晰。
  - Negative Tests (expected to FAIL):
    - 不允许继续依赖过浅的对比度承载关键语义标签。
    - 不允许全局 `.section-tag` 等被粗暴加深，影响 Explore/Feed 等其他页面。

- AC-7: 实际代码与 `docs/` 中的相关说明保持同步
  - Positive Tests (expected to PASS):
    - Map 结构、视觉层级、用户可见文案或设计约束变化后，相关文档（至少 `docs/user-guide.md` 与 `docs/journal-social-design-style.md`）同步更新。
    - 文档中 map 描述与实际 shipped UI 一致，不保留已移除的直角卡片或 dev copy。
    - 代码与 docs 改动同步交付，不留空档。
  - Negative Tests (expected to FAIL):
    - 不允许代码调整完成但 `docs/` 仍描述旧版地图结构或文案。
    - 不允许只改文档没改 UI 或只改 UI没改文档。

- AC-8: 现有 map 行为回归全部守住
  - Positive Tests (expected to PASS):
    - 保持 destination fallback、actor context、renderless URL rewrite、初始地图渲染、端点 marker 行为和 route summary 占位状态不变。
    - 引入的 helper 改动在其他 SPA 页面不产生结构性回归。
    - `npm test` 全量通过，路由渲染/legend/marker 相关测试仍绿。
  - Negative Tests (expected to FAIL):
    - 不允许 UI 重构破坏深链接 `/map?destinationId=...&from=...&to=...`。
    - 不允许视觉层改动顺带改变 route planning 请求参数、scene cache 或 marker 语义。

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
| 0 | Closed Round 0 after resolving radius/legend review findings and verifying all tests | New map shell, legend semantics, copy, docs, and tests proved complete via the provided commit evidence and `npm test` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 |

#### Active Tasks
<!-- Map each task to its target Acceptance Criterion -->
*No Active Tasks remain this round; all work is captured under Completed and Verified.*

### Completed and Verified
<!-- Only move tasks here after Codex verification -->
| AC | Task | Completed Round | Verified Round | Evidence |
|----|------|-----------------|----------------|----------|
| AC-1 | Audit right-hand map card, frame, and surrounding summary containers to adopt shared radius tokens, verify clipping, and remove bespoke corner values | 0 | 0 | `ea75c25` reorganized the map route panel shell and `fa2d82a` locked down the radius scope |
| AC-2 | Centralize legend and route marker semantics so legend items and SVG rendering share a single mapping | 0 | 0 | `cf9ef7a` aligned route legend semantics with rendered markers and `3b4a1e1` fixed transition badge mismatches |
| AC-3 | Restructure the left control panel with clearer title hierarchy and grouped Destination/Start/End controls | 0 | 0 | `ea75c25` reshaped the route planning hierarchy and field grouping |
| AC-4 | Restyle the Advanced routing section and action buttons to clarify primary/secondary roles | 0 | 0 | `055fafd` tightened the advanced panel styling and button hierarchy |
| AC-5 | Remove the `Calm Empty State` label and developer deep-link copy while keeping user-facing text consistent | 0 | 0 | `b05b92e` updated the empty-state helper output |
| AC-6 | Improve auxiliary label contrast/weight via map-scoped styles | 0 | 0 | `055fafd` refreshed label styles with stronger map-specific tokens |
| AC-7 | Sync documentation (`docs/user-guide.md`, `docs/journal-social-design-style.md`, etc.) with the new map layout and copy | 0 | 0 | `f10738f` aligned docs with the refreshed interface |
| AC-8 | Extend regression coverage for map structure, legend semantics, empty state copy, and confirm via `npm test` | 0 | 0 | `97b97d8` added SPA regression assertions and local `npm test` (73 passed/0 failed) confirms no regressions |

### Explicitly Deferred
<!-- Items here require strong justification -->
| Task | Original AC | Deferred Since | Justification | When to Reconsider |
|------|-------------|----------------|---------------|-------------------|

### Open Issues
<!-- Issues discovered during implementation -->
| Issue | Discovered Round | Blocking AC | Resolution Path |
|-------|-----------------|-------------|-----------------|
*No open issues remain this round; previous radius and legend mismatches were resolved and verified.*
