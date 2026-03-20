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
