# 大地图模式 Spec 与 Plan

## 文档目的

本文档定义 `Trail Atlas` 的“大地图模式”方案，目标是在**保留现有各 `destination` 自有局部地图与局部路由能力不变**的前提下，引入一个新的世界级地图视图与跨地点导航能力。

本文档只描述方案，不包含实现代码。

本文档默认基于当前仓库实际约束编写：

- 前端是原生 SPA，不是 React
- 后端是 Node `http` 服务，不是 Express
- 当前数据以 seed 为核心
- 当前前端没有 bundler
- 当前 `/api/bootstrap` 是轻量摘要入口
- 当前 `/api/routes/plan` 只处理单 `destination` 内路由

对应的核心边界大致落在：

- `public/app.js`
- `public/spa/app-shell.js`
- `public/spa/views/map.js`
- `src/server/index.ts`
- `src/services/index.ts`
- `src/services/route-service.ts`
- `src/data/validation.ts`

还需要特别注意：

- 现有测试已经约束 `/api/bootstrap` 不应直接携带 destination `graph`
- 现有 seed 校验会把所有 destination 的 node / edge 展平后做全局唯一性检查
- 因此 world 级 node / edge / portal 不能沿用 local id 命名方式或与既有 id 空间混用

因此，所有设计都优先满足：

1. 可渐进接入
2. 不破坏现有地图与测试
3. 易于回滚
4. 优先降低实现复杂度

---

## 一、背景与问题定义

当前项目已经具备：

- 基于 `destination` 的局部地图展示
- 基于局部图的路线规划
- 周边设施、餐饮、游记、Feed、Exchange 等能力
- SPA 壳层与 JSON API

但当前地图能力的边界也很清晰：

1. 现有图结构是**每个地点各自独立的一张图**
   - 节点与边都属于单个 `Destination.graph`
   - 路由服务以 `destinationId` 为前提，只在单个地点内规划路线

2. 现有地图渲染是**局部图投影到固定 SVG 画布**
   - 当前 `Map` 页的渲染目标是让单个地点的图“完整放进一个固定卡片”
   - 它不是连续世界坐标，也不是可漫游世界地图

3. 现有路由模式并非只支持步行
   - 算法层支持 `walk`、`bike`、`shuttle`、`mixed`
   - 但当前数据中绝大部分边仍然属于步行类边，因此现阶段用户感知以步行为主

因此，如果要实现“类似开放世界游戏的大地图模式”，真正需要补的是：

- 一层新的**世界级图结构**
- 一层新的**世界级地图渲染与交互**
- 一套新的**跨图路由组合逻辑**

而不是重写现有局部地图。

---

## 二、目标与非目标

## 目标

本方案的目标是：

1. 增加一个新的世界地图视图，支持大地图浏览
2. 支持基础地图交互：
   - 缩放
   - 拖动
   - 点击地点
   - 高亮路线
3. 保留现有 `/map` 页的局部地图与局部路由
4. 支持世界级路线规划，并逐步演进到：
   - 起点局部段
   - 世界段
   - 终点局部段
5. 降低实现难度，优先选择成熟依赖而不是坚持零依赖

## 非目标

本方案**不追求**：

1. 首个版本就实现“完全无缝的开放世界室内外连续导航”
2. 首个版本就把现有 `/map` 页整体迁移到新的地图引擎
3. 首个版本就实现完整 GIS 级别地图样式系统
4. 引入 React 或重构整个前端框架
5. 把当前所有地点局部图重新制作成统一高精度真实世界地图

---

## 三、核心结论

## 结论摘要

推荐方案如下：

- **保留现有 `/map` 作为局部地图规划器**
- **优先把世界地图实现为 `/map?view=world` 的 `Atlas` 子模式**
- **前端地图依赖选择 `Leaflet`**
- **世界地图坐标系使用 `Leaflet` 的 `CRS.Simple`**
- **新增一层世界级图结构（world graph）**
- **通过 portal 机制把世界图与现有局部图连接**
- **首版保持顶层 `map` route loader 不变，由 `Map` 视图内部按子模式分流**

这是当前项目在“实现成本、稳定性、后续扩展性”之间最平衡的方案。

## 路由形态决策

世界地图有两种可行组织方式：

1. 新增独立路由 `/world-map`
2. 在现有 `/map` 下增加 `view=world`

本文档推荐第二种，即首版实现为：

- `/map?view=world`

原因：

- 当前 SPA 壳层已经把 `Map` 视为一个完整产品面
- 现有 `actor`、`destination`、返回跳转与 handoff 逻辑都围绕 `Map` 语义
- 先做子模式可以减少壳层改动、减少导航面扩张、减少回归面
- 等世界地图真正成长为独立产品面后，再拆成 `/world-map` 也不晚

## 为什么优先选 Leaflet

相对于“继续零依赖手写缩放拖动”，`Leaflet` 能显著降低实现难度，因为它原生提供：

- 地图容器与图层系统
- 平移与缩放
- 缩放控件
- marker、polyline、popup、bounds
- 自定义坐标系
- 图片叠加

相对于 `PixiJS`：

- `PixiJS` 更像渲染引擎，不是地图交互框架
- 如果只为了尽快得到好用的大地图交互，`Leaflet` 上手更快、工程成本更低

相对于 `MapLibre`：

- 当前项目不是地理经纬度优先的地图项目
- 当前需求更接近“游戏风格的自定义世界坐标平面”
- `CRS.Simple` 更适合先做 MVP

因此，当前阶段的最优解不是“最强”，而是“最省事地做成”。

---

## 四、现状评估

## 当前图模型

现有系统的图模型以 `Destination` 为中心：

- `DestinationNode`
- `DestinationEdge`
- `Destination.graph`

边上已经有以下关键字段：

- `distance`
- `congestion`
- `roadType`
- `allowedModes`

这说明算法层和数据层其实已经具备“多模式路由”的基础，只是范围被限定在单个地点。

## 当前路由服务

当前路线规划的边界是：

- 输入必须携带 `destinationId`
- 服务先找到单个 `destination`
- 再在该图内部做 `shortestPath` 或 `closedWalk`

这意味着：

- 现有服务边界不支持跨地点路由
- 想实现大地图跨地点导航，不能只改前端，必须加新的世界级服务能力

## 当前地图渲染

当前局部地图渲染有以下特点：

- 固定 `860 x 540` 的 SVG 画布
- 节点坐标会被自动 fit 到当前画布
- scene cache 以 `destinationId` 为粒度

这说明：

- 当前 `/map` 渲染模型非常适合“地点内地图”
- 不适合直接作为“世界地图渲染器”

## 当前模式支持的真实情况

当前算法支持：

- `walk`
- `bike`
- `shuttle`
- `mixed`

当前 seed 数据中的边类型大致呈现：

- 大多数边为 `walkway` 或 `indoor`
- 少量边为 `bike-lane`
- 少量边为 `shuttle-lane`

因此当前用户感知“路线基本还是步行”是合理的，但原因是**数据分布**，不是算法不支持多模式。

---

## 五、产品方案总览

## 用户视角的最终体验

引入 `world-map` 后，用户体验分为两层：

### 1. 世界地图层

用户可以：

- 缩放整个世界地图
- 拖动画面
- 查看所有地点的大致分布
- 查看世界级路线
- 点击某个地点进入该地点的局部地图

### 2. 局部地图层

用户进入某个地点后，继续使用现有 `/map` 页：

- 选择起点/终点
- 规划地点内路线
- 查看局部路径与节点
- 查看摘要卡片与细节

## 目标交互分层

### 首个可交付版本

首个可交付版本建议支持：

- 世界地图浏览
- 地点点击跳转
- 世界级路线展示
- 局部地图保持原样

### 第二阶段

第二阶段再加入：

- 世界图与局部图的 route composition
- 起点局部段 + 世界段 + 终点局部段

### 第三阶段

第三阶段再考虑：

- 更丰富的 world overlay
- 路段详情
- 世界图与局部图之间更自然的 handoff

---

## 六、依赖策略

## 新增依赖

推荐新增：

- `leaflet`
- `@types/leaflet`

## 集成原则

当前项目没有 bundler，前端通过 `public/index.html` 直接加载静态资源。因此依赖集成不能假设有 Vite、Webpack 或 React 构建链。

推荐的集成方式是：

1. 通过 npm 安装 `leaflet`
2. 增加一个 vendor 同步脚本，把 Leaflet 的浏览器资源复制到 `public/vendor/leaflet/`
3. 在 `public/index.html` 中显式引入：
   - Leaflet CSS
   - Leaflet JS
4. SPA 模块通过全局 `L` 或显式模块边界与 Leaflet 交互

## 不推荐的集成方式

### 不推荐：CDN 直连

原因：

- 本地离线或受限网络环境不稳定
- 与当前仓库“可本地运行”的交付方式不一致

### 不推荐：首个版本就引入 PixiJS 替代 Leaflet

原因：

- 交互能力还得自己搭
- 当前目标是降低实现难度，而不是获得最强渲染自由度

---

## 七、世界级数据模型设计

## 设计原则

世界级数据模型必须满足两件事：

1. 描述“大地图”本身
2. 连接“大地图”和“局部地图”

因此需要两类实体：

- 世界地图实体
- portal 连接实体

## 推荐新增的数据实体

### WorldMapRecord

用于描述世界地图本身。

建议字段：

- `id`
- `name`
- `width`
- `height`
- `backgroundImage`
- `regions`
- `destinations`
- `graph`

说明：

- MVP 中不建议单独保留 `bounds`
- 对于 `CRS.Simple` 下的矩形平面世界，Leaflet 初始化范围可直接由 `width` 和 `height` 推导
- 只有当未来出现偏移原点、非零起点或多层坐标空间时，再考虑把 `bounds` 作为扩展字段加回

建议作为 seed 顶层可选字段接入：

```json
{
  "version": "string",
  "generatedAt": "string",
  "facilityCategories": [],
  "destinations": [],
  "users": [],
  "journals": [],
  "world": {
    "...": "world map payload"
  }
}
```

说明：

- `world` 在首阶段应设计为可选字段，避免影响没有世界图数据的运行形态
- 当 `world` 缺失时，系统仍应保留现有局部地图行为
- 服务层应把“无 world 数据”视为 capability 缺失，而不是系统错误

### WorldRegionRecord

用于描述大地图上的区域边界，可用于 hover、高亮、分组。

建议字段：

- `id`
- `name`
- `polygon`
- `tags`

### WorldDestinationPlacement

用于描述一个现有 `destination` 在世界地图上的落点。

建议字段：

- `destinationId`
- `label`
- `x`
- `y`
- `radius`
- `regionId`
- `portalIds`
- `iconType`

语义约定：

- `WorldDestinationPlacement.x/y` 是世界层的视觉锚点
- 它优先服务 marker、label、hover、点击热区和分布表达
- 它可以与 portal 对应的 world node 坐标重合
- 但在架构上不应与 portal 坐标强绑定

原因：

- 一个 destination 未来可能对应多个 portal
- 一个 destination 的视觉中心不一定等于其主入口
- 如果把 placement 坐标和 portal 坐标绑定为同一概念，后续会影响多入口、标签布局和 route overlay 的解释性

补充字段语义：

- `radius`
  - 首版把它视为视觉与交互参考半径
  - 渲染层应将其转换为带上下限的像素热区，而不是随地图缩放无限等比放大或缩小
- `iconType`
  - 首版把它视为纯展示字段
  - 用于 marker 图标、标签风格和视觉分组
  - 不直接参与 route 计算

### WorldNodeRecord

世界图中的节点。

建议字段：

- `id`
- `x`
- `y`
- `kind`
  - `portal`
  - `junction`
  - `hub`
  - `region-center`
- `destinationId?`
- `label`
- `tags`

建议约束：

- world 级节点使用独立命名空间，例如 `world-node-*`
- 不复用现有 local node 的 id 空间
- world edge 只连 world node，不直接连 local node
- world node id、world edge id、portal id 都必须与当前 seed 中既有 id 全局去重
- 由于当前数据校验与查找逻辑默认依赖稳定 id，禁止让 world 节点直接复用 local node id

### WorldEdgeRecord

世界图中的边。

建议字段：

- `id`
- `from`
- `to`
- `distance`
- `roadType`
  - `road`
  - `rail`
  - `trail`
  - `ferry`
  - `tunnel`
  - `airlift`
  - `bridge`
- `allowedModes`
- `congestion`
- `bidirectional`

MVP 语义建议：

- `allowedModes` 优先表达显式物理通行模式
- `mixed` 更适合作为请求层的规划模式，而不是 edge 的物理模式
- 为兼容当前合同，seed 中暂时允许出现 `mixed`
- 但世界层规划不应把 `mixed` 当成独立交通工具

### DestinationPortalRecord

这是最关键的桥接实体，用于把世界图和局部图接起来。

建议字段：

- `id`
- `destinationId`
- `worldNodeId`
- `localNodeId`
- `portalType`
  - `main-gate`
  - `dock`
  - `bike-entry`
  - `shuttle-stop`
- `label`
- `priority`
- `allowedModes`
- `direction`
- `transferDistance?`
- `transferCost?`

## 世界坐标与渲染坐标约定

这个约定必须在实现前冻结，否则后续 destination placement、portal 落点、route polyline 很容易反复返工。

推荐规则如下：

1. world 数据层统一使用 `{ x, y }`
   - 原点在左上角
   - `x` 向右增加
   - `y` 向下增加
2. 世界底图尺寸与 world 坐标使用同一尺度
   - 例如 `width = 4096`
   - `height = 3072`
   - 所有 region、destination placement、world node 都使用这一套坐标
3. Leaflet 渲染层负责做坐标翻译
   - 数据层保持 `{ x, y }`
   - 进入 `CRS.Simple` 后再转换为 `[y, x]`
4. 首版不混用百分比坐标、像素坐标、归一化坐标
5. 首版建议使用整数坐标，便于手工维护与 diff review

补充约定：

- `WorldDestinationPlacement.x/y` 和 `WorldNodeRecord.x/y` 使用同一坐标系
- 但二者不要求数值相同
- 前者是视觉锚点
- 后者是拓扑锚点
- 最短路计算只依赖 world graph node 与 edge，不依赖 placement 坐标
- Leaflet 的世界边界可直接由 `[0, 0]` 到 `[height, width]` 推导，不要求额外 `bounds`

如果后续需要更复杂的地图精度，再在数据层之上增加转换规则，而不是从第一版就引入多套坐标体系。

## 为什么 portal 是必须的

因为现有系统中，局部图节点和世界图节点不是同一套坐标、也不是同一张图。

没有 portal，就无法可靠表达：

- 从局部图走到世界图
- 从世界图进入目标局部图

portal 是分层图之间的“合法入口”。

---

## 八、数据来源与用户需要提供的数据

## 最低可用数据

如果你只想先做 MVP，最低可用数据包括：

1. 一张世界地图背景图
2. 每个地点在大地图上的坐标
3. 世界级节点表
4. 世界级边表
5. 每个地点的 portal 映射表

## 最理想的数据

最理想的是结构化数据，而不是只有图片。

推荐优先级如下：

### 高优先级

- 世界地图底图
- 地点位置坐标
- 世界图节点
- 世界图边
- portal 映射

### 中优先级

- 区域边界 polygon
- 交通模式标签
- 地图图标资源

### 低优先级

- 更复杂的视觉装饰
- 地图动画素材

## 如果你只能先提供图片

也可以做，但能力会受限：

- 能先做展示层
- 能做点击进入地点
- 但世界路线必须由我们后续手工补图结构

结论是：

- `图片` 够做展示
- `结构化图数据` 才够做导航

## 推荐 seed 形态草案

下面是一份足够支撑 MVP 的世界图数据草案，便于后续继续细化为 TypeScript 类型。

```json
{
  "world": {
    "id": "world-main",
    "name": "Main Atlas",
    "width": 4096,
    "height": 3072,
    "backgroundImage": "/assets/world-map/world-main.png",
    "regions": [
      {
        "id": "world-region-north",
        "name": "Northern Range",
        "polygon": [[120, 200], [640, 160], [760, 520], [180, 560]],
        "tags": ["mountain", "cold"]
      }
    ],
    "destinations": [
      {
        "destinationId": "dest-001",
        "label": "River Town",
        "x": 842,
        "y": 1160,
        "radius": 22,
        "regionId": "world-region-north",
        "portalIds": ["portal-dest-001-main"],
        "iconType": "town"
      }
    ],
    "graph": {
      "nodes": [
        {
          "id": "world-node-dest-001-main",
          "x": 860,
          "y": 1180,
          "kind": "portal",
          "destinationId": "dest-001",
          "label": "River Town Gate",
          "tags": ["gate"]
        }
      ],
      "edges": [
        {
          "id": "world-edge-001",
          "from": "world-node-dest-001-main",
          "to": "world-node-dest-002-main",
          "distance": 1800,
          "roadType": "road",
          "allowedModes": ["walk", "bike", "shuttle", "mixed"],
          "congestion": 0.15,
          "bidirectional": true
        }
      ]
    },
    "portals": [
      {
        "id": "portal-dest-001-main",
        "destinationId": "dest-001",
        "worldNodeId": "world-node-dest-001-main",
        "localNodeId": "dest-001-gate",
        "portalType": "main-gate",
        "label": "Main Gate",
        "priority": 100,
        "allowedModes": ["walk", "bike", "shuttle", "mixed"],
        "direction": "bidirectional",
        "transferDistance": 20,
        "transferCost": 10
      }
    ]
  }
}
```

这份草案的作用不是定死字段，而是先冻结三件事：

1. `world` 是独立层
2. `portal` 是跨层桥
3. 跨图导航返回值必须保留“分段”语义

---

## 九、后端与服务层方案

## 新增模块建议

建议新增以下服务模块：

- `src/services/world-service.ts`
- `src/services/world-route-service.ts`
- `src/data/world-map.ts`

必要时新增：

- `src/domain/world-models.ts`

或者，如果你希望 contracts 统一，也可以把世界图相关接口并入 `src/services/contracts.ts`。

## world-service 的职责

职责应包括：

- 返回世界地图元数据
- 返回地点在世界地图上的 placement
- 返回世界图节点与边
- 返回 portal 映射

## world-route-service 的职责

职责应包括：

- 在世界图上规划世界级路径
- 在跨图模式下组合：
  - 起点局部段
  - 世界段
  - 终点局部段

## 推荐 API

### GET `/api/world`

返回轻量 world summary：

- 世界地图基本信息
- 区域摘要
- 地点 placement 摘要
- capability 位

建议返回示例：

```json
{
  "enabled": true,
  "world": {
    "id": "world-main",
    "name": "Main Atlas",
    "width": 4096,
    "height": 3072,
    "backgroundImage": "/assets/world-map/world-main.png"
  },
  "regions": [
    {
      "id": "world-region-north",
      "name": "Northern Range"
    }
  ],
  "destinations": [
    {
      "destinationId": "dest-001",
      "label": "River Town",
      "x": 860,
      "y": 1180,
      "iconType": "town"
    }
  ],
  "capabilities": {
    "worldView": true,
    "destinationRouting": false,
    "crossMapRouting": false
  }
}
```

### GET `/api/world/details`

返回重型 world 数据：

- world graph
- portal 信息
- 可选 overlay 元数据

### POST `/api/world/routes/plan`

这是新的世界级路线规划入口。

建议输入支持两类请求：

#### 模式 A：地点到地点

- `fromDestinationId`
- `toDestinationId`
- `mode`
- `strategy`

建议请求示例：

```json
{
  "fromDestinationId": "dest-001",
  "toDestinationId": "dest-008",
  "mode": "mixed",
  "strategy": "time"
}
```

#### 模式 B：局部点到局部点

- `fromDestinationId`
- `fromLocalNodeId`
- `toDestinationId`
- `toLocalNodeId`
- `mode`
- `strategy`

建议请求示例：

```json
{
  "fromDestinationId": "dest-001",
  "fromLocalNodeId": "dest-001-gate",
  "toDestinationId": "dest-008",
  "toLocalNodeId": "dest-008-lake",
  "mode": "walk",
  "strategy": "distance"
}
```

### 返回结构建议

建议返回统一 itinerary 结果：

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

其中 `legs` 为数组，每一段显式标注：

- `scope`
  - `world`
  - `destination`
- `destinationId?`
- `worldNodeIds?`
- `localNodeIds?`
- `entryPortalId?`
- `exitPortalId?`
- `steps`
- `distance`
- `cost`

当 `reachable: false` 时，建议增加：

- `failure.stage`
  - `origin-destination`
  - `origin-portal`
  - `world`
  - `destination-portal`
  - `destination-local`
- `failure.reason`
- `failure.blockedFrom?`
- `failure.blockedTo?`

MVP 约定：

- `portal` 不作为独立 leg scope
- portal 穿梭动作应附着在相邻的 `destination` leg 或 `world` leg 上
- 推荐通过 `entryPortalId`、`exitPortalId` 或 step metadata 表达 portal 边界

建议返回示例：

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
    "label": "River Town -> Lake Camp",
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
      "worldNodeIds": ["world-node-dest-001-main", "world-node-hub-2", "world-node-dest-008-main"],
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

这样前端就能按段展示，而不是强行把跨图结果压平为单一 `nodeIds`。

### 不可达结果建议

为了让前端能正确提示“断在哪一段”，建议明确以下约定：

1. 当 `reachable: false` 时，`legs` 不必强制为空数组
2. `legs` 应返回已经成功规划出的前缀段
3. 新增 `failure` 字段指出首次失败发生的阶段
4. 如果在第一段就失败，可返回：
   - `legs: []`
   - `failure.stage = "origin-destination"` 或 `"origin-portal"` 或 `"world"`

建议示例：

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

## 为什么不建议把 world 数据塞进 `/api/bootstrap`

当前项目已经把 `/api/bootstrap` 约束为轻量摘要入口。如果把 world graph 塞进去，会直接放大初始 payload，并破坏当前初始化边界。

更稳妥的方式是：

- `/api/bootstrap` 只返回 capability 或轻量 world 摘要
- world graph 与 portal 明细走独立接口

## 为什么不建议直接改现有 `/api/routes/plan`

因为现有 `/api/routes/plan` 的语义非常清晰：

- 它就是单个 `destination` 内的路线规划

如果直接把它扩成跨图接口：

- 语义会变脏
- 回归风险更高
- 现有测试会更难维护

因此建议新开世界级接口。

---

## 十、跨图路由策略

## 路由组合思路

跨图路线规划建议使用“三段式组合”：

1. 起点局部段
2. 世界段
3. 终点局部段

## 具体算法流程

### 情况 A：起点与终点都只给到 destination

流程：

1. 为起点 destination 选默认 portal
2. 为终点 destination 选默认 portal
3. 在世界图上规划 portal 到 portal 的路径
4. 返回世界段结果

这是最简单的世界级导航版本。

### 情况 B：给定起点局部节点与终点局部节点

流程：

1. 在起点 destination 局部图里，从 `fromLocalNodeId` 到起点 portal 做局部规划
2. 在世界图里，从起点 portal 对应 world node 到终点 portal 对应 world node 做世界级规划
3. 在终点 destination 局部图里，从终点 portal 到 `toLocalNodeId` 做局部规划
4. 组合三段结果并汇总总距离、总成本、已使用模式

## portal 选择策略

第一版不必做复杂优化，建议先实现：

- 每个地点一个主 portal
- 默认走 `priority` 最高的 portal

第二版再考虑：

- 不同 mode 使用不同 portal
- 多 portal 尝试并取最低成本组合

## MVP 成本公式建议

在正式实现前，建议先冻结 MVP 版本的总成本计算规则，避免测试和服务实现长期悬空。

推荐规则：

1. local 段成本
   - 直接复用现有 local route service 返回的 `totalCost`
2. world edge 成本
   - 单条边成本 = `distance * (1 + congestion)`
3. portal 切换成本
   - 每次实际跨层穿越额外增加一次 `transferCost`
   - 缺省时按 `0` 处理
   - `bidirectional` 只表示该 portal 可双向使用
   - 它不改变单次穿越的计费规则
4. 总成本
   - `totalCost = sum(localLeg.cost) + sum(worldEdgeCost) + sum(portalTransferCost)`
5. 总距离
   - `totalDistance = sum(localLeg.distance) + sum(worldEdge.distance) + sum(portalTransferDistance)`

补充冻结规则：

- `transferCost` 和 `transferDistance` 在 MVP 中都视为“单次穿越成本”
- 一次从 local 层进入 world 层，累加一次
- 一次从 world 层进入目标 local 层，再累加一次
- 不因 portal 的 `direction = "bidirectional"` 而重复计费

示例：

- local -> world -> local 的完整跨图路线
  - 总共发生两次层级穿越
  - 因此累计两次 transfer cost / distance

## mixed 模式的世界层规则

为了避免 world routing 在 `mode = "mixed"` 时出现隐含偏置，建议先冻结以下 MVP 规则：

1. `mixed` 不代表一种独立物理交通工具
2. world planner 在 `mixed` 模式下，不预设 `roadType` 优先级
3. 对每条候选 edge，应在可用显式模式中选择最低成本的通过方式
   - 候选显式模式为 `walk`、`bike`、`shuttle`
4. 若多种显式模式成本完全相同，再使用稳定的 tie-break 顺序：
   - `shuttle`
   - `bike`
   - `walk`
5. 因此：
   - `mixed` 不会天然偏向 `trail`
   - 也不会天然偏向 `tunnel`
   - 它只偏向总成本更低的组合

推荐原因：

- local 层无需重写成本定义
- world 层成本公式足够简单
- portal 成本可被稳定纳入测试
- 后续若需替换为更复杂公式，也有清晰升级路径

## 为什么先不做“统一超大图”

因为当前最稳的策略是“图组合”，而不是“坐标强行统一”。

组合式好处：

- 可复用现有局部路由算法
- 可逐步演进
- 不会一次性重构所有现有地图数据

---

## 十一、前端方案

## 新增页面

建议在首版不新增独立路由，而是在现有 `Map` 视图内新增：

- `/map?view=world`

这里需要明确一下实现边界：

- `app-shell` 仍然只把 `/map` 解析为 `map` 视图
- 不新增新的顶层 view loader
- 只在 route query 中新增 `view=world`
- 由 `public/spa/views/map.js` 判断当前是局部模式还是世界模式
- 如需降低 `map.js` 复杂度，再由 `map.js` 委派到 `public/spa/views/map-world.js`

这样做更符合当前仓库结构，因为现有导航高亮、壳层切换、`buildMapHref()`、actor context 都已经围绕 `Map` 产品面建立。

## 页面职责

`view=world` 的职责：

- 展示世界底图
- 展示地点分布
- 展示世界路线
- 提供缩放、拖动、定位
- 提供到局部地图的 handoff

## 页面布局建议

推荐采用两栏布局：

### 左栏

- 世界路线控制区
- 起点/终点 destination 选择
- mode / strategy 选择
- 路线摘要
- “进入局部地图”快捷入口

### 右栏

- Leaflet 世界地图容器
- 世界图加载状态
- 空数据降级提示
- capability 缺失提示

## 交互细节

### 缩放

必须支持：

- 鼠标滚轮缩放
- 控件按钮缩放
- `fit world` / `fit route` 快捷动作

建议约束：

- `minZoom`
- `maxZoom`
- 初始 `fitBounds`

### 拖动

必须支持：

- 鼠标拖动
- 触控板平移

### 地点交互

建议支持：

- hover 显示名称
- click 选中
- click 跳转现有 `/map?destinationId=...`

### 路线展示

第一版展示：

- 世界路线 polyline
- 起终点 marker
- portal marker

第二版展示：

- 不同模式不同线型/颜色
- 分段摘要

## world edge 的首版视觉映射建议

为了减少审阅和实现歧义，建议首版就明确 `roadType` 同时影响：

- route cost 计算
- world polyline 的默认视觉样式

推荐映射：

- `road`
  - 普通实线
- `trail`
  - 更细的虚线
- `rail`
  - 更强对比的双线或重线
- `bridge`
  - 高亮实线，并强化 crossing 感
- `tunnel`
  - 深色虚线或断续线
- `ferry`
  - 点状或波纹式线型

首版不必做复杂主题皮肤，但至少应保证用户看得出：

- 哪些是桥
- 哪些是隧道
- 哪些是普通陆路

## placement 与 portal 的首版视觉连线规则

由于 `placement` 和 `portal` 坐标已经显式解耦，前端需要一个稳定的默认规则。

推荐 MVP 规则：

1. 路线 polyline 只画到拓扑节点
   - 即画到 `world node`
   - 不自动补一条到 `placement` 的常驻连线
2. destination marker 继续使用 `placement.x/y`
3. 只有在以下场景，才可选地显示一条轻量 leader line：
   - 用户选中了某个 destination
   - 且该 destination 的 `placement` 与 active portal 明显分离
4. 这条 leader line 只服务解释性展示
   - 不参与 route 计算
   - 不参与长度统计

这样可以避免首版世界图出现过多常驻虚线，保持画面干净。

## 与现有 `/map` 的 handoff

推荐支持两种 handoff：

### 世界图到局部图

点击地点：

- 进入 `/map?destinationId=...`

### 世界路线到局部图

如果用户在世界图里规划了跨图路线：

- 点击起点段可进入起点局部图
- 点击终点段可进入终点局部图

## 首版 URL 约定建议

为了避免首版实现时 URL 语义混乱，建议统一以下约定：

- 世界图浏览：`/map?view=world`
- 世界图浏览并预选 actor：`/map?view=world&actor=user-1`
- 世界图浏览并高亮起终点：`/map?view=world&fromDestinationId=dest-001&toDestinationId=dest-008`
- 局部图：`/map?destinationId=dest-001`
- 世界图跳回局部图并保留 actor：`/map?destinationId=dest-001&actor=user-1`

约束：

- `view=world` 与 `destinationId` 不应同时作为主视图判定条件
- 若 URL 中二者同时存在，推荐以 `view=world` 优先，并把 `destinationId` 仅作为辅助预选上下文
- 若 world capability 不存在，访问 `view=world` 时应降级为说明态，而不是 500

---

## 十二、前端模块边界建议

建议新增或调整的前端文件如下：

### 新增

- `public/spa/views/map-world.js`
- `public/spa/world-map-rendering.js`
- `public/world-map/` 或 `public/assets/world-map/`
- `public/vendor/leaflet/`

### 调整

- `public/index.html`
- `public/app.js`
- `public/spa/app-shell.js`
- `public/spa/views/map.js`
- `public/styles.css`
- `tests/spa-regressions.test.ts`
- `tests/runtime-services.test.ts`
- `tests/data-seed.test.ts`
- `tests/integration-smoke.test.ts`

## 模块职责建议

### `map-world.js`

负责：

- 页面结构
- 表单控制
- 事件绑定
- API 请求
- 与 `app-shell` 状态协作

### `world-map-rendering.js`

负责：

- Leaflet 实例初始化
- layer 管理
- marker / route / portal overlay
- `fit world` / `fit route`
- map instance 生命周期管理

### `app-shell.js`

需要新增：

- `view=world` 查询参数解析
- world capability / summary 缓存
- world map 状态缓存

## URL 与查询参数合同

推荐首版在 `/map` 下新增以下查询参数：

- `view`
  - 缺省表示现有局部地图模式
  - `world` 表示世界地图模式
- `worldFrom`
  - 世界地图模式中的起点 `destinationId`
- `worldTo`
  - 世界地图模式中的终点 `destinationId`
- `focusDestinationId`
  - 可选，用于从世界图聚焦某个地点
- `mode`
  - 复用现有出行模式枚举
- `strategy`
  - 复用现有路线策略枚举

约束建议：

1. 局部地图已有的 `destinationId`、`from`、`to`、`waypoints` 保持原语义不变
2. world 模式不要复用 `from` / `to` 指向 local node，避免参数语义冲突
3. 所有 world 模式 URL 都通过 `app.buildMapHref()` 生成，避免字符串散落
4. 当 `view` 缺失或值非法时，自动回退到现有局部地图模式

## World 子模式的页面状态流转

推荐使用以下状态流转：

1. 进入 `/map?view=world`
2. 渲染 world 容器骨架与 loading 占位
3. 拉取 `/api/world`
4. 用户首次发起路线规划或需要 portal 明细时，再拉取 `/api/world/details`
5. 提交 `/api/world/routes/plan`
6. 离开 world 子模式时销毁 Leaflet instance，但保留 world summary 缓存

这套流转与当前项目的 `bootstrap -> details on demand` 模式一致，回归风险更低。

---

## 十三、状态管理与缓存

## 新增状态建议

在 SPA 状态层增加：

- `worldBootstrap`
- `worldBootstrapPromise`
- `worldDetails`
- `worldDetailsPromise`
- `worldScene`
- `worldRoute`
- `selectedWorldDestinationId`

## 缓存原则

### 世界地图数据

可长期缓存于内存，因为：

- 大地图元数据相对稳定
- 用户会频繁缩放、切换与重绘

### Leaflet 实例

建议按 `Map` 子模式生命周期管理，不建议全局永久驻留。

### 局部地图 scene

沿用现有 `mapScenes` 策略，不要强行合并进 world scene。

## 状态机建议

建议把世界图前端状态显式拆成以下几个 UI 态：

1. `unavailable`
   - world capability 不存在
   - 只展示说明，不尝试初始化 Leaflet
2. `loading-summary`
   - 正在请求 `/api/world`
3. `loading-details`
   - 首次进入世界图且正在请求重型 graph 数据
4. `ready`
   - 已具备地图、地点、交互能力
5. `routing`
   - 正在请求 `/api/world/routes/plan`
6. `error`
   - world summary、details、route 任一请求失败

这样做的好处是：

- UI 降级路径清晰
- 更容易写 SPA 回归测试
- 错误恢复逻辑不会和局部地图状态混在一起

---

## 十四、依赖与资源接入计划

## 依赖接入建议

推荐的工程路径：

1. 安装 Leaflet 依赖
2. 新增一个 vendor 资源同步脚本
3. 把 Leaflet 浏览器资源复制到 `public/vendor/leaflet/`
4. 在 `public/index.html` 中显式引入 vendor 资源
5. 仅在 `view=world` 时初始化 Leaflet

## 推荐原因

这样做的好处是：

- 不要求引入 bundler
- 与当前静态资源结构一致
- 前端运行不依赖外网
- 依赖边界清晰

## 不建议做的事情

- 不建议先把整个前端迁移到 React
- 不建议先引入大型状态管理框架
- 不建议把现有局部 SVG 地图重写为 Leaflet 图层

## 资源组织建议

推荐把世界图相关资源收敛到以下目录之一：

- `public/assets/world-map/`
- `public/world-map/`

目录中至少应包含：

- 底图图片
- 可选的 marker icon
- 可选的 region overlay 静态资源

推荐增加一个 vendor 同步脚本，例如：

- `scripts/sync-leaflet-assets.ts`

职责：

- 从 `node_modules/leaflet/dist/` 复制浏览器资源
- 同步到 `public/vendor/leaflet/`
- 让 `npm install` 后的资源状态可重复构建

---

## 十五、测试策略

## 数据与算法测试

建议新增：

- 世界图数据校验测试
- portal 连通性测试
- 世界级 shortest path 测试
- 跨图组合路由测试

## 服务测试

建议新增：

- `world bootstrap` API 测试
- `world routes plan` API 测试
- 跨地点失败路径测试
- `/api/bootstrap` 继续保持轻量摘要的回归测试

## 前端测试

建议新增：

- `view=world` 加载测试
- 表单与结果卡片测试
- actor context 保留测试
- 点击地点后 handoff 测试
- world capability 缺失测试
- world request 失败测试
- 默认 `/map` 仍走现有局部地图流程的回归测试

## 交互测试策略

不建议在首版就做复杂的浏览器像素级截图测试。

更合理的是：

- 断言容器与 layer hook 存在
- 断言 route 结果数据正确渲染
- 断言 handoff URL 正确

如果后续再做浏览器自动化，可增加：

- 初始视图是否 fit 全图
- 点击某个 marker 是否聚焦
- 路线绘制是否可见

---

## 十六、风险评估

## 最高风险：数据质量

最大风险不是 Leaflet，不是缩放拖动，而是：

- 世界图是否有足够结构化数据
- portal 是否定义合理
- 世界图与局部图是否真的能连起来

## 中风险：交互边界

风险包括：

- 点击和拖拽误判
- route overlay 与 marker 层级冲突
- 世界图与局部图切换后用户迷失

## 中风险：结果表达

跨图路线不是一段线，而是多段组合。

如果结果表达不清晰，用户会误以为：

- 世界路线和局部路线在同一图层
- 或者以为局部地图已经被世界图替代

因此结果 UI 必须显式说明“分段”。

## 低风险：Leaflet 接入本身

只要资源接入方案明确，Leaflet 本身不是主要风险。

## 新增风险：性能与资源体积

如果世界底图过大，首版还会遇到：

- 首屏进入世界图加载慢
- 移动设备内存占用偏高
- route overlay 在缩放过程中重绘开销偏高

因此建议：

- 首版限制底图分辨率
- 优先单张底图，不急于切 tile
- 世界图节点量控制在 MVP 可视范围内
- 只有在 `view=world` 下才加载 Leaflet 及 world details

---

## 十七、难度评估

## 按模块评估

### 低难度

- Leaflet 接入
- 世界图缩放/拖动
- 世界图地点 marker
- 点击地点进入现有 `/map`

### 中等难度

- 世界图数据模型
- 世界路线展示
- world bootstrap API
- SPA 与新页面的整合

### 中高难度

- portal 设计
- 跨图路线组合
- route 结果分段表达

### 高难度

- 真正无缝的开放世界地图
- 室内外连续缩放过渡
- 复杂动态地图样式系统

## 总体评估

对于个人项目：

- 世界图浏览 + 点击跳转：难度可控
- 跨图导航：可做，但要先把数据模型设计好
- 无缝世界：不建议在首版目标里承诺

---

## 十八、实施阶段计划

## 阶段 0：方案冻结与数据准备

### 目标

冻结世界图数据合同与依赖策略。

### 输出

- 确认采用 `Leaflet + CRS.Simple`
- 确认 world graph 结构
- 确认 portal 结构
- 确认数据来源与文件格式

### 验证

- 有一份可加载的世界图 JSON 数据草稿
- 能明确列出每个 destination 对应的 portal
- 能确认 world capability 缺失时的降级行为

---

## 阶段 1：世界地图浏览 MVP

### 目标

先做“看得见、能拖、能缩、能点”的 world map。

### 范围

- 引入 Leaflet
- 在 `Map` 页增加 `view=world` 子模式
- 加载世界底图
- 渲染地点 marker
- 支持 zoom / pan
- 点击进入局部地图

### 不做

- 不做跨图导航
- 不改现有 `/map`
- 不改现有 `/api/routes/plan`

### 验证

- `/map?view=world` 可访问
- 世界图可缩放与拖动
- 点击地点能跳转到正确的 `/map?destinationId=...`
- 在无 world 数据时页面可正确降级

---

## 阶段 2：世界图路线规划

### 目标

支持 destination 到 destination 的世界级路径。

### 范围

- 新增 `world bootstrap`
- 新增 `world route planning`
- 世界级 polyline 渲染
- 起终点 marker
- 路线摘要卡片

### 不做

- 不做局部节点到局部节点的全链路组合
- 不做多 portal 组合优化

### 验证

- 可从地点 A 到地点 B 规划世界路线
- 支持 mode / strategy
- 支持不可达状态
- 路由结果以 `legs[]` 返回，而不是复用局部 `nodeIds`

---

## 阶段 3：跨图组合路由

### 目标

把局部图与世界图拼起来，形成真正的“跨地点导航”。

### 范围

- 引入 portal
- 局部段 + 世界段 + 局部段
- 新 route result 结构
- 前端分段展示

### 验证

- 指定起点局部节点与终点局部节点时，可返回组合路径
- 每一段结果都能解释来源
- 现有局部 `/map` 路由不受破坏
- 失败时能够指出失败发生在起点局部段、世界段还是终点局部段

---

## 阶段 4：体验完善

### 目标

让大地图模式具备稳定可用的产品体验。

### 范围

- `fit route`
- 更明确的入口/出口提示
- 世界图与局部图的手动切换入口
- 文档与 README 同步
- 更完整测试

### 验证

- 用户能理解当前看到的是世界段还是局部段
- world mode 与 planner mode 的导航关系清晰
- 主要回归测试维持稳定

---

## 十九、特性开关与回滚方案

## 为什么必须有回滚

当前项目仍处于快速演进阶段，大地图模式横跨：

- seed 数据
- 服务层
- HTTP API
- SPA 视图
- 第三方前端依赖

因此必须保证：

- 新能力可以关闭
- 关闭后现有 `/map` 可继续工作
- 出问题时能快速回退到“只有局部地图”的形态

## 推荐开关策略

建议至少保留两层开关：

### 数据开关

- seed 中没有 `world` 字段时，视为 world mode 不可用

### 能力开关

- `/api/world` 返回 `enabled: false`
- 前端据此隐藏或降级世界图入口

## 回滚路径

如果阶段 1 或阶段 2 出现问题，推荐回滚策略为：

1. 保留 `Leaflet` 资源与代码文件
2. 关闭 world capability
3. 隐藏 `/map?view=world` 主入口
4. 保持现有 `/map?destinationId=...` 不变

这样可以做到：

- 不必立即删除未使用代码
- 不会影响局部地图既有逻辑
- 回滚成本主要落在 capability 控制，不落在数据迁移

---

## 二十、推荐实施分工

如果后续正式进入实现，建议按以下边界拆给不同 Agent 或不同提交：

1. 数据合同与校验
   - 负责 `src/domain`、`src/services/contracts.ts`、`src/data/validation.ts`、seed 草案
   - 产出 world 数据结构、portal 结构、校验规则
2. 服务层与 API
   - 负责 `src/services`、`src/server/index.ts`
   - 产出 `/api/world`、`/api/world/details`、`/api/world/routes/plan`
3. 前端世界图视图
   - 负责 `public/index.html`、`public/app.js`、`public/spa/app-shell.js`、`public/spa/views/map-world.js`、`public/spa/world-map-rendering.js`、样式
   - 产出 world mode UI、Leaflet 渲染、URL handoff
4. 测试与文档
   - 负责 `tests/*`、README、world 文档同步
   - 产出数据、服务、SPA、集成回归覆盖

分工原则：

- 一个子任务只覆盖一组清晰文件边界
- world 数据结构与 world UI 不应在同一个子任务里同时大改
- 测试补齐可以并行，但必须基于已冻结的数据合同

---

## 二十一、任务拆分建议

为了降低耦合，建议把后续实现拆成以下独立子任务：

1. 依赖与静态资源接入
2. 世界图数据结构与 seed 草案
3. 世界图 API 与服务层
4. world mode 页面与 Leaflet 渲染
5. 世界级路由算法
6. 跨图组合逻辑
7. 文档与测试补齐

这些任务的写入边界应尽量保持独立，避免多人或多轮修改时相互覆盖。

---

## 二十二、验收标准

## 第一层验收

- `/map?view=world` 页面可打开
- 世界地图可缩放、可拖动
- 地点可点击
- 可跳转到现有局部 `/map`

## 第二层验收

- 世界级路线规划成功
- 世界路线按模式与策略返回合理结果
- 路线可视化与摘要一致

## 第三层验收

- 跨图组合路由可用
- 现有局部图能力不退化
- `npm test` 继续通过

---

## 二十三、开放问题

在正式实现前，仍需你确认或提供：

1. 你希望世界地图底图是：
   - 游戏风格平面图
   - 真实地图抽象图
   - 纯功能拓扑图

2. 你能提供的数据类型是：
   - 只有图片
   - 图片 + 地点坐标
   - 图片 + 世界节点边数据
   - 完整结构化图数据

3. 首个版本是否允许：
   - 世界图只支持 destination 到 destination 路线
   - 跨局部节点组合延后到下一阶段

4. 大地图首页入口放在哪里：
   - 首页
   - Explore
   - Map 页
   - 独立导航项

---

## 二十四、推荐决策

如果现在要进入实施，我推荐立即冻结以下决策：

1. 地图依赖使用 `Leaflet`
2. 坐标系使用 `CRS.Simple`
3. 保留现有 `/map`
4. 首版将世界地图实现为 `/map?view=world`
5. 新增 `world graph + portal`
6. 先做世界图浏览与 destination 级路线，再做跨局部节点组合

这套决策最符合你的真实目标：

- 项目不大
- 个人开发
- 优先降低实现难度
- 不执着于零依赖

---

## 二十五、下一步建议

建议下一步直接进入“数据合同定稿”：

1. 先定义世界图 JSON 结构
2. 先拿一份最小可用的世界地图数据样例
3. 再开始阶段 1 的实现

如果你后续愿意继续，我建议下一轮就按这份文档继续产出：

- 世界图数据 schema 草案
- API contract 草案
- 页面结构草图
- 第一阶段实际任务清单
