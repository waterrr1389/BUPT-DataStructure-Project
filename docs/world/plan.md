# World Mode Planning Reference

## Goal Description
本文件服务于 world mode 的规划与参考语境，不是当前产品事实的主来源；当前实现真相以仓库源码与测试为准，冻结设计则以 `docs/world/spec.md` 与 `docs/world/contract.md` 为准。

这份计划最初围绕“先交付 read-only world foundation，再扩展 routing”起草。当前仓库已经在该基线上落地 optional `world` seed、world 数据校验、`GET /api/world`、`GET /api/world/details`、`/map?view=world` 的 `Leaflet + CRS.Simple` UI，以及 `POST /api/world/routes/plan` 和 local/world/local handoff。本文件继续保留当时的 rollout 边界、约束和 follow-on 讨论，供后续 world mode 演进参考，而不是充当当前实现盘点。

## Acceptance Criteria

Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: `world` 作为 optional top-level seed capability 被完整建模，并且具备可回滚的数据校验边界。
  - Positive Tests (expected to PASS):
    - 不包含 `world` 的现有 seed 仍可通过校验，现有 local bootstrap、destination details、local route 行为保持不变。
    - 包含合法 `world` 记录的 seed 可以通过校验并被 runtime 正常加载。
    - `regions`、`destinations`、`graph`、`portals`、`placement.portalIds`、`portal.worldNodeId`、`portal.localNodeId` 等跨记录引用都能通过完整性检查。
  - Negative Tests (expected to FAIL):
    - 缺少必填字段、重复 id、非法坐标、未知 `regionId`、未知 `portalId`、未知 `worldNodeId` 或未知 `localNodeId` 的 `world` 数据必须被拒绝。
    - `portal.worldNodeId` 指向非 `kind = portal` 的 world node 时必须失败。
    - `world` 缺失时不允许被当成错误配置强制失败。

- AC-2: read-only world HTTP contract 被落到独立接口上，并严格保持 summary/details 边界与 bootstrap 轻量语义。
  - Positive Tests (expected to PASS):
    - `GET /api/world` 在 world 可用时返回 `enabled = true` 的轻量 summary，仅包含合同允许的 summary 字段与 capability 信息。
    - `GET /api/world/details` 在 world 可用时返回完整 `world` 详情，足以驱动 `Leaflet` 背景图层、regions、destinations、graph 和 portals。
    - `world` 缺失时，本计划额外冻结 contract 中的推荐 unavailable 语义：`GET /api/world` 返回 `enabled = false`、空数组和关闭的 capability 标记；`GET /api/world/details` 返回 `409` 与 `world_unavailable` 错误体。
  - Negative Tests (expected to FAIL):
    - `/api/bootstrap` 泄露重型 `world.graph`、`portals` 或其他 details 级字段时必须失败。
    - `GET /api/world` 返回 details 级字段，或实现偏离本计划冻结的 unavailable 状态码/错误体时必须失败。

- AC-3: `/map?view=world` 提供 read-only world surface，同时不回归现有 local map 体验。
  - Positive Tests (expected to PASS):
    - `/map?destinationId=...` 继续使用现有 SVG/local route 视图，不依赖 world 数据也不改变现有交互。
    - `/map?view=world` 会按需加载 world summary/details，并使用 `Leaflet + CRS.Simple` 初始化 world 容器。
    - world surface 至少渲染 `backgroundImage`、`regions` polygon、`destinations` marker、基础 zoom/pan，以及点击 destination 后跳转回现有 local map 的能力。
  - Negative Tests (expected to FAIL):
    - world 不可用、details 加载失败或 world 数据不合法时，页面必须显示可恢复的 unavailable/empty state，而不是破坏整个 map 页面。
    - local map 打开时如果强依赖 `Leaflet` world 容器、world details 或 world capability 才能工作，则必须失败。
    - 如果 cross-map route controls、portal handoff UI 或 world route result 区块仍处于半定义状态，则必须失败；当前仓库里的对应能力应视为已实现行为，而不是待补齐占位物。

- AC-4: 验证覆盖锁定首轮交付边界，并把 routing 扩展的前置冻结项明确化。
  - Positive Tests (expected to PASS):
    - 自动化测试覆盖 seed validation、world summary/details 合同、world unavailable 降级、world view 渲染、destination deep link，以及 local map 无回归。
    - Boston-inspired 样例数据具备可直接断言的结构约束：固定 6 个 regions、12 个 destination placements、12 个 portals、12 个 `kind = portal` nodes、4 个 chokepoint junctions，并且每个 destination placement 都至少映射一个 portal。
    - 计划或配套文档明确记录 routing follow-on 的冻结前置条件：step schema、枚举和值域、单位和范围、cost model、错误状态码与错误体、portal 选择规则、local/world/local itinerary 边界。
  - Negative Tests (expected to FAIL):
    - 在上述 routing 语义未冻结前，将 `POST /api/world/routes/plan` 以半定义状态对外暴露时必须失败；当前仓库已存在与合同和测试对齐的实现，因此这条只保留为 rollout guardrail。
    - 首轮交付如果通过合并 local/world graph 或绕开 portal 语义来“临时打通” world mode，则必须失败。

## Path Boundaries

Path boundaries define the acceptable range of implementation quality and choices.

### Upper Bound (Maximum Acceptable Scope)
首轮交付可以做到：新增 world 共享类型与校验规则、world service 与 capability 计算、`GET /api/world` 和 `GET /api/world/details`、`/map?view=world` 的 `Leaflet + CRS.Simple` 渲染、background image + region polygon + destination marker + 基础交互、Boston-inspired 可验证样例数据，以及与现有 bootstrap/local map 并存的自动化测试。这个 upper bound 描述的是原始 read-only rollout 上限；当前仓库已经继续扩展到 world route planning。

### Lower Bound (Minimum Acceptable Scope)
最小可接受交付必须做到：`world` 作为 optional seed 能力被校验并可加载；`/api/bootstrap` 保持轻量；`GET /api/world` 与 `GET /api/world/details` 满足合同；`/map?view=world` 能以 read-only 方式显示底图、regions 和 destinations；world 不可用时有稳定降级；local map 与现有 routing 没有功能回归。

### Allowed Choices
- Can use: 新增 world-scoped types、validation helpers、service module、server route、SPA helper 或 world rendering helper；沿用现有 runtime/service 组装方式；按需加载 `Leaflet` 相关浏览器资源；使用 `docs/world/examples/boston-inspired.seed-fragment.json` 作为样例对照。
- Cannot use: 将 local map 迁移到 `Leaflet`；把重型 world graph 塞进 `/api/bootstrap`；把 world graph 和 local graph 合并成一张超级图；绕开 `portal` 作为唯一桥接实体；在合同未冻结时偷偷加入半定义状态的 cross-map routing；引入真实 GIS 精度或替换 `Leaflet`。

> **Note on Deterministic Designs**: The rendering engine, world entry route, graph layering model, and bootstrap payload boundary are already frozen by the draft documents, so the main implementation choices are about module layout and load sequencing rather than product behavior.

## Feasibility Hints and Suggestions

> **Note**: This section is for reference and understanding only. These are conceptual suggestions, not prescriptive requirements.

### Conceptual Approach
一个可行的落地路径如下：

```text
seed world? -> validation -> runtime world capability
           -> world service -> GET /api/world (summary)
                            -> GET /api/world/details (details)

/map
  -> if view=world:
       request summary
       if enabled=false: render unavailable state
       else request details and initialize Leaflet + CRS.Simple
       render background image, region polygons, destination markers
       destination click -> navigate to existing local /map?destinationId=...
  -> else:
       keep existing local SVG map flow unchanged
```

这条路径的关键点是先把 read-only world 能力和 routing 扩展拆开：前者只需要合法 seed、清晰接口和稳定 UI 容器；后者需要等待 route 语义冻结，避免早期实现被未定合同反向牵制。当前仓库已经在这一分层前提上继续落地 routing。

### Relevant References
- `src/domain/models.ts` - 当前共享领域模型，适合承接 world records 与 shared enums。
- `src/services/contracts.ts` - 服务层合同定义，适合补 world summary/details 与 capability 形状。
- `src/data/seed.ts` - 当前 seed 入口，适合扩展 optional `world` 顶层数据。
- `src/data/validation.ts` - 当前数据校验入口，适合加入 world 引用完整性与值域约束。
- `src/services/runtime.ts` - runtime 装配与可选模块加载入口，适合引入 world capability 解析。
- `src/services/index.ts` - 应用服务容器，适合挂接独立 world service 而不是污染现有 local route service。
- `src/server/index.ts` - HTTP 路由注册点，适合新增 `/api/world` 与 `/api/world/details`。
- `public/spa/app-shell.ts` - SPA 共享数据加载与导航入口，适合承接 world summary/details 的按需加载。
- `public/spa/views/map.ts` - 当前 `/map` 页面逻辑，适合按 `view=world` 分支出 world surface，同时保留 local flow。
- `public/spa/world-rendering.ts` - 当前 world surface 与 world route UI 入口，适合核对已经落地的 world view、route summary 和 handoff 行为。
- `public/spa/map-rendering.ts` - 当前 local SVG map 渲染基线，world work 不应破坏这里的 local behavior。
- `tests/data-seed.test.ts` - 适合补 seed/world validation 覆盖。
- `tests/integration-smoke.test.ts` - 适合补 world HTTP contract 与 unavailable 降级验证。
- `tests/spa-regressions.test.ts` - 适合补 `/map?view=world` 渲染与 local map 无回归的浏览器侧测试。
- `docs/world/contract.md` - world 数据与 HTTP 合同的冻结来源。
- `docs/world/examples/boston-inspired.seed-fragment.json` - world 样例数据与 Boston-inspired 空间逻辑对照。

## Dependencies and Sequence

### Milestones

以下顺序反映原始 rollout 依赖关系，不表示当前仓库仍停留在这些里程碑之前。
1. World Data Foundation: 定义 world records、optional seed shape 与完整校验边界。
   - 扩展 shared models 和 service contracts。
   - 扩展 seed loading 与 validation，覆盖必填字段、唯一性、坐标、引用完整性和 portal 约束。
   - 让样例数据能作为验证 world 结构的测试夹具。
2. World Read-Only Service Surface: 将 world summary/details 与 capability 做成独立服务和接口。
   - 新增 world service，输出 summary、details 和 capability。
   - 新增 `GET /api/world` 与 `GET /api/world/details`。
   - 确保 `/api/bootstrap` 继续轻量，且不承载重型 world graph。
3. World SPA Surface: 在不破坏 local map 的前提下接入 world UI。
   - 在 `/map` 视图里按 `view=world` 分流。
   - 初始化 `Leaflet + CRS.Simple`，渲染底图、regions、destinations 和 unavailable state。
   - 保持 world click-through 到现有 local map 的深链接能力。
4. Routing Contract Freeze: 在实现 routing 前把未冻结合同补齐。
   - 冻结 `WorldRouteStep` 结构、枚举和值域、单位与范围、cost model、错误状态码与错误体。
   - 冻结 portal 选择规则与 local/world/local itinerary 的拼装边界。
5. World Routing Follow-On: 在 read-only milestone 稳定后再扩展 route。
   - 实现 `POST /api/world/routes/plan`。
   - 实现 portal transfer cost、world polyline、route explanation。
   - 实现 local-world-local handoff，且不重写现有 local map。
   - 当前仓库已经包含这一 follow-on 的实现；这里保留的是依赖顺序与设计边界。

这几个里程碑必须按依赖顺序推进：先稳定 data/contract，再接 service，再接 SPA，最后才进入 routing。若 routing 冻结项未完成，就不应开始 world route implementation。

## Implementation Notes

### Code Style Requirements
- Implementation code and comments must NOT contain plan-specific terminology such as `AC-`, milestone labels, or similar workflow markers.
- These labels belong in planning artifacts only; implementation should use domain-specific naming such as `worldSummary`, `worldDetails`, `portalTransferCost`, or `worldCapability`.
- Code comments should explain domain intent or non-obvious constraints, not development process.

### Delivery Guardrails
- `world` 缺失必须继续被视为合法配置，系统需要稳定降级，而不是要求所有 seed 立即补 world 数据。
- `placement.x/y` 与 `world node.x/y` 必须在代码和测试里保持不同语义：前者用于视觉落点，后者用于拓扑锚点。
- 新增的 world 逻辑应尽量放入独立 world-scoped 模块，减少对现有 local route service 和 local SVG rendering 的侵入，便于回滚。
- `contract.md` 对 unavailable HTTP 响应使用了“推荐返回”措辞；本计划已将该推荐语义额外冻结为实现与测试边界，避免 world availability 行为在首轮交付中漂移。
- 当 world mode 的总目标需要与早期实现范围取舍时，本计划以“先稳定 read-only world foundation，再扩展 routing”为边界；当前仓库已越过这条历史边界，但继续演进时仍应保持该分层。

--- Original Design Draft Start ---

# World Mode Spec

## Goal

在保留现有各 `destination` 局部地图与局部路由能力不变的前提下，引入一个新的 world mode，用于：

- 展示多个 `destination` 的大地图分布
- 支持跨 `destination` 的世界级导航
- 保持实现复杂度可控，并优先复用成熟地图能力

## Frozen Decisions

以下约束已经冻结：

- world mode 的前端地图实现必须使用 `Leaflet + CRS.Simple`
- 不再把“继续零依赖手写大地图交互层”当成默认方案
- 现有 local map 继续保持 SVG 渲染，不迁移到 `Leaflet`
- world mode 继续放在 `/map?view=world`
- world graph 与 local graph 分层存在，不合并成一张超级图
- `portal` 是 world 与 local 之间唯一合法桥接实体
- `/api/bootstrap` 保持轻量，不承载重型 world graph

## Product Shape

用户体验分两层：

- world layer
  - 浏览大地图
  - 缩放
  - 拖动
  - 点击地点
  - 查看世界级路线
- local layer
  - 继续沿用当前 `/map` 的地点内规划
  - 使用现有节点、边和局部路由能力

## Rendering Baseline

world mode 的渲染基线如下：

- `Leaflet` 负责地图容器、图层、marker、polyline、bounds、zoom、pan
- `CRS.Simple` 负责平面坐标系
- `backgroundImage` 作为 world 底图资源
- `regions` 主要用于 polygon 展示、hover、解释性分区
- `destinations` 主要用于 marker placement 和交互落点
- `graph` 主要用于世界级路径规划与 polyline 解释

这意味着：

- world 的 `width` 与 `height` 直接对应 `Leaflet` 的矩形平面世界
- `placement.x/y` 是视觉锚点
- `world node.x/y` 是拓扑锚点

## Architecture

## Data Layer

- `destination.graph`
  - 保持不变
  - 继续只描述单个地点内部拓扑
- `world`
  - 新增在 seed 顶层
  - 描述世界底图、区域、placement、world graph、portal

## Routing Layer

- local routing
  - 继续使用现有 `/api/routes/plan`
- world routing
  - 新增 `/api/world/routes/plan`
  - 负责 world-only 或 cross-map itinerary

## UI Layer

- `/map?view=world`
  - 作为 world 子模式入口
- `/map`
  - 保持现有局部地图规划器角色

## Scope

## First Delivery (Historical Baseline)

以下内容描述原始首轮范围，不是当前仓库的完整能力边界：

- world 数据模型
- world API summary/details
- world capability 判断
- `Leaflet` world 容器初始化前提

当时第一轮不要求：

- 完整 cross-map routing 实现
- local-world-local itinerary 拼装
- 复杂 overlay
- 真实 GIS 导入

## Later Delivery (Historical Baseline)

以下内容描述原始 follow-on 范围；当前仓库已经实现其中的 world routing、route handoff 和 explanation 相关能力：

- `POST /api/world/routes/plan`
- portal transfer 成本落地
- world polyline 展示
- world 与 local 的 route handoff
- 更完整的 zoom / pan / route explanation

## Boston-Inspired Layout Rules

Boston 参考只用于空间逻辑，不用于复制真实 Boston 地图。

需要保留的空间规律：

- 水体先切分空间
- 桥和隧道决定跨区连通
- 主干线少而强
- hub 长在 choke point，不长在几何中心
- 世界图必须明显不对称

对当前六区的约束：

- `river arc`
  - 既是滨水带，也是交通中枢
- `harbor line`
  - 更像外港或半岛，只通过少量桥隧进入
- `central axis`
  - 是世界图的主陆上走廊
- `north belt`
  - 偏桥头与北向入口区，不是平铺 scenic 大片区
- `west ridge`
  - 是西向 campus / research 高地
- `east loop`
  - 是生活化、市场化的环带，而不是孤立飞地

## Terminology

## `destination`

- 已存在的地点实体
- 是 local map 的宿主

## `local map`

- 某个 `destination` 的局部地图
- 不会被 world map 替换

## `world map`

- 新增的大地图模式
- 用于跨地点浏览与导航

## `world graph`

- 世界级抽象路网
- 不等同于 OSM 原样道路

## `portal`

- world 与 local 的唯一合法桥接实体
- 负责 world node 与 local node 的跨层连接

## `placement`

- `destination` 在 world 上的视觉落点
- 只服务 marker、label、hover、点击热区

## `hub`

- 区域汇聚点或换乘核心

## `junction`

- chokepoint / bridgehead / tunnel mouth / connector

## `mixed`

- 规划模式
- 不是独立物理交通工具

## Implementation Order (Historical)

建议顺序：

1. world models
2. world API summary/details
3. world service 接入
4. `Leaflet` world container
5. world route planning

## Non-Goals

本轮不做：

- 重写 local map
- 引入 React
- 评估其他地图引擎替代 `Leaflet`
- 追求 GIS 精确坐标

--- Original Design Draft End ---
