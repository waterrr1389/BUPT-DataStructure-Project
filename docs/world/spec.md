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

## First Delivery

第一轮只要求打通基础能力：

- world 数据模型
- world API summary/details
- world capability 判断
- `Leaflet` world 容器初始化前提

第一轮不要求：

- 完整 cross-map routing 实现
- local-world-local itinerary 拼装
- 复杂 overlay
- 真实 GIS 导入

## Second Delivery

第二轮再进入：

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

## Implementation Order

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
