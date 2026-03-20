# 大地图 UI 结构稿

## 文档目的

本文档用于定义 `/map?view=world` 的页面结构、交互方式、URL 规则和降级逻辑。

目标不是写像素稿，而是把世界图第一页应该长什么样、用户如何操作、和现有 `/map` 如何共存说清楚。

---

## 一、页面定位

世界图不是一个全新产品，而是现有 `Map` 产品面的一个子模式。

因此首版建议保持：

- 顶层路由仍然是 `/map`
- 通过 `view=world` 切换到世界图模式
- 现有 destination 局部地图仍然保留

推荐入口：

- `/map?view=world`

推荐和现有模式的关系：

- `/map?view=world`：世界地图
- `/map?destinationId=dest-001`：局部地图

---

## 二、设计原则

世界图 UI 应遵循以下原则：

1. 先让用户理解“我正在看世界层”
2. 让用户一眼看出如何切回局部层
3. 不把现有局部路线规划表单强行搬到世界层
4. 缩小时看世界结构，放大后看 destination
5. 同名地点必须通过 region 信息区分

---

## 三、首版页面布局

## 桌面端布局

推荐两栏：

### 左栏：控制与结果

建议包含以下模块：

- 世界图模式标题
- 模式说明
- 起点 destination 选择
- 终点 destination 选择
- mode / strategy 选择
- `Plan route` 按钮
- `Fit world` 按钮
- `Fit route` 按钮
- 当前选中地点信息
- 当前路线摘要
- 进入局部地图按钮

左栏的核心作用是：

- 控制当前世界级路线
- 展示路线说明
- 提供 handoff

### 右栏：地图舞台

建议包含：

- Leaflet 地图容器
- 缩放控件
- 图例
- loading / error / unavailable 覆盖层
- marker / route / region overlay

右栏的核心作用是：

- 浏览世界
- 点选地点
- 观察路线

---

## 四、推荐页面结构

推荐的页面结构大致如下：

```text
Map Hero
World Mode Notice

World View Grid
  Left Control Panel
    World route form
    Current destination card
    Route summary card
    Handoff actions

  Right Map Stage
    World map canvas
    Zoom controls
    Legend
    Overlay status
```

这个结构和现有 `/map` 页的风格是兼容的：

- 左边控制
- 右边图形反馈

但内容语义不同：

- 局部图是 node 级路线规划
- 世界图是 destination 级 / cross-map 路线规划

---

## 五、推荐交互流程

## 流程 A：纯浏览

1. 用户进入 `/map?view=world`
2. 首屏先看到六个 region 和主干路线
3. 缩放、拖动浏览
4. 点击某个 destination marker
5. 左栏显示该地点概要
6. 用户可点击“Enter local map”进入局部图

## 流程 B：世界级路线

1. 用户选择起点 destination
2. 用户选择终点 destination
3. 用户选择 `mode` 与 `strategy`
4. 点击 `Plan route`
5. 地图绘制 world route
6. 左栏显示路线摘要
7. 用户可点击起点或终点的局部入口

## 流程 C：从世界层进入局部层

1. 用户点击地图上的某个 destination
2. UI 显示该地点卡片
3. 用户点击 `Open local map`
4. 跳转到 `/map?destinationId=...`
5. 若存在 `actor`，应继续保留

---

## 六、世界图最小控件集

首版必须具备的控件：

- 鼠标滚轮缩放
- 地图拖动
- `+` / `-` 缩放按钮
- `Fit world`
- `Fit route`
- marker click

首版不必急着做的控件：

- 小地图
- 图层面板
- 复杂筛选器
- 动态时间轴

---

## 七、世界图信息层级

## 最远视角

显示：

- region name
- region boundary
- 主干路线
- 少量 hub

隐藏：

- 大多数 destination label
- 细节型 marker 文案

## 中间视角

显示：

- destination marker
- 选中 marker label
- 主要 portal

## 近距离视角

显示：

- 当前路线经过的 destination
- popup
- handoff action

不建议做的事情：

- 在世界层显示 local node
- 在世界层绘制局部细碎边

---

## 八、同名地点处理

当前 seed 中同名 destination 很多，因此世界图必须处理重名问题。

推荐规则：

- 下拉选项显示：`Name · Region · Type`
- popup 主标题显示：`Name · Region`
- 次级信息显示：
  - `destinationId`
  - `type`
  - category tags

例如：

- `Amber Bay · North Belt · scenic`
- `Amber Bay · East Loop · scenic`

这样可以直接避免用户误选。

---

## 九、推荐表单结构

左栏表单建议字段：

- `From destination`
- `To destination`
- `Mode`
- `Strategy`

建议保留的 value：

- `Mode`
  - `walk`
  - `bike`
  - `shuttle`
  - `mixed`
- `Strategy`
  - `distance`
  - `time`
  - `mixed`

这能和现有局部地图保持一致认知。

但世界图不建议一开始就暴露：

- `fromLocalNodeId`
- `toLocalNodeId`
- `waypointNodeIds`

这些更适合阶段 3 的跨图组合。

---

## 十、推荐卡片内容

## 当前地点卡片

建议展示：

- `Name · Region`
- `type`
- category tags
- `Open local map`
- `Set as start`
- `Set as end`

## 世界路线摘要卡片

建议展示：

- 起点与终点
- 总距离
- 总成本
- 使用的交通模式
- 路线段数
- 不可达时的原因

## 跨图阶段扩展卡片

等进入阶段 3 后，再增加：

- 起点局部段
- 世界段
- 终点局部段

每一段都要明确标记 scope。

---

## 十一、状态与降级

世界图页面至少要有以下状态：

## `unavailable`

触发条件：

- 没有 world 数据
- 或服务层未启用 world capability

页面行为：

- 不初始化地图
- 显示说明文案
- 提供回到局部地图模式的入口

## `loading-summary`

触发条件：

- 页面初次进入
- 正在加载 `/api/world`

页面行为：

- 显示 skeleton 或 loading 卡片

## `loading-details`

触发条件：

- 地图 summary 已到达
- 正在加载 world graph 详情

页面行为：

- 保留基础外壳
- 地图区显示加载层

## `ready`

触发条件：

- 地图和地点数据都已可用

页面行为：

- 可缩放、可拖动、可选点、可规划路线

## `routing`

触发条件：

- 正在请求 `/api/world/routes/plan`

页面行为：

- 保留旧地图
- 左栏显示 routing 状态
- 路线按钮进入 busy 态

## `error`

触发条件：

- summary、details、route 请求失败

页面行为：

- 显示错误信息
- 提供重试按钮
- 不影响用户退回局部地图

---

## 十二、推荐 URL 规则

首版建议统一以下 URL 语义：

- 世界图首页：
  - `/map?view=world`
- 带 actor 的世界图：
  - `/map?view=world&actor=user-1`
- 预选起终点：
  - `/map?view=world&fromDestinationId=dest-001&toDestinationId=dest-008`
- 世界图进入局部图：
  - `/map?destinationId=dest-001&actor=user-1`

推荐约束：

- `view=world` 优先级高于 `destinationId`
- 如果两者同时出现，当前视图仍按 world mode 渲染
- `destinationId` 只作为辅助预选上下文，不作为主视图切换条件

---

## 十三、推荐视觉语言

## 区域颜色建议

- `north belt`：冷灰蓝
- `river arc`：湖蓝与青绿
- `harbor line`：海军蓝 + 霓虹暖点
- `west ridge`：岩灰 + 学院金属色
- `central axis`：森林绿
- `east loop`：暖橙 + 市集灯光色

## 线型建议

- `road`：实线
- `trail`：点状或轻虚线
- `rail`：双线
- `ferry`：波纹式线型

## 图标建议

- `campus`：塔楼 / 门楼 / 学院记号
- `scenic`：景点 / 城镇 / 观景标记
- `portal`：门或锚点符号

---

## 十四、移动端适配建议

移动端不建议沿用桌面双栏。

推荐结构：

- 顶部保留标题和主要操作
- 中间大部分面积给地图
- 底部使用抽屉面板承载表单和结果

移动端首版重点是：

- 看图顺畅
- 手势拖动顺畅
- 控件数量克制

而不是把所有桌面信息硬塞进一屏。

---

## 十五、和现有局部地图的关系

首版世界图不应该替代当前局部地图。

正确关系是：

- 世界图负责 destination 级导航
- 局部地图负责 node 级导航
- 两者通过 handoff URL 连起来

这会让产品结构非常清晰，也能最大限度复用现有实现。

---

## 十六、结论

首版世界图 UI 最好的做法是：

- 保持在 `/map` 产品面内
- 用 `view=world` 切子模式
- 采用左控右图的结构
- 用 region 组织世界认知
- 用 `Name · Region` 解决同名地点问题
- 把世界图和局部图明确做成两层，不混写
