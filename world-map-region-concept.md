# 大地图区域设定稿

## 文档目的

本文档把当前项目已有的 `destination` 数据，整理成适合“大地图模式”的世界观与区域组织方式。

它不是实现代码，也不是最终美术稿，而是用于回答三个问题：

1. 现有地点在世界地图上应该如何分区
2. 世界地图更适合做成什么风格
3. 在当前 seed 条件下，第一版大地图应该怎样组织才最稳

---

## 一、当前数据事实

基于当前 seed，项目里的地点现状如下：

- 总地点数：`220`
- 地点类型只有两种：`scenic`、`campus`
- 两种类型数量完全对半：
  - `scenic`：`110`
  - `campus`：`110`
- 区域共有 `6` 个：
  - `north belt`
  - `river arc`
  - `harbor line`
  - `west ridge`
  - `central axis`
  - `east loop`

当前数据还有两个很重要的特征：

1. 区域主题非常稳定
   - 每个 region 基本都绑定一组稳定的 category 组合
   - 这非常适合直接做“大区风格”

2. 地点名称复用率很高
   - `220` 个地点只有 `15` 个唯一名称
   - 例如 `Amber Bay`、`Harbor Harbor`、`Maple Promenade` 会在多个 region 中重复出现

因此，大地图不能把它包装成“真实地理城市地图”，而应该包装成：

- 风格化世界图
- 主题区域图
- 游戏式 overworld / atlas

---

## 二、适合当前项目的大地图方向

我不建议把大地图做成写实 GIS 地图。

更适合当前数据的方向是：

- 一张风格化世界平面图
- 六个主题鲜明的大区
- 大区之间用主干路线连接
- 地点是大区里的落点或聚落
- 现有 local map 继续承担“进入地点后的细节导航”

可以把它理解成两层：

### 世界层

负责：

- 你现在在哪个大区
- 你要去哪个 destination
- 大区之间怎么走
- 路线大致经过哪些枢纽

### 局部层

负责：

- 进入某个 destination 后的路线规划
- 节点级起点终点选择
- 局部建筑、景点、设施导航

这个分层非常适合当前项目，因为你已经有成熟的局部图，只差世界层。

---

## 三、推荐世界布局

## 总体布局思路

推荐把世界地图布局成“六区一张图”：

- `north belt` 放在北侧高地
- `river arc` 放在中北部河湾带
- `west ridge` 放在西侧山脊与研究高地
- `harbor line` 放在西南港湾带
- `central axis` 放在中南部林地与慢行中轴
- `east loop` 放在东侧城市生活环带

这张图的视觉逻辑不是现实经纬度，而是“区域辨识度 + 交通主干可读性”。

## 推荐大区关系

建议关系如下：

- `north belt` 连接 `river arc`
- `river arc` 连接 `west ridge`
- `river arc` 连接 `central axis`
- `river arc` 连接 `east loop`
- `west ridge` 连接 `harbor line`
- `central axis` 连接 `east loop`
- `harbor line` 可与 `central axis` 保留一条特殊交通线

这样可以得到：

- 中部有主干枢纽
- 四周大区分布清楚
- 世界路线容易读
- 后续扩图也容易

---

## 四、六大区域设定

## 1. North Belt

推荐定位：

- 北境历史带
- 博物与家庭游区域
- 偏观景、故事性、老地标

当前主题标签：

- `history`
- `museum`
- `family`
- `scenic`

视觉方向：

- 偏冷色
- 石质高地
- 观景台、旧城墙、展馆、坡地步道

世界层作用：

- 作为北向 scenic 区域
- 适合放置历史遗迹、观景点和家庭游聚落

代表地点样本：

- `dest-001` `Amber Bay`
- `dest-007` `Silver Lookout`
- `dest-013` `Harbor Harbor`
- `dest-019` `Maple Promenade`

## 2. River Arc

推荐定位：

- 河湾校园带
- 滨水学习与摄影区域
- 中部世界交通枢纽

当前主题标签：

- `nature`
- `waterfront`
- `photography`
- `campus`

视觉方向：

- 河道、桥梁、湿地步道
- 偏明亮蓝绿色
- 有学院区和滨水平台

世界层作用：

- 最适合做世界主 hub
- 也是世界路线的中转中心

代表地点样本：

- `dest-002` `River Polytechnic`
- `dest-008` `Lotus Learning Hub`
- `dest-014` `Summit Polytechnic`
- `dest-020` `Vertex Learning Hub`

## 3. Harbor Line

推荐定位：

- 港湾艺术带
- 夜景与设计区
- 西南侧 coastal hub

当前主题标签：

- `art`
- `nightscape`
- `design`
- `scenic`

视觉方向：

- 港口、码头、霓虹、滨海步道
- 更强对比和夜景氛围

世界层作用：

- scenic 都市感大区
- 可以承担特殊交通，例如 ferry 或夜景线

代表地点样本：

- `dest-003` `Harbor Harbor`
- `dest-009` `Maple Promenade`
- `dest-015` `Velvet Terrace`
- `dest-021` `Amber Bay`

## 4. West Ridge

推荐定位：

- 西侧研究山脊
- 建筑与学习型 campus 区
- 高地科研走廊

当前主题标签：

- `research`
- `learning`
- `architecture`
- `campus`

视觉方向：

- 台地、研究楼群、桥廊、几何建筑
- 偏理性、硬朗

世界层作用：

- 高等级 campus 区
- 适合承担中长距离地面交通节点

代表地点样本：

- `dest-004` `Summit Learning Hub`
- `dest-010` `Vertex Polytechnic`
- `dest-016` `Pioneer Learning Hub`
- `dest-022` `River Polytechnic`

## 5. Central Axis

推荐定位：

- 林地慢行中轴
- 健康、步行、休闲学习区
- 世界图中南部的缓冲与过渡带

当前主题标签：

- `wellness`
- `forest`
- `walking`
- `campus`

视觉方向：

- 林间道、草地、中轴步行道
- 节奏更慢、视觉更开阔

世界层作用：

- 连接多个 campus 区
- 适合放置慢行路线和恢复性空间

代表地点样本：

- `dest-006` `Pioneer Polytechnic`
- `dest-012` `River Learning Hub`
- `dest-018` `Lotus Polytechnic`
- `dest-024` `Summit Learning Hub`

## 6. East Loop

推荐定位：

- 东侧生活环带
- 市集、社交、食物 scenic 区
- 活跃度较高的城市场景

当前主题标签：

- `food`
- `market`
- `social`
- `scenic`

视觉方向：

- 街区、广场、商铺、灯串、露台
- 更暖色、更热闹

世界层作用：

- 承担生活服务和城市氛围
- 和 `central axis` 形成节奏对比

代表地点样本：

- `dest-005` `Velvet Terrace`
- `dest-011` `Amber Bay`
- `dest-017` `Silver Lookout`
- `dest-023` `Harbor Harbor`

---

## 五、命名与显示策略

由于当前 destination 名称复用很高，世界地图不能只显示 `destination.name`。

推荐显示规则：

- 列表中：`Name · Region`
- marker tooltip：`Name · Region`
- popup 中再显示：
  - `destinationId`
  - `type`
  - category tags

例如：

- `Amber Bay · North Belt`
- `Amber Bay · East Loop`

这样做的原因很直接：

- 用户不会混淆同名地点
- 后续真实数据替换时也容易迁移
- 不需要现在就重命名 seed

---

## 六、推荐缩放层级

## 缩放层级 A：世界总览

只显示：

- 六个 region
- 主干交通线
- 区域名称
- 少量区域 hub

不显示：

- 全部 destination label
- 细碎 marker

适用场景：

- 进入世界图首页
- 快速理解世界结构

## 缩放层级 B：区域浏览

显示：

- 当前 region 边界
- region 内 destination cluster
- 代表性 portal
- 该区到邻区的主干线路

适用场景：

- 在某一大区寻找目标地点
- 选择从哪个 hub 进入

## 缩放层级 C：地点选择

显示：

- 单个 destination marker
- 起点终点高亮
- 世界路线 polyline
- 进入 local map 的 handoff 操作

适用场景：

- 规划路线
- 从世界层切到局部层

---

## 七、第一版最适合的产品表达

如果只做第一版，我建议大地图页面明确表达成：

- `Atlas`
- `Overworld`
- `World View`

而不是伪装成真实城市 GIS 地图。

第一版最佳卖点不是“地理真实”，而是：

- 一眼看懂全世界结构
- 从一个地点切到另一个地点更自然
- 有开放世界总览感
- 和现有 local map 形成层级关系

---

## 八、对实现的直接含义

这份区域设定会直接影响后续实现：

1. 世界图数据结构应该优先有 `region`
2. 世界图 UI 首先应该支持“按 region 理解地图”
3. 世界图 label 必须带 region 信息，不能只显示 name
4. 世界图路线应先走“主干枢纽 + 区域入口”，而不是试图一开始就铺满所有细节
5. 局部地图不需要重做，只需要和世界图做好 handoff

---

## 九、结论

按当前项目数据形态，最适合的大地图不是写实地图，而是：

- 六区主题化的世界总览图
- 游戏式 overworld
- 先区域、后地点、再进入局部地图

这条路线最符合当前 seed，也最容易把产品气质做出来。
