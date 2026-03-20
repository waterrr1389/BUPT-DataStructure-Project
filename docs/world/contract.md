# World Contracts

## Purpose

本文档冻结 world mode 的必要合同，覆盖：

- world 数据模型
- world HTTP 接口
- world route 关键语义

本文件默认服务于 `Leaflet + CRS.Simple` 的前端世界地图。

## Data Model

## Top-Level Seed Shape

seed 顶层保持：

- `destinations`
- `users`
- `journals`
- `world?`

`world` 为可选字段。缺失 `world` 时，不应破坏现有 local map。

## `WorldMapRecord`

必填字段：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`
- `regions`
- `destinations`
- `graph`
- `portals`

冻结语义：

- `width` 与 `height` 直接服务 `Leaflet` 矩形世界边界
- 不保留独立 `bounds`

## `WorldRegionRecord`

必填字段：

- `id`
- `name`
- `polygon`
- `tags`

冻结语义：

- `polygon` 主要服务视觉边界与解释性
- 默认不承担严格路由碰撞边界语义

## `WorldDestinationPlacement`

必填字段：

- `destinationId`
- `label`
- `x`
- `y`
- `radius`
- `regionId`
- `portalIds`
- `iconType`

冻结语义：

- `x/y` 是视觉锚点，不参与严格拓扑计算
- `radius` 是视觉与点击热区参考半径
- `placement.x/y` 与 portal/world node 坐标可以重合，但不强绑定

## `WorldGraphRecord`

必填字段：

- `nodes`
- `edges`

## `WorldNodeRecord`

必填字段：

- `id`
- `x`
- `y`
- `kind`
- `label`
- `tags`

可选字段：

- `destinationId?`

`kind` 枚举：

- `portal`
- `junction`
- `hub`
- `region-center`

冻结语义：

- `x/y` 是拓扑锚点
- `kind = portal` 的 node 必须能映射到 portal 记录

## `WorldEdgeRecord`

必填字段：

- `id`
- `from`
- `to`
- `distance`
- `roadType`
- `allowedModes`
- `congestion`
- `bidirectional`

`roadType` 枚举：

- `road`
- `rail`
- `trail`
- `ferry`
- `tunnel`
- `airlift`
- `bridge`

冻结语义：

- `mixed` 不是 edge 的物理类型
- `roadType` 同时服务 route 解释性和基础视觉映射

## `DestinationPortalRecord`

必填字段：

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

冻结语义：

- `worldNodeId` 必须指向 `kind = portal` 的 world node
- `localNodeId` 必须指向对应 destination 内真实 local node
- `transferDistance` 与 `transferCost` 都是单次穿越成本
- `direction = bidirectional` 只表示双向可用，不表示双倍计费

## Route Semantics

## `WorldRouteItinerary`

必填字段：

- `reachable`
- `scope`
- `strategy`
- `mode`
- `legs`
- `summary`
- `totalDistance`
- `totalCost`
- `usedModes`

可选字段：

- `failure?`

顶层 `scope`：

- `world-only`
- `cross-map`

## `WorldRouteLeg`

必填字段：

- `scope`
- `distance`
- `cost`
- `steps`

可选字段：

- `destinationId?`
- `worldNodeIds?`
- `localNodeIds?`
- `entryPortalId?`
- `exitPortalId?`

`scope` 枚举：

- `destination`
- `world`

冻结语义：

- `portal` 不作为独立 leg scope
- portal 穿越通过 `entryPortalId`、`exitPortalId` 或 step metadata 表达

## `WorldRouteFailure`

必填字段：

- `stage`
- `reason`

可选字段：

- `blockedFrom?`
- `blockedTo?`

`stage` 枚举：

- `origin-destination`
- `origin-portal`
- `world`
- `destination-portal`
- `destination-local`

## HTTP Contracts

## `GET /api/world`

作用：

- 返回 world mode 的轻量 summary
- 用于前端判断是否初始化 world mode

成功响应：

- `200`

MVP 字段：

- `enabled`
- `world?`
- `regions`
- `destinations`
- `capabilities`

`world` 仅保留：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`

`regions` 仅保留：

- `id`
- `name`

`destinations` 仅保留：

- `destinationId`
- `label`
- `x`
- `y`
- `iconType`
- `regionId`

world 不可用时推荐返回：

```json
{
  "enabled": false,
  "regions": [],
  "destinations": [],
  "capabilities": {
    "worldView": false,
    "destinationRouting": false,
    "crossMapRouting": false
  }
}
```

## `GET /api/world/details`

作用：

- 返回 world mode 的重型详情数据
- 供 `Leaflet` 图层、marker、polyline 和解释性展示使用

成功响应：

- `200`

MVP 字段：

- `world`

`world` 应包含：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`
- `regions`
- `destinations`
- `graph`
- `portals`

world 不可用时推荐返回：

- `409`

```json
{
  "error": "World mode is unavailable.",
  "code": "world_unavailable"
}
```

## `POST /api/world/routes/plan`

作用：

- 返回 world-only 或 cross-map itinerary

推荐请求模式：

- destination 到 destination
  - `fromDestinationId`
  - `toDestinationId`
  - `mode`
  - `strategy`
- local node 到 local node
  - `fromDestinationId`
  - `fromLocalNodeId`
  - `toDestinationId`
  - `toLocalNodeId`
  - `mode`
  - `strategy`

冻结语义：

- `mode` 可为 `walk`、`bike`、`shuttle`、`mixed`
- `mixed` 是规划模式，不是独立物理交通方式
- `reachable = false` 时允许返回已成功规划出的前缀 `legs`

## Cost Model

冻结规则：

- local 段成本复用现有 local route 结果
- world edge 成本为 `distance * (1 + congestion)`
- 每次实际跨层穿越累计一次 `transferCost`
- `totalDistance` 包含 local、world 和 `transferDistance`
- `totalCost` 包含 local、world 和 `transferCost`

## Sample Data

实现与审阅时使用：

- [boston-inspired.seed-fragment.json](/home/frisk/ds-ts/docs/world/examples/boston-inspired.seed-fragment.json)
