# World Map Review Glossary

## 文档目的

本文档用于给外部模型或外部审阅者提供统一语义上下文，避免他们误把当前 world map 方案当成：

- 真实 GIS 地图项目
- 直接导入 OSM 路网的项目
- 要替换现有 local map 的重构项目

本文档不是实现方案，也不是最终数据 schema。

它的作用只有一个：

- 让审阅方准确理解当前 world map 数据和术语的含义

---

## 一、审阅时必须知道的背景

当前项目已经有一套现成的 local map 系统：

- 每个 `destination` 各自有一张局部图
- 局部图支持节点级路线规划
- 现有 local map 不会被 world map 替换

当前新增的 world map 是更高一层的地图模式：

- 用于展示整个世界结构
- 用于做跨 destination 的导航
- 用于把多个 local map 组织成一个统一的大地图体验

因此正确理解应该是：

- local map 负责地点内部导航
- world map 负责地点之间导航
- 两层通过 `portal` 连接

---

## 二、审阅范围

外部审阅时，建议把下面这些文件一起看：

- [world-map-mode-spec-and-plan.md](/home/frisk/ds-ts/world-map-mode-spec-and-plan.md)
- [world-map-boston-reference-mapping.md](/home/frisk/ds-ts/world-map-boston-reference-mapping.md)
- [world-map-boston-inspired.seed-fragment.json](/home/frisk/ds-ts/world-map-boston-inspired.seed-fragment.json)
- [world-map-ui-draft.md](/home/frisk/ds-ts/world-map-ui-draft.md)

如果需要看 Boston 空间参考原始输入，再附：

- [export (1).geojson](/home/frisk/ds-ts/export%20(1).geojson)

---

## 三、正确理解模型的总原则

审阅 world map 时，请默认以下原则成立：

1. world map 是抽象导航层，不是 GIS 精确地图
2. world graph 不是 OSM 原样路网
3. local graph 和 world graph 是两张不同层级的图
4. sample 中的世界坐标是概念布局坐标，不是最终美术坐标
5. Boston 参考只用于空间逻辑借鉴，不用于直接导入真实道路数据

---

## 四、核心术语

## `destination`

含义：

- 项目里已经存在的地点实体
- 是 local map 的宿主单位

不应误解为：

- world graph node
- region
- portal

审阅重点：

- world 层如何放置 existing destination
- world 层如何与 destination 内部图连接

## `local map`

含义：

- 某个单独 `destination` 的局部地图
- 已经存在
- 不会被 world map 替换

不应误解为：

- world map 的一个 zoom level
- world graph 的子图可视化

## `world map`

含义：

- 整个项目新增的大地图模式
- 展示多个 destination 的空间组织
- 支持跨地点导航

不应误解为：

- 把所有 local node 拼成一张超大真实地图

## `world graph`

含义：

- 用于 world routing 的抽象图
- 描述 region、hub、crossing、destination 之间的世界级连通关系

不应误解为：

- 真实道路数据库
- OSM 全量几何的直接映射

## `region`

含义：

- world map 上的高层区域
- 用于组织空间认知、分区展示、聚类和视觉表达

不应误解为：

- 行政区
- 必须严格参与最短路计算的图节点

补充说明：

- `region polygon` 当前主要服务视觉、hover、聚类、解释性
- 不默认表示严格的物理边界约束，除非后续 schema 明确增加这层语义

## `hub`

含义：

- world graph 中的重要汇聚节点
- 通常表示区域主中枢或换乘核心

不应误解为：

- 每个 destination 的入口
- 单纯几何中心点

Boston-inspired 方案中的强调点：

- hub 更应该出现在桥头、隧道口、走廊汇聚点、区域入口

## `junction`

含义：

- 比普通 hub 更偏向 chokepoint / crossing / connector 的节点
- 用于表达桥、隧道、瓶颈、转向、过渡

不应误解为：

- local map 里的普通 `junction` 节点
- 只是视觉装饰点

审阅重点：

- 它是否真的承担路线分流作用
- 它是否让 world route 更可解释

## `portal`

含义：

- world graph 与 local graph 之间的合法桥接实体
- 用于把一个 world node 和一个 local node 连接起来

不应误解为：

- 传送门玩法设定
- UI 快捷按钮
- 任意 destination marker

正确理解是：

- 从 local route 进入 world route，必须通过 portal
- 从 world route 进入目标 destination 的 local route，也必须通过 portal

## `placement`

含义：

- 某个 `destination` 在 world map 上的落点信息
- 决定 marker 的位置、显示标签、所属 region、关联 portal

补充约定：

- `placement.x/y` 是视觉锚点
- `world node.x/y` 是拓扑锚点
- 二者可以重合
- 但不应被理解为必须重合

不应误解为：

- local map 中建筑或节点的真实坐标

## `world node`

含义：

- world graph 中的节点
- 可以是：
  - `hub`
  - `junction`
  - `portal`
  - `region-center`

不应误解为：

- local graph node
- destination 本体

## `world edge`

含义：

- world graph 中的边
- 表示世界层的抽象连接关系

不应误解为：

- 必须一一映射到真实道路
- 必须保留完整几何细节

正确理解：

- 它主要服务 route planning 和解释性展示
- 可以抽象成桥、隧道、道路、轨道、渡口等高层交通关系

## `mixed`

含义：

- 请求层的规划模式
- 表示规划器可以在显式交通模式之间做组合选择

不应误解为：

- 一种独立的物理交通工具
- 一种独立的 edge 物理类型

MVP 建议：

- `mixed` 不预设 `roadType` 优先级
- 规划器应在 `walk`、`bike`、`shuttle` 中选择最低成本的通过方式
- 若成本完全相同，再用稳定顺序打破平局

## `crossing`

含义：

- 泛指世界层中的跨水、跨谷、跨边界关键连接
- 通常由 `junction` + 特定类型 `world edge` 共同表达

不应误解为：

- 单独一种固定字段结构

## `leg`

含义：

- 跨图路线结果中的分段
- 一条完整路线应由多段构成，例如：
  - 起点 local 段
  - world 段
  - 终点 local 段

不应误解为：

- 单个 edge
- 单个 node 序列

审阅重点：

- 是否保留足够解释性
- 是否方便前端按段展示

---

## 五、关键字段的推荐语义

## `regionId`

含义：

- `destination placement` 所属的高层区域

应重点审查：

- region 归属是否稳定
- 是否能帮助用户理解地图

## `radius`

当前建议语义：

- world marker 的视觉与点击热区参考半径

补充约定：

- 首版渲染时，它更适合作为展示与交互的参考值
- 首版点击热区建议转换为带上下限的像素半径，而不是随 `CRS.Simple` 无限等比缩放
- 这样可以保证缩放前后点击体验稳定

不建议默认解释为：

- 真实地理影响半径
- 路径搜索半径

## `iconType`

当前建议语义：

- 纯展示字段
- 用于决定 marker 图标、色彩、风格

不建议默认解释为：

- 决定 route 权重
- 决定业务逻辑分类

## `roadType`

world edge 上的 `roadType` 含义：

- world layer 的抽象交通类型
- 例如 `road`、`trail`、`rail`、`bridge`、`tunnel`、`ferry`

不应误解为：

- OSM 原始 tag 的一比一镜像
- 和 local edge `roadType` 完全同义

当前建议语义：

- 它同时服务 route 解释性和前端默认视觉映射
- 首版应允许它直接决定 polyline 的基础样式差异

## `bounds`

当前状态：

- 不建议作为 MVP world schema 的必备字段

原因：

- 在当前矩形平面世界里，Leaflet 范围可以直接由 `width` 和 `height` 推导

如果未来重新引入：

- 应只用于表达非零原点、偏移坐标系或更复杂边界

## `distance`

world edge 上的 `distance` 含义：

- world layer 的抽象通行距离
- 用于 route cost 计算和解释性展示

不应误解为：

- 来自 OSM 的精确米数

## `congestion`

当前建议语义：

- 通行阻力或拥挤度因子
- 用于 route strategy 的成本计算

注意：

- 它在 world layer 和 local layer 可以复用同一抽象含义
- 但不代表两层一定使用完全相同的量纲

## `transferDistance`

含义：

- 在 portal 处从 world layer 进入 local layer时的附加转换距离

MVP 冻结规则：

- 视为单次穿越距离
- 每发生一次层级切换，只累加一次

## `transferCost`

含义：

- 在 portal 处进行层级切换时的附加成本

当前语义状态：

- 表示 portal 跨层切换时的额外成本
- 建议在 MVP 中直接进入总成本公式

MVP 建议：

- `worldEdgeCost = distance * (1 + congestion)`
- `totalCost = sum(localLeg.cost) + sum(worldEdgeCost) + sum(transferCost)`
- `totalDistance = sum(localLeg.distance) + sum(worldEdge.distance) + sum(transferDistance)`

补充约定：

- `direction = "bidirectional"` 只表示 portal 双向可用
- 不表示同一次穿越要双倍计费

## `reachable`

含义：

- 表示整个 itinerary 是否成功打通到目标

补充约定：

- `reachable: false` 不等于 `legs` 必须为空
- 推荐返回已成功规划出的前缀段，并附带 `failure` 字段说明首次失败发生在哪一层

## `scope`

在 itinerary `legs[]` 中的当前建议：

- MVP 只保留：
  - `destination`
  - `world`

不建议在 MVP 中把 `portal` 作为独立 leg scope。

原因：

- portal 更像层级边界和转换动作
- 更适合挂在相邻 leg 的边界元数据中，例如 `entryPortalId` 和 `exitPortalId`

## `mixed mode`

含义：

- 一种允许多类可通行 edge 共同参与 world routing 的规划模式

MVP 建议：

- 它不是单独的物理交通方式
- 不应对 `trail`、`road`、`rail`、`bridge`、`tunnel` 预设隐藏优先级
- 只要 edge 对 mixed policy 可用，就进入候选集
- 最终由 `strategy` 与总成本公式共同决定路径

不应误解为：

- 默认优先步行
- 默认优先 shuttle
- 默认优先某种 `roadType`

## `failure`

含义：

- 在 `reachable: false` 时说明失败阶段和失败原因的结构

建议字段：

- `stage`
- `reason`
- `blockedFrom?`
- `blockedTo?`

## `leader line`

含义：

- 当前端把 `placement` 视觉锚点和 active portal 拓扑锚点同时展示时，用于解释两者关系的轻量连线

MVP 建议：

- 不常驻显示
- 仅在选中或聚焦某个 destination 且两点明显分离时，按需显示
- 它不参与 route 计算

---

## 六、Boston 参考的正确使用方式

Boston 数据的作用是：

- 提供空间骨架参考
- 提供水体切分、桥隧瓶颈、走廊结构的灵感

Boston 数据不应用于：

- 直接导入为项目 world graph
- 要求世界坐标与真实 Boston 经纬度一致
- 把项目世界观变成 Boston 复刻版

正确理解方式：

- 借 Boston 的结构逻辑
- 不照搬 Boston 的道路数据

---

## 七、外部审阅时最容易出现的误解

## 误解 1

“既然有 OSM 参考，为什么不直接按真实地图建模？”

正确回答：

- 因为项目目标是可实现、可解释、可演进的大地图导航层
- 不是 GIS 产品
- 真实路网只会增加复杂度，不会直接提升当前功能完成度

## 误解 2

“world map 是否会替换现有 local map？”

正确回答：

- 不会
- world map 是更高层的入口和跨图路由层

## 误解 3

“region polygon 是否就是严格可通行区域？”

正确回答：

- 当前不是
- 它优先用于视觉、交互和分区理解

## 误解 4

“junction 和 hub 是否重复？”

正确回答：

- 两者都属于 world node
- 但 hub 偏向区域或交通核心
- junction 偏向 chokepoint / crossing / connector

## 误解 5

“portal 是不是传送门？”

正确回答：

- 不是玩法设定
- 它是分层图结构中的合法入口

---

## 八、建议外部模型重点评论的问题

如果让其他模型来审阅，建议他们重点评论：

1. `region / hub / junction / portal` 的边界是否清晰
2. `world edge` 的抽象程度是否合适
3. Boston-inspired 布局是否比通用布局更有可解释性
4. `legs[]` 的结果结构是否足够支撑前端展示
5. 在实现前，哪些字段还需要继续冻结语义

不建议让外部模型把重点放在：

- 要不要改成真实 GIS 坐标
- 要不要直接导入 OSM 全量路网
- 要不要重写 local map

这些方向都不符合当前项目目标。

---

## 九、建议外部模型输出的反馈格式

为了减少歧义，建议外部模型按下面格式给建议：

1. 术语或字段名
2. 当前理解
3. 可能的歧义
4. 建议如何补充定义
5. 是否会影响实现

这样比泛泛点评更有用。

---

## 十、结论

对外审阅时，最重要的是先让对方理解：

- 这是抽象导航层
- 不是 GIS 重建
- 不是 OSM 导入工程
- 不是 local map 替换计划

只要这一层上下文明确，外部模型给出的建议才会集中在真正有价值的地方。
