# World Mode Implementation Plan

## Goal Description

本计划用于把 `world mode` 从草案推进到可实现、可验证、可回滚的仓库内方案，覆盖数据模型、seed 接入、校验、服务层、HTTP 合同、浏览器接入、文档同步和测试闭环。

本计划以以下输入为准：

- `world-models-draft.md`
- `world-api-contract-draft.md`
- `world-map-review-glossary.md`
- `world-map-boston-inspired.seed-fragment.json`
- 当前仓库实际实现边界，包括 `src/domain/models.ts`、`src/data/*`、`src/services/*`、`src/server/index.ts`、`public/spa/views/map.js`、`tests/*`、`docs/*`

本计划解决的关键问题：

- 在不破坏现有 local map 和 `/api/routes/plan` 的前提下，引入可选的 `world` 能力。
- 冻结 `portal`、`mixed`、跨层成本和失败语义，避免前后端各自解释。
- 让接口定义在计划中保留可读快照，同时把真正的代码事实收敛到少量源文件，防止上下文丢失和类型漂移。
- 保证 `docs/` 下说明文档与实际接口、数据结构和测试结论一致。

本计划默认以下约束为硬约束：

- `SeedData.world` 为可选字段，缺失时视为 capability 关闭，不视为数据损坏。
- `/api/bootstrap` 继续保持轻量，不承载 `world.graph` 或 `portals`。
- local graph 与 world graph 不合并成单一图。
- `portal` 是 world 与 local 之间唯一合法桥接实体。
- `mixed` 是规划模式，不是物理交通方式。
- `portal` 不作为独立 leg scope。
- 采用 TDD 顺序推进，每个实现面先补失败测试，再补实现，再补文档。

## Canonical Sources

### Source-Of-Truth Strategy

- 本计划保留 compact contract snapshot，确保在实现期间即使上下文切换也不会丢掉接口边界。
- 真正的代码事实应收敛在少数文件中，避免现有 `src/domain/models.ts` 与 `src/services/contracts.ts` 的重复模式继续扩散。
- 推荐的最终事实源如下：
  - world 领域模型：`src/domain/world-models.ts`
  - service / transport 合同：`src/services/contracts.ts`
  - seed 形态：`src/data/seed.ts` 与必要的 world seed 辅助文件
  - 约束校验：`src/data/validation.ts`
  - HTTP 行为：`src/server/index.ts`
  - 文档事实：`docs/data-structures-and-dictionary.md`、`docs/module-design.md`、`docs/overall-design.md`

### Draft Alignment Decisions

- `world-models-draft.md` 冻结 world record 语义。
- `world-api-contract-draft.md` 冻结 `/api/world`、`/api/world/details`、`/api/world/routes/plan` 的职责边界和错误语义。
- `world-map-review-glossary.md` 作为术语纠偏基线，防止把 world mode 误解为 GIS、OSM 导入或 local map 重构。
- `world-map-boston-inspired.seed-fragment.json` 作为 MVP 示例数据和测试夹具参考，不等同于必须直接照搬的唯一运行时组织方式。
- world 系列 endpoint 在 MVP 中统一返回 bare payload，不额外包裹 `{ item: ... }`；现有 local `/api/routes/plan` 保持原合同不变。
- `POST /api/world/routes/plan` 的 destination-to-destination 请求固定返回 `scope = "world-only"`，local-node-to-local-node 请求固定返回 `scope = "cross-map"`。
- 半本地请求、同 destination 的 world 请求、未知 destination/local node id、缺失必需字段都归类为 `400 invalid_world_request`，而不是 `reachable: false`。

## Acceptance Criteria

Following TDD philosophy, each criterion includes positive and negative tests for deterministic verification.

- AC-1: Seed 与领域模型支持可选 world payload，并对 world 数据做独立且严格的引用校验。
  - Positive Tests (expected to PASS):
    - `seedData` 不含 `world` 时，现有 `npm run validate:data` 和 `tests/data-seed.test.ts` 继续通过。
    - 接入 `world-map-boston-inspired.seed-fragment.json` 对应的 world payload 后，`validateSeedData` 可以通过 world 专属校验并保留现有最小数量约束。
    - `placement.destinationId`、`portal.destinationId`、`portal.localNodeId`、`portal.worldNodeId`、`edge.from/to`、`regionId` 等引用均能映射到真实实体。
  - Negative Tests (expected to FAIL):
    - 校验拒绝 `portal` 引用不存在的 `destinationId`、`localNodeId` 或非 `kind = portal` 的 `worldNodeId`。
    - 校验拒绝 world node / edge / portal 与 local id 空间冲突。
    - 校验拒绝 `placement.portalIds` 指向其他 destination 的 portal。

- AC-2: world capability 以“可选能力”形式进入 runtime，不改变现有 bootstrap 的轻量边界。
  - Positive Tests (expected to PASS):
    - `createAppServices()` 在 `world` 缺失时仍能正常启动，local route、destination、journal、facility 等现有能力不受影响。
    - `bootstrap()` 的字段集合保持轻量，不新增重型 world graph。
    - runtime 能明确区分 `world enabled` 与 `world disabled` 两种状态，并供后续服务层复用。
  - Negative Tests (expected to FAIL):
    - world 缺失不能导致服务初始化抛错或让 `/api/bootstrap` 返回 5xx。
    - bootstrap 响应中不允许混入 `graph`、`portals`、route geometry 等重型 world 字段。

- AC-3: `GET /api/world` 提供轻量摘要入口，并在 capability 关闭时返回可用但禁用的响应。
  - Positive Tests (expected to PASS):
    - 有效 world 数据时返回 `200`，并包含 `enabled`、轻量 `world`、`regions`、轻量 `destinations`、`capabilities`。
    - capability 关闭时返回 `200`，并返回 `enabled: false`、空数组和 `worldView: false` 等能力标记。
    - 摘要返回的数据足够驱动 world 入口判断和基础列表 / marker 展示。
  - Negative Tests (expected to FAIL):
    - 响应中不允许暴露 `graph`、`portals`、完整 route 结果。
    - capability 关闭时不能伪装成服务器故障或 404 endpoint 缺失。

- AC-4: `GET /api/world/details` 只在需要时返回重型详情，并在能力关闭或数据失效时给出结构化错误。
  - Positive Tests (expected to PASS):
    - 有效 world 数据时返回 `200`，并提供完整 `world` payload，包括 `regions`、`destinations`、`graph`、`portals`。
    - 前端或测试只在显式需要详情时请求该 endpoint，不把它并入 bootstrap。
  - Negative Tests (expected to FAIL):
    - capability 关闭时返回 `409` + `code = world_unavailable`。
    - runtime 发现 world 数据引用不完整时返回 `500` + `code = invalid_world_data`，而不是静默吞错。

- AC-5: `POST /api/world/routes/plan` 支持 world-only 和 cross-map 两类规划，并正确执行成本公式与 mixed 语义。
  - Positive Tests (expected to PASS):
    - destination-to-destination 请求返回 `world-only` itinerary，且不包含 destination leg，`legs`、`summary`、`usedModes`、`totalDistance`、`totalCost` 与样例 world 数据一致。
    - local-node-to-local-node 请求可正确组合起点 local leg、world leg、终点 local leg，并累计 portal 单次 transfer 成本。
    - `mixed` 规划在显式可用模式中选最低成本方案，成本相同时使用稳定 tie-break：`shuttle`、`bike`、`walk`。
  - Negative Tests (expected to FAIL):
    - 请求参数缺失、组合不合法或目标不可解析时返回 `400` + `code = invalid_world_request`。
    - capability 关闭时返回 `409` + `code = world_unavailable`。
    - 实现不能把 `mixed` 当作独立物理交通方式直接参与真实边模式判定。

- AC-6: 不可达路线、portal 过渡和 failure 语义必须稳定且可解释。
  - Positive Tests (expected to PASS):
    - `reachable = false` 时允许返回已规划成功的前缀 legs。
    - `failure.stage`、`failure.reason`、`blockedFrom`、`blockedTo` 能说明首次失败发生位置。
    - portal 过渡通过 `entryPortalId` / `exitPortalId` 或 step metadata 表达，不额外制造虚假的 `portal` leg。
  - Negative Tests (expected to FAIL):
    - itinerary 与 `legs[]` 中不允许出现 `scope = portal`。
    - 不可达 world 段不能被错误包装成 `500` 内部错误。
    - `direction = bidirectional` 不能被解释成单次穿越双倍计费。

- AC-7: 浏览器中的 world mode 作为 local map 的并存子模式接入，不回归现有 `/map` 体验。
  - Positive Tests (expected to PASS):
    - 现有 local `/map` 流程、预览、路由结果和测试保持可用。
    - world mode 入口能够先拿 summary，再按需拿 details，并展示 world marker / region / route 结果和不可用提示。
    - 用户可在 world 视图与 destination 视图之间完成 handoff，而不破坏现有 `actor` / route param 语义。
  - Negative Tests (expected to FAIL):
    - local mode 不得错误请求 `/api/world/details` 或替换现有 `/api/routes/plan`。
    - capability 关闭时不能让 `/map` 页进入空白、死循环请求或无解释错误。

- AC-8: 文档与示例结果同步更新，并明确 world mode 与 local map 的职责边界。
  - Positive Tests (expected to PASS):
    - `README.md` 与 `docs/` 中的核心设计、模块、数据结构、用户指南、示例结果都反映 world mode 新边界。
    - 文档说明与 HTTP 合同、seed 形态、测试结论保持一致。
    - 若新增 world 专项文档，其来源和权威级别在计划中明示。
  - Negative Tests (expected to FAIL):
    - 文档不能把 `portal` 描述成独立 route leg。
    - 文档不能把 `mixed` 描述成物理交通模式。
    - 文档不能声称 `/api/bootstrap` 返回完整 world graph。

- AC-9: 最终改动维持可运行、可验证、可回滚的最小质量标准。
  - Positive Tests (expected to PASS):
    - `npm run build`、`npm run validate:data`、`npm test` 全部通过。
    - 新测试接入 `tests/index.ts` 并覆盖 data、runtime/service、server、SPA 的关键路径。
    - 当 `seedData.world` 移除或 capability 关闭时，系统能自然降级到现有 local-only 行为。
  - Negative Tests (expected to FAIL):
    - world mode 的引入不能要求一次性重写现有前端、服务容器或 local route service。
    - world mode 的关闭不能破坏现有 demo、server 或 smoke 测试。

## Path Boundaries

Path boundaries define the acceptable range of implementation quality and choices.

### Upper Bound (Maximum Acceptable Scope)

实现覆盖以下完整链路，同时不额外扩张到 GIS 或大规模框架改造：

- world 领域模型独立成型，并与 seed、validation、runtime 对齐。
- `/api/world`、`/api/world/details`、`/api/world/routes/plan` 全部落地。
- world route planner 能组合 local leg 与 world leg，并正确处理 portal、mixed、failure 和 transfer 成本。
- 浏览器 `/map` 页面支持 world 子模式、懒加载 details、渲染 route 结果、处理 capability disabled。
- `README.md` 与关键 `docs/` 文档完成同步。
- 新增或改写测试覆盖数据、服务、HTTP、SPA 关键路径。

### Lower Bound (Minimum Acceptable Scope)

最小可接受实现必须仍满足全部 AC，但可以在表现层保持简化：

- 数据层和服务层完整支持 world capability。
- 三个 world API endpoint 可用且测试完备。
- 浏览器至少能完成 world capability 探测、详情加载、基本 world 渲染和 route 结果展示。
- world UI 可以先保持功能性展示，不要求复杂动画、GIS 样式系统或高保真美术交互。

### Allowed Choices

- Can use:
  - 新增 `src/domain/world-models.ts` 承载 world 记录定义。
  - 在 `src/services/` 下新增专门的 world service / planner 模块，而不是把所有逻辑塞回现有 `route-service.ts`。
  - 通过 `resolveJsonModule` 直接导入 `world-map-boston-inspired.seed-fragment.json`，或通过一个明确的 adapter / snapshot module 转换为运行时所需结构。
  - 在 `public/spa/` 下新增 world rendering 辅助模块，前提是不引入前端框架重写。
  - 在计划中保留 contract snapshot，并在实现时同步更新 `docs/data-structures-and-dictionary.md`。
- Cannot use:
  - 把 world graph 塞进 `/api/bootstrap`。
  - 把 local graph 和 world graph 合并为一张共享 id 空间的大图。
  - 让 `portal` 成为独立 leg scope。
  - 把 `mixed` 当成物理交通方式。
  - 用 world route 替换现有 `/api/routes/plan` 的单 destination 语义。
  - 引入 React、Express、bundler 重构或真实 GIS / OSM 导入，作为 MVP 前提。

> **Note on Deterministic Designs**: 当前草案对 world 能力的职责边界已经比较固定，因此 path boundaries 的选择空间主要集中在“模块组织方式”和“浏览器渲染实现方式”，而不是合同本身。接口边界、失败语义和成本模型应视为固定约束，不作为可随意变化的实现选择。

## Feasibility Hints and Suggestions

> **Note**: This section is for reference and understanding only. These are conceptual suggestions, not prescriptive requirements.

### Contract Preservation Strategy

- 计划文件中保留 compact contract snapshot，避免实现中反复回看多个草案。
- 若实现期间 world 合同需要单独文档承载，优先新增一个集中说明文档并在本计划中引用，而不是把字段语义分散写进多个 notes 文件。
- 代码中的 contract source-of-truth 应尽量少：
  - world records 只定义一次。
  - service transport shapes 只定义一次。
  - 文档中的字段描述直接引用这些事实源，而不是重复创造新术语。

### Conceptual Approach

建议按“先基础事实，再能力封装，再交付层”的顺序推进：

1. 先冻结 world records、HTTP contracts 和 validation rules。
2. 再把 world 数据并入 runtime，并保持 capability 可关闭。
3. 然后实现 world summary/details/service 与 planner。
4. 再把 server endpoint 暴露出来，并用 integration test 固定行为。
5. 最后在 SPA 中增加 world 子模式，让本地模式和世界模式共存。
6. 所有功能落地后同步更新 `docs/` 与示例结果。

world 路由推荐采用组合式实现而不是合并式实现：

- local 段继续复用现有 routing helper / route service 能力。
- world 段单独在 world graph 上计算。
- cross-map itinerary 由编排层把 local prefix、world segment、local suffix 组合出来。
- portal 负责层级切换和 transfer 成本累计，不承担独立 leg 展示职责。

对于样例 seed 的 `allowedModes` 包含 `mixed` 的情况，推荐采取兼容读取 + 规划归一化策略：

- 校验层允许样例数据在兼容模式下保留 `mixed`。
- 规划层计算时只在显式模式集合中求最优路径。
- 若保留 `mixed` 出现在 seed 中，应在实现注释和文档中明确其仅为兼容输入，不代表真实 edge mode。

### Relevant References

- `src/domain/models.ts` - 当前 shared travel entities 和 `SeedData` 形态
- `src/data/seed.ts` - runtime 实际 seed 入口
- `src/data/validation.ts` - 现有 referential integrity 和数量约束
- `src/services/contracts.ts` - 当前 service contract 集中定义位置
- `src/services/runtime.ts` - runtime 能力加载与 capability 降级落点
- `src/services/index.ts` - service container 和 bootstrap 汇总落点
- `src/services/route-service.ts` - local route 行为基线
- `src/server/index.ts` - HTTP 路由与错误映射入口
- `public/spa/app-shell.js` - SPA fetch / route / cache 入口
- `public/spa/views/map.js` - local map 现有 UI 和最可能承接 world 子模式的地方
- `tests/data-seed.test.ts` - seed 与 lookup 一致性测试
- `tests/runtime-services.test.ts` - service / runtime 行为测试
- `tests/integration-smoke.test.ts` - server handler 与 endpoint 合同测试
- `tests/spa-regressions.test.ts` - `/map` 页面回归测试

## Dependencies and Sequence

### Milestones

1. Contract Freeze And TDD Scaffold
   - 把本计划中的 contract snapshot 固定下来，作为实现期间的审查基线。
   - 先补 world data / service / HTTP / SPA 的失败测试或测试占位。
   - 明确哪些字段属于领域模型，哪些属于 transport shape，避免先实现后返工。

2. Domain And Seed Foundation
   - 新增 world 领域模型文件，扩展 `SeedData` 使其支持可选 `world`。
   - 决定 world 示例数据是直接 JSON 导入还是通过 adapter 落地。
   - 扩展 `src/data/validation.ts`，加入 world 专属 referential checks、id 空间检查和 portal 约束。
   - 确保 `scripts/validate-data.ts` 与 `tests/data-seed.test.ts` 可以验证 world on / off 两种状态。

3. Runtime And World Services
   - 在 runtime 或单独 service 中抽象 world capability 判断逻辑。
   - 实现 world summary / details 的 shaping。
   - 实现 world route planner，组合 local route 与 world graph route，并产出稳定 itinerary。
   - 为 mixed、transfer、failure、partial legs 增加 service 级测试。

4. HTTP Delivery
   - 在 `src/server/index.ts` 接入三个 world endpoint。
   - 对 `400`、`409`、`500` 错误做结构化映射。
   - 使用 integration tests 固定 response shape、status code 和 capability disabled 行为。

5. Browser World Mode
   - 扩展 route params / app shell 缓存能力，使 `/map` 可以按子模式工作。
   - 先请求 `GET /api/world`，再按需请求 `GET /api/world/details`。
   - 在 map 视图中提供 world summary、route request、failure state、handoff 到 local map 的交互。
   - 用 SPA regression tests 保证 local map 未回归。

6. Docs Synchronization And Final Verification
   - 更新 `README.md` 与关键 `docs/` 文件。
   - 把 world module、HTTP endpoint、数据结构和用户路径写入文档。
   - 最终运行 `npm run build`、`npm run validate:data`、`npm test`，记录验证结论。

### Dependency Notes

- Domain / validation 未稳定前，不应先写 HTTP handler。
- HTTP 合同未稳定前，不应先写大量 SPA 交互细节。
- SPA world mode 必须以 capability on / off 两种状态都可验证为前提。
- 文档更新必须放在实现末尾统一复核，但不能拖到代码合入后再补。

## Documentation Synchronization

以下文档应与实际实现同步更新，至少覆盖对应变化点：

- `README.md`
  - 增加 world mode 能力概览、world API 简介和 capability 可关闭说明。
- `docs/overall-design.md`
  - 补充 world layer、world service、world endpoint 和 world browser flow。
- `docs/module-design.md`
  - 增加 world 相关模块职责与依赖规则。
- `docs/data-structures-and-dictionary.md`
  - 补充 world records、portal、world itinerary、failure 与 endpoint 字段。
- `docs/example-results-and-tests.md`
  - 补充新的 endpoint、测试覆盖和可达 / 不可达示例。
- `docs/user-guide.md`
  - 补充 world mode 的入口、可用性提示、跨地点路线查看方式。

如需新增 world 专项文档，建议新增后立即在上述文档中建立链接关系，避免 world 事实只存在孤立草案文件中。

## Contract Snapshots

### Seed And Capability Snapshot

- `SeedData`
  - 既有字段保持不变：`version`、`generatedAt`、`facilityCategories`、`destinations`、`users`、`journals`
  - 新增可选字段：`world?`
- `world` 缺失时：
  - local route、facility、journal、destination 等能力继续可用
  - `/api/world` 返回 capability disabled
  - `/api/world/details` 与 `/api/world/routes/plan` 返回 `409`
- `world` 存在时：
  - 必须通过 world 专属 referential checks
  - 不得削弱既有 destination / user / journal 最小数量约束

### Domain Record Snapshot

#### `WorldMapRecord`

- Required fields:
  - `id: string`
  - `name: string`
  - `width: number`
  - `height: number`
  - `backgroundImage: string`
  - `regions: WorldRegionRecord[]`
  - `destinations: WorldDestinationPlacement[]`
  - `graph: WorldGraphRecord`
  - `portals: DestinationPortalRecord[]`
- Invariants:
  - world 层 `id` 唯一
  - `width` / `height` 为 world 平面边界事实
  - MVP 不保留 `bounds`

#### `WorldRegionRecord`

- Required fields:
  - `id: string`
  - `name: string`
  - `polygon: Array<[number, number]>`
  - `tags: string[]`
- Invariants:
  - `region.id` 在 world 内唯一
  - `polygon` 使用 world 坐标系
  - `polygon` 至少包含 `3` 个点，MVP 不要求首尾重复闭合点
  - MVP 不做自交检测，也不要求 placement 必须落在 polygon 内部
  - `tags` 为非空字符串数组，推荐去重；若实现已有统一 tag 校验，可直接复用
  - 默认只承载视觉边界和解释语义，不强制参与路由碰撞

#### `WorldDestinationPlacement`

- Required fields:
  - `destinationId: string`
  - `label: string`
  - `x: number`
  - `y: number`
  - `radius: number`
  - `regionId: string`
  - `portalIds: string[]`
  - `iconType: string`
- Invariants:
  - `destinationId` 必须引用已有 destination
  - `portalIds` 中所有 portal 必须都属于同一 `destinationId`
  - `x / y` 是视觉锚点，不等于必须与 portal node 重合

#### `WorldGraphRecord`

- Required fields:
  - `nodes: WorldNodeRecord[]`
  - `edges: WorldEdgeRecord[]`

#### `WorldNodeRecord`

- Required fields:
  - `id: string`
  - `x: number`
  - `y: number`
  - `kind: "portal" | "junction" | "hub" | "region-center"`
  - `label: string`
  - `tags: string[]`
- Optional fields:
  - `destinationId?: string`
- Invariants:
  - world node id 与 local node id 空间分离
  - `kind = portal` 时应存在对应 portal 记录
  - `destinationId` 只在 `portal` 或确有必要的直接 destination 语义时出现

#### `WorldEdgeRecord`

- Required fields:
  - `id: string`
  - `from: string`
  - `to: string`
  - `distance: number`
  - `roadType: "road" | "rail" | "trail" | "ferry" | "tunnel" | "airlift" | "bridge"`
  - `allowedModes: TravelMode[]`
  - `congestion: number`
  - `bidirectional: boolean`
- Invariants:
  - world edge 只连接 world node
  - `distance` 和 `congestion` 进入 world cost 公式
  - `mixed` 不是物理交通类型；若样例数据保留 `mixed`，实现时应归一化为显式模式选择

#### `DestinationPortalRecord`

- Required fields:
  - `id: string`
  - `destinationId: string`
  - `worldNodeId: string`
  - `localNodeId: string`
  - `portalType: "main-gate" | "dock" | "bike-entry" | "shuttle-stop"`
  - `label: string`
  - `priority: number`
  - `allowedModes: TravelMode[]`
  - `direction: "bidirectional" | "world-to-local" | "local-to-world"`
  - `transferDistance: number`
  - `transferCost: number`
- Invariants:
  - `worldNodeId` 必须指向 `kind = portal` 的 world node
  - `localNodeId` 必须指向该 destination 中真实存在的 local node
  - `transferDistance` 与 `transferCost` 表示单次穿越成本
  - `direction = bidirectional` 只代表双向可用，不代表双倍计费
  - 多 portal 默认选择顺序为：先按方向和 mode 过滤，再按 `priority` 降序，最后按 `id` 升序打破平局

#### `WorldRouteItinerary`

- Required fields:
  - `reachable: boolean`
  - `scope: "world-only" | "cross-map"`
  - `strategy: RouteStrategy`
  - `mode: TravelMode`
  - `legs: WorldRouteLeg[]`
  - `summary: { label: string; legCount: number; ... }`
  - `totalDistance: number`
  - `totalCost: number`
  - `usedModes: TravelMode[]`
- Optional fields:
  - `failure?: WorldRouteFailure`
- Invariants:
  - `reachable = false` 时 `legs` 不必为空
  - `usedModes` 应反映实际显式使用过的模式，而不是仅回显请求值

#### `WorldRouteLeg`

- Required fields:
  - `scope: "destination" | "world"`
  - `distance: number`
  - `cost: number`
  - `steps: WorldRouteStep[]`
- Optional fields:
  - `destinationId?: string`
  - `worldNodeIds?: string[]`
  - `localNodeIds?: string[]`
  - `entryPortalId?: string`
  - `exitPortalId?: string`
- Invariants:
  - `portal` 不作为独立 `scope`
  - `destination` leg 表示 local 段
  - `world` leg 表示 world graph 段

#### `WorldRouteStep`

- Required fields:
  - `from: string`
  - `to: string`
  - `mode: TravelMode`
  - `distance: number`
  - `cost: number`
- Optional fields:
  - `edgeId?: string`
  - `roadType?: string`
  - `metadata?: Record<string, string | number | boolean>`
- Invariants:
  - `destination` leg 可直接复用现有 local `RouteStep` 形态
  - `world` leg 至少补充到足以解释 edge traversals 和 crossing 语义
  - 前端 MVP 不得依赖未冻结的深层 metadata 字段

#### `WorldRouteFailure`

- Required fields:
  - `stage: "origin-destination" | "origin-portal" | "world" | "destination-portal" | "destination-local"`
  - `reason: string`
- Optional fields:
  - `blockedFrom?: string`
  - `blockedTo?: string`
- Invariants:
  - 表示首次失败发生位置
  - 若返回 partial legs，failure 必须能解释为何后续未继续

### Cost And Mixed Snapshot

- `worldEdgeCost = distance * (1 + congestion)`
- `totalCost = sum(localLeg.cost) + sum(worldEdgeCost) + sum(transferCost)`
- `totalDistance = sum(localLeg.distance) + sum(worldEdge.distance) + sum(transferDistance)`
- `mixed` 规则：
  - 不是独立交通方式
  - 不预设隐藏 `roadType` 优先级
  - 在显式可用模式中选最低成本
  - 完全同成本时按 `shuttle`、`bike`、`walk` 打破平局

### HTTP Contract Snapshot

#### `GET /api/world`

- Purpose:
  - world mode 可用性探测
  - 轻量入口
  - 首屏不加载重型 graph
- `200` response:
  - `enabled: boolean`
  - `world?: { id, name, width, height, backgroundImage }`
  - `regions: Array<{ id, name }>`
  - `destinations: Array<{ destinationId, label, x, y, iconType, regionId }>`
  - `capabilities: { worldView: boolean; destinationRouting: boolean; crossMapRouting: boolean }`
- Forbidden payload:
  - `graph`
  - `portals`
  - 完整 itinerary

#### `GET /api/world/details`

- Purpose:
  - 重型详情获取
  - 提供 world 渲染、graph、portal 和路线解释所需数据
- `200` response:
  - `world: WorldMapRecord`
- `409` response:
  - `{ error: "World mode is unavailable.", code: "world_unavailable" }`
- `500` response:
  - `{ error: "World data is inconsistent.", code: "invalid_world_data" }`

#### `POST /api/world/routes/plan`

- Envelope rule:
  - 返回 bare itinerary payload，不包 `{ item: ... }`
- Supported request shapes:
  - destination to destination
    - `fromDestinationId`
    - `toDestinationId`
    - `mode`
    - `strategy`
  - local node to local node
    - `fromDestinationId`
    - `fromLocalNodeId`
    - `toDestinationId`
    - `toLocalNodeId`
    - `mode`
    - `strategy`
- Invalid request rules:
  - 半本地请求无效
  - `fromDestinationId = toDestinationId` 的 world 请求无效，应继续走 local `/api/routes/plan`
  - 未知 destination 或 local node id 视为无效请求，而不是不可达结果
- `200` response:
  - `reachable`
  - `scope`
  - `strategy`
  - `mode`
  - `legs`
  - `summary`
  - `totalDistance`
  - `totalCost`
  - `usedModes`
  - `failure?`
- Scope rules:
  - destination-to-destination 只返回 `world-only`
  - local-node-to-local-node 只返回 `cross-map`
- `400` response:
  - `{ error: "Invalid world routing request.", code: "invalid_world_request" }`
- `409` response:
  - `{ error: "World mode is unavailable.", code: "world_unavailable" }`
- `500` response:
  - `{ error: "World data is inconsistent.", code: "invalid_world_data" }`

## Implementation Notes

### Code Style Requirements
- Implementation code and comments must NOT contain plan-specific terminology such as "AC-", "Milestone", "Step", "Phase", or similar workflow markers
- These terms are for plan documentation only, not for the resulting codebase
- Use descriptive, domain-appropriate naming in code instead

### Additional Constraints

- Code identifiers, string enums, file names, comments, tests and runtime-facing developer text use English only.
- 注释只保留解释领域语义、约束或复杂逻辑所必需的内容，不写开发过程说明。
- 优先通过概念性模块边界组织 world 功能，不在多个文件重复同一份接口定义。
- world capability 必须可关闭，可通过移除或不提供 `SeedData.world` 回滚到 local-only 模式。
- `docs/` 的更新与代码改动必须在同一实现轮次完成，不能依赖事后补文档。

--- Original Design Draft Start ---

# World Models Draft

## 文档目的

本文档用于把当前 world map 方案收敛成一份可进入实现前评审的数据模型草案。

本文档不是实现代码，也不是最终 TypeScript 文件。

它的目标是：

- 冻结 MVP 的 world 数据结构
- 明确字段语义边界
- 为后续 `src/domain/world-models.ts` 提供直接映射依据

---

## 一、范围

本文档覆盖：

- `WorldMapRecord`
- `WorldRegionRecord`
- `WorldDestinationPlacement`
- `WorldGraphRecord`
- `WorldNodeRecord`
- `WorldEdgeRecord`
- `DestinationPortalRecord`
- `WorldRouteItinerary`
- `WorldRouteLeg`
- `WorldRouteFailure`

本文档不覆盖：

- 前端组件结构
- 具体服务实现
- 真实 GIS 数据导入
- 最终美术坐标

---

## 二、MVP 总原则

1. world layer 是抽象导航层，不是 GIS 精确地图。
2. local graph 和 world graph 分层存在，不合并为一张超级大图。
3. `portal` 是 world 与 local 之间唯一合法桥接实体。
4. `placement.x/y` 是视觉锚点，`world node.x/y` 是拓扑锚点。
5. MVP schema 只保留 `width` 和 `height`，不保留独立 `bounds`。
6. `mixed` 是请求层规划模式，不是独立物理交通方式。
7. `portal` 不作为独立 route leg scope。

---

## 三、顶层结构

推荐 seed 顶层保持如下关系：

- `destinations`
- `users`
- `journals`
- `world?`

其中：

- `world` 在 MVP 中是可选字段
- 缺失 `world` 不应破坏现有 local map 运行
- 服务层应把缺失 `world` 视为 capability 不可用，而不是数据损坏

---

## 四、WorldMapRecord

## 作用

描述整个 world map 本体。

## MVP 必填字段

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`
- `regions`
- `destinations`
- `graph`
- `portals`

## 字段语义

### `id`

- world map 的稳定标识
- 应在 world 层唯一

### `name`

- world map 的展示名称

### `width`

- world 平面坐标系宽度
- 与 `CRS.Simple` 渲染空间一致

### `height`

- world 平面坐标系高度
- 与 `CRS.Simple` 渲染空间一致

### `backgroundImage`

- world map 的底图资源路径
- 可以是风格化底图，不代表权威地理底图

### `regions`

- world 高层区域数组

### `destinations`

- existing `destination` 的 world placement 数组

### `graph`

- world 层的抽象导航图

### `portals`

- world 与 local 的桥接定义

## MVP 不保留字段

- `bounds`

原因：

- 对当前矩形平面世界，Leaflet 显示边界可直接由 `width` 与 `height` 推导
- 单独保存等价 `bounds` 只会增加维护不一致风险

## 预留字段

以下字段不进入 MVP，但可作为后续扩展方向：

- `overlays`
- `legend`
- `theme`
- `water`
- `crossings`

---

## 五、WorldRegionRecord

## 作用

表示 world 层的高层区域。

## MVP 必填字段

- `id`
- `name`
- `polygon`
- `tags`

## 字段语义

### `polygon`

- 主要服务视觉边界、hover、聚类和解释性
- 默认不承担严格路由碰撞边界语义

### `tags`

- 用于表达区域主题和视觉分类
- 可以用于 UI 筛选或说明
- 不直接参与最短路计算

## 约束

- `region.id` 在 world 内唯一
- `polygon` 使用 world 坐标系
- `polygon` 顶点顺序保持稳定即可，MVP 不强制顺逆时针

---

## 六、WorldDestinationPlacement

## 作用

表示某个 existing `destination` 在 world 层的视觉落点。

## MVP 必填字段

- `destinationId`
- `label`
- `x`
- `y`
- `radius`
- `regionId`
- `portalIds`
- `iconType`

## 字段语义

### `destinationId`

- 必须引用现有 `destinations` 中真实存在的实体

### `label`

- 推荐直接用于 world 层展示
- 对同名 destination，建议包含 region 信息

### `x / y`

- world 层视觉锚点
- 服务 marker、label、hover、点击热区和选中态
- 不直接参与 route 拓扑计算

### `radius`

- 视觉与交互热区参考半径
- 渲染层应转换为带上下限的像素热区
- 不解释为真实地理半径

### `regionId`

- 该 destination 所属的高层区域

### `portalIds`

- 该 destination 可用 portal 的引用列表

### `iconType`

- 展示字段
- 用于 marker 图标和视觉分类
- 不参与 route 成本计算

## 关键约束

1. `placement.x/y` 与 `portal` 对应的 `world node.x/y` 可以重合，但不应强绑定。
2. 一个 destination 未来允许拥有多个 portal。
3. `portalIds` 中的 portal 必须都引用同一个 `destinationId`。

---

## 七、WorldGraphRecord

## 作用

承载 world 层的抽象导航图。

## MVP 必填字段

- `nodes`
- `edges`

---

## 八、WorldNodeRecord

## 作用

表示 world graph 中的节点。

## MVP 必填字段

- `id`
- `x`
- `y`
- `kind`
- `label`
- `tags`

## 条件字段

- `destinationId?`

只在以下情况使用：

- `kind = portal`
- 或确实需要把 node 与某个 destination 建立直接语义关系时

## `kind` 枚举

- `portal`
- `junction`
- `hub`
- `region-center`

## 字段语义

### `x / y`

- 拓扑锚点
- 参与 route polyline、跨区结构和解释性展示

### `kind = hub`

- 区域核心交通或汇聚节点

### `kind = junction`

- chokepoint / crossing / connector
- 例如桥头、隧道口、关键过渡点

### `kind = portal`

- 与 local graph 通过 `DestinationPortalRecord` 建立桥接

### `kind = region-center`

- 更偏区域展示中心
- 不要求一定承担高强度拓扑职责

## 关键约束

1. world node id 必须与 local node id 空间分离。
2. world graph edge 只连接 world node。
3. `kind = portal` 的 node 应存在对应 portal 记录。

---

## 九、WorldEdgeRecord

## 作用

表示 world graph 中的抽象连接关系。

## MVP 必填字段

- `id`
- `from`
- `to`
- `distance`
- `roadType`
- `allowedModes`
- `congestion`
- `bidirectional`

## `roadType` 枚举

- `road`
- `rail`
- `trail`
- `ferry`
- `tunnel`
- `airlift`
- `bridge`

## 字段语义

### `distance`

- world 层抽象通行距离
- 用于 route 成本计算和解释性展示

### `allowedModes`

- world edge 显式允许的通行模式
- 优先表达物理可用模式

### `congestion`

- 抽象阻力因子
- 用于 route cost weighting

### `bidirectional`

- 表示边是否双向可达

## MVP 约束

1. world 层不应把 `mixed` 当成独立物理交通方式。
2. 为兼容现有合同，seed 中暂时允许出现 `mixed`，但实现时应优先按显式模式解释。
3. `roadType` 在 MVP 中同时服务 route 解释性和默认视觉映射。

---

## 十、DestinationPortalRecord

## 作用

表示 world 与 local 的合法桥接关系。

## MVP 必填字段

- `id`
- `destinationId`
- `worldNodeId`
- `localNodeId`
- `portalType`
- `label`
- `priority`
- `allowedModes`
- `direction`
- `transferDistance`
- `transferCost`

## `portalType` 枚举

- `main-gate`
- `dock`
- `bike-entry`
- `shuttle-stop`

## 字段语义

### `worldNodeId`

- 必须引用一个 `kind = portal` 的 world node

### `localNodeId`

- 必须引用目标 destination 内真实存在的 local node

### `priority`

- 当一个 destination 有多个 portal 时，用于 MVP 默认选择

### `direction`

- 表示 portal 是否允许双向使用

### `transferDistance`

- 单次跨层穿越距离

### `transferCost`

- 单次跨层穿越成本

## MVP 冻结规则

1. `transferDistance` 与 `transferCost` 都视为单次穿越成本。
2. `direction = bidirectional` 只表示双向可用，不表示单次穿越双倍计费。
3. 一条完整 `local -> world -> local` 路线通常会累计两次 transfer。

---

## 十一、WorldRouteItinerary

## 作用

表示 world 或 cross-map 路由的统一结果结构。

## MVP 必填字段

- `reachable`
- `scope`
- `strategy`
- `mode`
- `legs`
- `summary`
- `totalDistance`
- `totalCost`
- `usedModes`

## 条件字段

- `failure?`

## 字段语义

### `scope`

顶层 itinerary 的 scope 在 MVP 中建议只表示：

- `world-only`
- `cross-map`

---

## 十二、WorldRouteLeg

## 作用

表示 itinerary 中的一段路径。

## MVP 必填字段

- `scope`
- `distance`
- `cost`
- `steps`

## 条件字段

- `destinationId?`
- `worldNodeIds?`
- `localNodeIds?`
- `entryPortalId?`
- `exitPortalId?`

## `scope` 枚举

- `destination`
- `world`

## MVP 约束

1. `portal` 不作为独立 leg scope。
2. portal 穿越动作应通过：
   - `entryPortalId`
   - `exitPortalId`
   - 或 step metadata
   表达。
3. `destination` leg 用于 local 段。
4. `world` leg 用于 world graph 段。

---

## 十三、WorldRouteFailure

## 作用

在 `reachable = false` 时说明首次失败发生的位置与原因。

## MVP 必填字段

- `stage`
- `reason`

## 条件字段

- `blockedFrom?`
- `blockedTo?`

## `stage` 枚举

- `origin-destination`
- `origin-portal`
- `world`
- `destination-portal`
- `destination-local`

## MVP 约束

1. `reachable = false` 时，`legs` 不必为空。
2. 推荐返回已成功规划出的前缀段。
3. `failure` 用于说明首次失败发生在哪个阶段。

---

## 十四、MVP 成本模型

推荐冻结如下：

1. local 段成本
   - 直接复用现有 local route service 返回的 `totalCost`
2. world edge 成本
   - `distance * (1 + congestion)`
3. transfer 成本
   - 每发生一次实际跨层穿越，累计一次 `transferCost`
4. totalCost
   - `sum(localLeg.cost) + sum(worldEdgeCost) + sum(transferCost)`
5. totalDistance
   - `sum(localLeg.distance) + sum(worldEdge.distance) + sum(transferDistance)`

---

## 十五、MVP mixed 规则

1. `mixed` 是规划模式，不是独立交通工具。
2. world planner 不应对 `roadType` 预设隐藏优先级。
3. 只要 edge 对 mixed policy 可用，就进入候选集。
4. 对每条候选 edge，应在显式模式中选择最低成本的通过方式。
5. 若成本完全相同，再使用稳定 tie-break。

推荐 tie-break：

- `shuttle`
- `bike`
- `walk`

---

## 十六、实现前必须冻结的约束

以下内容在进入实现前必须冻结：

1. `placement` 与 `portal` 的视觉锚点 / 拓扑锚点语义。
2. portal 单次穿越成本规则。
3. `portal` 不作为独立 leg scope。
4. `mixed` 的 world 层决策规则。
5. MVP schema 不保留 `bounds`。
6. `roadType` 的最小视觉映射责任。

---

## 十七、建议映射到 TypeScript 的顺序

建议后续落地顺序如下：

1. `WorldMapRecord`
2. `WorldRegionRecord`
3. `WorldDestinationPlacement`
4. `WorldGraphRecord`
5. `WorldNodeRecord`
6. `WorldEdgeRecord`
7. `DestinationPortalRecord`
8. `WorldRouteItinerary`
9. `WorldRouteLeg`
10. `WorldRouteFailure`

---

## 十八、下一步建议

本文档完成后，最合理的下一步是：

1. 把本稿映射成 `src/domain/world-models.ts` 接口草案
2. 基于同一术语写 `/api/world` contract draft
3. 用 sample seed 对接口合同做最小 stub 校验

--- Original Design Draft End ---
