# World API Contract Draft

## 文档目的

本文档用于冻结 world mode 的 HTTP 合同边界，为后续服务实现与测试提供统一输入。

本文档不是服务代码。

它的目标是：

- 冻结 `/api/world` 系列接口的 MVP 合同
- 明确 summary / details / routes 的职责边界
- 明确失败语义和不可达语义

---

## 一、接口范围

本文档覆盖：

- `GET /api/world`
- `GET /api/world/details`
- `POST /api/world/routes/plan`

本文档不覆盖：

- `/api/bootstrap`
- 现有 `/api/routes/plan`
- 前端具体 fetch 实现

---

## 二、总原则

1. `/api/bootstrap` 继续保持轻量，不承载重型 world graph。
2. `GET /api/world` 是 world mode 的轻量摘要入口。
3. `GET /api/world/details` 返回重型 world 数据。
4. `POST /api/world/routes/plan` 只负责 world / cross-map 路由。
5. local map 现有 `/api/routes/plan` 保持单 destination 语义不变。

---

## 三、能力与降级约定

## 为什么要单独定义

world mode 是新增能力，不应让“世界数据缺失”看起来像服务器故障。

## 推荐规则

### `GET /api/world`

- endpoint 存在时应始终可调用
- 即使 world capability 不可用，也推荐返回 `200`

### world capability 不可用时

推荐返回：

- `enabled: false`
- `capabilities.worldView: false`
- 其余重型字段可省略

### `GET /api/world/details`

当 world capability 不可用时：

- 推荐返回 `409`
- 返回结构化错误

### `POST /api/world/routes/plan`

当 world capability 不可用时：

- 推荐返回 `409`
- 返回结构化错误

这样可以区分：

- endpoint 存在但功能关闭
- endpoint 根本不存在

---

## 四、GET `/api/world`

## 作用

返回 world mode 的轻量摘要。

## 目标

- 让前端判断 world mode 是否可用
- 提供首屏展示所需的最小数据
- 避免首屏加载重型 graph

## 请求

- Method: `GET`
- Query: 无

## 成功响应

推荐状态码：

- `200`

## MVP 响应字段

- `enabled`
- `world?`
- `regions`
- `destinations`
- `capabilities`

## 字段语义

### `enabled`

- world mode 是否可用

### `world`

建议仅保留：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`

### `regions`

建议只返回轻量摘要：

- `id`
- `name`

### `destinations`

建议只返回 placement 摘要：

- `destinationId`
- `label`
- `x`
- `y`
- `iconType`
- `regionId`

### `capabilities`

推荐字段：

- `worldView`
- `destinationRouting`
- `crossMapRouting`

## world 不可用时的推荐响应

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

## MVP 非目标

- 不返回 world graph
- 不返回 portals
- 不返回 route geometry

---

## 五、GET `/api/world/details`

## 作用

返回 world mode 的重型详情数据。

## 目标

- 只在需要 world graph 或 portal 明细时加载
- 供地图初始化、route polyline 和 portal 解释性展示使用

## 请求

- Method: `GET`
- Query: 无

## 成功响应

推荐状态码：

- `200`

## MVP 响应字段

- `world`

其中 `world` 应包含：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`
- `regions`
- `destinations`
- `graph`
- `portals`

## 说明

这是前端 world 渲染和路由解释真正依赖的重型 payload。

## world 不可用时的推荐错误

推荐状态码：

- `409`

推荐响应：

```json
{
  "error": "World mode is unavailable.",
  "code": "world_unavailable"
}
```

---

## 六、POST `/api/world/routes/plan`

## 作用

返回 world-only 或 cross-map 的 itinerary。

## 支持的请求模式

### 模式 A：destination 到 destination

推荐请求字段：

- `fromDestinationId`
- `toDestinationId`
- `mode`
- `strategy`

### 模式 B：local node 到 local node

推荐请求字段：

- `fromDestinationId`
- `fromLocalNodeId`
- `toDestinationId`
- `toLocalNodeId`
- `mode`
- `strategy`

## 通用请求约束

### `mode`

MVP 建议枚举：

- `walk`
- `bike`
- `shuttle`
- `mixed`

### `strategy`

MVP 建议枚举：

- `distance`
- `time`
- `mixed`

## 成功响应

推荐状态码：

- `200`

## MVP 响应字段

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

## 顶层 `scope`

建议枚举：

- `world-only`
- `cross-map`

## `legs[]` 合同

每一段建议字段：

- `scope`
- `distance`
- `cost`
- `steps`
- `destinationId?`
- `worldNodeIds?`
- `localNodeIds?`
- `entryPortalId?`
- `exitPortalId?`

### `scope` 枚举

- `destination`
- `world`

### MVP 关键约束

1. `portal` 不作为独立 leg scope。
2. portal 过渡通过 `entryPortalId` / `exitPortalId` 或 step metadata 表达。
3. `destination` leg 表示 local 段。
4. `world` leg 表示 world 段。

## 可达示例

```json
{
  "reachable": true,
  "scope": "cross-map",
  "strategy": "time",
  "mode": "mixed",
  "usedModes": ["walk", "shuttle"],
  "totalDistance": 2460,
  "totalCost": 1820,
  "summary": {
    "label": "Amber Bay · North Belt -> Lotus Learning Hub · River Arc",
    "legCount": 3
  },
  "legs": [
    {
      "scope": "destination",
      "destinationId": "dest-001",
      "localNodeIds": ["dest-001-gate", "dest-001-station"],
      "steps": [],
      "distance": 120,
      "cost": 90
    },
    {
      "scope": "world",
      "entryPortalId": "portal-dest-001-main",
      "exitPortalId": "portal-dest-008-main",
      "worldNodeIds": ["world-node-dest-001-main", "world-node-junction-river-crossing", "world-node-dest-008-main"],
      "steps": [],
      "distance": 2200,
      "cost": 1600
    },
    {
      "scope": "destination",
      "destinationId": "dest-008",
      "localNodeIds": ["dest-008-gate", "dest-008-lake"],
      "steps": [],
      "distance": 140,
      "cost": 130
    }
  ]
}
```

## 不可达语义

### 推荐规则

1. `reachable = false` 时，`legs` 不必为空。
2. `legs` 推荐返回已成功规划出的前缀段。
3. `failure` 表示首次失败发生的阶段。

### `failure` 建议字段

- `stage`
- `reason`
- `blockedFrom?`
- `blockedTo?`

### `failure.stage` 枚举

- `origin-destination`
- `origin-portal`
- `world`
- `destination-portal`
- `destination-local`

## 不可达示例

```json
{
  "reachable": false,
  "scope": "cross-map",
  "strategy": "time",
  "mode": "mixed",
  "usedModes": ["walk"],
  "totalDistance": 120,
  "totalCost": 90,
  "legs": [
    {
      "scope": "destination",
      "destinationId": "dest-001",
      "localNodeIds": ["dest-001-gate", "dest-001-station"],
      "steps": [],
      "distance": 120,
      "cost": 90
    }
  ],
  "failure": {
    "stage": "world",
    "reason": "No reachable portal-to-portal path.",
    "blockedFrom": "world-node-dest-001-main",
    "blockedTo": "world-node-dest-008-main"
  }
}
```

---

## 七、MVP 成本与 mixed 规则

路由合同必须与模型 draft 一致。

## 成本规则

1. local 段成本
   - 复用现有 local route 返回值
2. world edge 成本
   - `distance * (1 + congestion)`
3. transfer 成本
   - 每发生一次实际跨层穿越，累计一次 `transferCost`
4. `direction = bidirectional`
   - 只表示 portal 双向可用
   - 不表示单次切换双倍计费

## mixed 规则

1. `mixed` 不是独立交通工具
2. 不预设 `roadType` 隐藏优先级
3. 由可用显式模式、`strategy` 和成本公式共同决定路径
4. 若成本完全相同，再使用稳定 tie-break

推荐 tie-break：

- `shuttle`
- `bike`
- `walk`

---

## 八、推荐错误合同

## world capability 不可用

适用：

- `GET /api/world/details`
- `POST /api/world/routes/plan`

推荐状态码：

- `409`

推荐响应：

```json
{
  "error": "World mode is unavailable.",
  "code": "world_unavailable"
}
```

## 请求参数不合法

推荐状态码：

- `400`

推荐响应：

```json
{
  "error": "Invalid world routing request.",
  "code": "invalid_world_request"
}
```

## world 数据存在但引用不完整

推荐状态码：

- `500`

推荐响应：

```json
{
  "error": "World data is inconsistent.",
  "code": "invalid_world_data"
}
```

---

## 九、测试草案关注点

## `GET /api/world`

至少应覆盖：

1. world 可用时返回 `200`
2. world 不可用时仍返回 `200`
3. 不返回重型 `graph`
4. `capabilities` 与 `enabled` 一致

## `GET /api/world/details`

至少应覆盖：

1. world 可用时返回完整 world payload
2. world 不可用时返回 `409`
3. payload 中包含 `graph` 与 `portals`

## `POST /api/world/routes/plan`

至少应覆盖：

1. destination -> destination 可达
2. local -> local 可达
3. 不可达时返回 `failure`
4. 不可达时 `legs` 可返回前缀段
5. `portal` 不作为独立 leg scope
6. transfer 成本按单次穿越累计
7. `mixed` 不依赖隐藏 `roadType` 偏好

---

## 十、MVP 非目标

以下内容不属于当前合同的 MVP 范围：

- 世界图真实 GIS 几何导入
- 多 world map 支持
- tile-based 地图分片
- 动态 traffic 数据
- 复杂 portal 优化搜索
- browser 像素级地图回归测试

---

## 十一、下一步建议

本文档完成后，最合理的下一步是：

1. 将本稿映射到实际 service contract / payload type
2. 为 `/api/world` 与 `/api/world/details` 写最小 stub test
3. 再进入世界图渲染与路由服务的具体实现
