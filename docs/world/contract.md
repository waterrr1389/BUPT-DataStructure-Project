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
- `direction` 仅允许：`inbound`、`outbound`、`bidirectional`

## Route Units And Ranges

冻结单位与范围：

- `distance` 单位固定为 `meters`，范围 `[0, 1_000_000]`
- `cost` 单位固定为 `cost-units`，范围 `[0, 2_000_000]`
- `transferDistance` 单位固定为 `meters`，范围 `[0, 10_000]`
- `transferCost` 单位固定为 `cost-units`，范围 `[0, 100_000]`
- `congestion` 为无量纲比率，范围 `[0, 1]`
- `congestion` 派生倍率范围固定为 `[1, 2]`

冻结公式：

- world edge 成本固定为 `distance * (1 + congestion)`
- 派生成本范围固定为 `[distance, distance * 2]`

## Route Semantics

## `WorldRouteStep`

`WorldRouteStep` 冻结为以下三种离散步骤：

1) `local-edge`

- `kind`
- `destinationId`
- `edgeId`
- `fromLocalNodeId`
- `toLocalNodeId`
- `mode`
- `distance`
- `cost`

2) `world-edge`

- `kind`
- `edgeId`
- `fromWorldNodeId`
- `toWorldNodeId`
- `roadType`
- `mode`
- `distance`
- `congestion`
- `cost`

3) `portal-transfer`

- `kind`
- `portalId`
- `transferDirection` (`local-to-world` | `world-to-local`)
- `destinationId`
- `localNodeId`
- `worldNodeId`
- `mode`
- `transferDistance`
- `transferCost`
- `distance`
- `cost`

## `WorldRouteLeg`

`WorldRouteLeg` 仅允许两种 scope：

- `destination`
- `world`

冻结语义：

- `destination` leg 只能包含 `local-edge` steps
- `world` leg 只能包含 `world-edge` 与 `portal-transfer` steps
- `portal` 不是独立 leg scope
- 每个 leg 的 `steps` 顺序必须保持为规划产出的原始顺序，该顺序即 route explanation 的 canonical segment sequence

`destination` leg 必填字段：

- `scope`
- `destinationId`
- `localNodeIds`
- `distance`
- `cost`
- `steps`

`world` leg 必填字段：

- `scope`
- `worldNodeIds`
- `distance`
- `cost`
- `steps`

`world-only` 的 `world` leg：

- `steps` 仅允许 `world-edge`
- 不提供 `entryPortalId`、`exitPortalId`

`cross-map` 的 `world` leg：

- 必须提供 `entryPortalId`
- 必须提供 `exitPortalId`
- `steps` 必须为：
  - 第一个 `portal-transfer(local-to-world)`
  - 零个或多个 `world-edge`
  - 最后一个 `portal-transfer(world-to-local)`

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
- `portalSelection?`（仅 `scope = cross-map` 必填）

顶层 `scope`：

- `world-only`
- `cross-map`

冻结边界：

- `scope = world-only` 时，`legs` 必须且仅能为一个 `world` leg
- `scope = cross-map` 且 `reachable = true` 时，`legs` 必须且仅能按顺序为：
  - 第一个 `destination` leg（origin local）
  - 一个 `world` leg
  - 第二个 `destination` leg（target local）
- `scope = cross-map` 且 `reachable = false` 时，`legs` 只允许以下前缀形状之一：
  - `[]`
  - `[destination]`
  - `[destination, world]`
  - `[destination, world, destination]`
- `scope = cross-map` 且 `reachable = false` 时，已返回的前缀 `legs` 与其 `steps` 仍是有效且权威的结果，用于 partial route explanation 与 handoff 渲染
- `scope = cross-map` 时，只要存在 `world` leg，就必须提供 `entryPortalId` 与 `exitPortalId`
- `scope = cross-map` 时，`world` leg 的第一个 step 必须是 `portal-transfer(local-to-world)`，最后一个 step 必须是 `portal-transfer(world-to-local)`
- 当 `fromLocalNodeId` 缺失时，origin `destination` leg 边界固定在选中 `entryPortalId.localNodeId`
- 当 `toLocalNodeId` 缺失时，target `destination` leg 边界固定在选中 `exitPortalId.localNodeId`
- 上述“缺失 local node”场景仍必须保留 local/world/local 三段边界，允许对应 local leg 为 `distance = 0`、`cost = 0`、`steps = []`

## `WorldRoutePortalSelection`

`scope = cross-map` 时，portal 选择规则固定为确定性流程：

1. 枚举所有可行 `(entryPortalId, exitPortalId)` 组合。可行条件：
   - portal `direction` 与 `mode` 允许对应方向穿越
   - 两 portal 在 world graph 上可连通
2. 对每个组合提取排序键：
   - portal 优先级：`entry.priority` 与 `exit.priority`（数值越大优先级越高）
   - local-leg 成本：`originLocalCost + targetLocalCost`
   - transfer 成本：`entry.transferCost + exit.transferCost`
3. 按如下稳定顺序排序并取第一项：
   - `entry.priority` 降序
   - `exit.priority` 降序
   - `originLocalCost + targetLocalCost` 升序
   - `entry.transferCost + exit.transferCost` 升序
   - `entry.id` 字典序升序
   - `exit.id` 字典序升序

`portalSelection` 必填字段：

- `ruleVersion`（固定 `v1`）
- `candidatePairCount`
- `entryPortalId`
- `exitPortalId`
- `tieBreakOrder`

`tieBreakOrder` 固定值顺序：

- `entry-priority-desc`
- `exit-priority-desc`
- `local-leg-cost-asc`
- `transfer-cost-asc`
- `entry-id-asc`
- `exit-id-asc`

## `WorldRouteFailure`

必填字段：

- `stage`
- `reason`
- `code`

可选字段：

- `blockedFrom?`
- `blockedTo?`

`stage` 枚举：

- `origin-destination`
- `origin-portal`
- `world`
- `destination-portal`
- `destination-local`

`reason` 枚举：

- `unreachable`
- `mode_not_allowed`
- `direction_not_allowed`
- `world_disconnected`
- `portal_misconfigured`

`code` 枚举：

- `origin_local_unreachable`
- `origin_portal_unavailable`
- `world_segment_unreachable`
- `destination_portal_unavailable`
- `destination_local_unreachable`

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

冻结语义：

- `mode` 可为 `walk`、`bike`、`shuttle`、`mixed`
- `mixed` 是规划模式，不是独立物理交通方式
- `reachable = false` 时允许返回已成功规划出的前缀 `legs`
- 当前仓库已落地 backend route planning 与 `/map?view=world` 的 route summary、local/world/local handoff、以及基于返回 steps 的有序 explanation 渲染；本节继续冻结该接口的请求与响应 contract

请求体固定为以下二选一：

1) world-only

```json
{
  "scope": "world-only",
  "fromWorldNodeId": "string",
  "toWorldNodeId": "string",
  "strategy": "distance | time | mixed",
  "mode": "walk | bike | shuttle | mixed"
}
```

2) cross-map

```json
{
  "scope": "cross-map",
  "fromDestinationId": "string",
  "toDestinationId": "string",
  "fromLocalNodeId": "string?",
  "toLocalNodeId": "string?",
  "strategy": "distance | time | mixed",
  "mode": "walk | bike | shuttle | mixed"
}
```

成功响应：

- `200`

```json
{
  "item": {
    "reachable": true,
    "scope": "world-only | cross-map",
    "strategy": "distance | time | mixed",
    "mode": "walk | bike | shuttle | mixed",
    "legs": [],
    "summary": {
      "destinationDistance": 0,
      "worldDistance": 0,
      "transferDistance": 0,
      "destinationCost": 0,
      "worldCost": 0,
      "transferCost": 0
    },
    "totalDistance": 0,
    "totalCost": 0,
    "usedModes": []
  }
}
```

失败响应冻结如下：

- `409`

```json
{
  "error": "World mode is unavailable.",
  "code": "world_unavailable"
}
```

- `400`

```json
{
  "error": "Invalid world route request.",
  "code": "world_route_invalid_request",
  "issues": ["string"]
}
```

- `404`

```json
{
  "error": "Destination was not found.",
  "code": "world_route_destination_not_found",
  "destinationId": "string"
}
```

- `404`

```json
{
  "error": "Local node was not found in destination.",
  "code": "world_route_local_node_not_found",
  "destinationId": "string",
  "localNodeId": "string"
}
```

- `422`

```json
{
  "error": "Route mode is not allowed by selected edges or portals.",
  "code": "world_route_mode_not_allowed",
  "mode": "walk",
  "allowedModes": ["walk", "bike"]
}
```

- `409`

```json
{
  "error": "Portal binding is misconfigured.",
  "code": "world_route_portal_misconfigured",
  "portalId": "string"
}
```

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
