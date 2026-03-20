# Boston 参考到 World Map 的映射稿

## 文档目的

本文档定义如何把当前目录中的 Boston 参考数据：

- [export (1).geojson](/home/frisk/ds-ts/export%20(1).geojson)

转化为适合本项目的大地图布局原则。

这里的目标不是复制真实 Boston 地图，而是借它的空间逻辑，重构当前 world map 的宏观布局。

---

## 一、先说结论

Boston 这份参考最值得借的不是道路名字，而是下面这套结构：

- 水体先切分空间
- 桥和隧道决定跨区连通
- 主干线少而强
- hub 长在 choke point，不长在几何中心
- 世界图应该明显不对称

因此，大地图不应该继续按“六块差不多大小的主题区”去排，而应该升级为：

- 一条主水系
- 一片内港或外港
- 几个被水体切开的陆地区块
- 少数几个桥头、隧道口、轨道交汇点
- destination 围绕这些 choke point 分层分布

---

## 二、这份 Boston 数据实际告诉了我们什么

从 [export (1).geojson](/home/frisk/ds-ts/export%20(1).geojson) 提炼出来的骨架很清晰：

- 范围不是整座 Boston，而是 Boston 核心区的一块结构样本
- 数据主体不是细街道，而是骨架图层
- 水体、主路、轨道三类要素已经足够表达空间关系

可识别的强特征包括：

- `Tobin Bridge`
- `Callahan Tunnel`
- `Sumner Tunnel`
- `John F. Fitzgerald Expressway`
- `Massachusetts Turnpike`
- `East Boston Expressway`
- `North Washington Street`
- `Meridian Street`
- `Green Line`
- `Blue Line`
- `Orange Line`

从这些对象能抽象出四个稳定规律：

1. 内港和河口把区域切开
2. 跨区不是随便连，而是依赖少量桥隧
3. 中心区是走廊，不是大平原
4. 东侧/外港区天然更像“半岛型或外联型区域”

---

## 三、对现有 world map 的直接影响

我们现有的大地图概念已经有很多正确决策，可以保留：

- 保留现有 local map，不重写局部图
- world mode 继续放在 `/map?view=world`
- 继续使用 `Leaflet + CRS.Simple`
- 继续使用 `world graph + portal`
- 继续使用独立 world API
- 跨图结果继续返回 `legs[]`

真正要调整的是“世界布局的几何关系”。

也就是说：

- 不改体系
- 改空间结构

---

## 四、应该保留的部分

以下决策我建议直接保留，不需要因为 Boston 参考而推翻：

1. world mode 是 `Map` 的子模式，不新开顶层路由
2. local graph 和 world graph 继续分层
3. `portal` 继续作为唯一合法跨层入口
4. `/api/bootstrap` 不承载重型 world graph
5. `/api/world`、`/api/world/details`、`/api/world/routes/plan` 的接口方向继续成立
6. `legs[]` 分段路由结果继续成立
7. UI 中继续显式区分世界层和局部层
8. 同名 destination 继续使用 `Name · Region` 显示

Boston 参考改变的是地图形态，不是这些架构判断。

---

## 五、应该改写的部分

需要改写的不是底层服务边界，而是 world map 的宏观布局原则：

1. 不能再把六区看成均匀散开的六块
2. region 不应以地理中心连线，而应以 choke point 相连
3. hub 不应默认放在 region 中心，而应优先放在：
   - 桥头
   - 隧道口
   - 港口入口
   - 轨道汇合点
4. `harbor line` 不应和所有区域直接连通
5. `river arc` 不只是“滨水 campus 区”，还应承担中枢换乘作用
6. `central axis` 不应是普通中央块，而应是“主陆上走廊”
7. `world edge` 的主角不应是 destination-to-destination，而应是 hub-to-hub

---

## 六、Boston 化之后的六区解释

这里的“Boston 化”只指空间关系，不强行把主题标签改成 Boston 的现实语义。

## 1. River Arc

新的角色：

- 中央水系与河湾走廊
- 兼具景观与交通中枢意义
- 是跨区转换最重要的上层结构

借鉴自：

- Charles River 弧线
- 河岸走廊
- 被水体和交通共同塑造的中枢带

设计要求：

- 必须和 `central axis` 有强连接
- 必须和 `west ridge` 形成桥接关系
- 不应只是装饰性滨水区

## 2. Harbor Line

新的角色：

- 外港 / 半岛 / 码头型区域
- 有明显边界感
- 对外联能力强，但对内部直连能力弱

借鉴自：

- East Boston / harbor side 的半岛感
- 港湾、码头、隧道、桥接

设计要求：

- 不要和所有区域直连
- 主要通过桥、隧道、渡口这类 trunk edge 进入
- destination 应更靠近入口和岸线，不要均匀散开

## 3. Central Axis

新的角色：

- 主陆上走廊
- 世界图中的纵向 spine
- 承担世界图中的“地面主通道”

借鉴自：

- Boston 核心区的主交通骨架
- downtown 北缘与中部连接关系

设计要求：

- 和多个 region 相连，但不是所有连接都无摩擦
- 应同时服务 route planning 和视觉导航
- 是从世界层切回局部层时最稳定的中继区

## 4. North Belt

新的角色：

- 北侧桥头与历史带
- 既是 scenic 区，也是北向入口区
- 更像 bridgehead than centerpiece

借鉴自：

- Tobin Bridge 一带的北向入口感
- 北站/北侧接入逻辑

设计要求：

- 应和 `central axis`、`harbor line` 通过少数 choke point 连通
- 不要直接铺成无障碍 scenic 大片区

## 5. West Ridge

新的角色：

- 内陆高地 campus 区
- 西向学术或研究高地
- 通过桥或廊道接入中枢

借鉴自：

- 西侧高地/学院带的空间关系
- 与河岸中枢之间的跨水或跨走廊联系

设计要求：

- 与 `river arc` 和 `central axis` 的连接最重要
- 适合承接 campus 类型 destination cluster

## 6. East Loop

新的角色：

- 市场、社交、生活型东南环带
- 与港湾区呼应，但气质更生活化
- 承担“靠海但更近人群”的活动环

借鉴自：

- 内港边的商业化外环
- 与中心区和港湾区之间的双重联系

设计要求：

- 应和 `central axis` 有稳定地面连接
- 可与 `harbor line` 形成水岸呼应
- 不应像孤立飞地

---

## 七、推荐的新布局

## 总体原则

新布局应体现三层结构：

1. 水体
2. region
3. hub 与 trunk edge

而不是：

1. 先摆六个 region
2. 再随便连线

## 推荐空间关系

建议整体形成以下不对称结构：

- `river arc` 位于偏西北的河湾带
- `west ridge` 位于更西侧或西南内陆
- `north belt` 位于北部桥头
- `central axis` 位于中部狭长主轴
- `harbor line` 位于偏东北或偏东的外港半岛
- `east loop` 位于东南或南东方向的生活环带

这样会形成两个关键空间结果：

- 中央不是一整块，而是一条 spine
- 东侧不是大平地，而是靠桥隧进入的外联区域

---

## 八、推荐 hub 设计

Boston 参考最强的启发是：hub 不该放在几何中心。

推荐 world hub 按两层设计：

## Region Hub

每个 region 一个主 hub：

- `river arc hub`
- `harbor line hub`
- `central axis hub`
- `north belt hub`
- `west ridge hub`
- `east loop hub`

## Junction Hub

额外增加少数 choke point hub：

- `river crossing`
- `north bridgehead`
- `harbor tunnel`
- `market connector`

这些 junction hub 的作用是：

- 表达桥、隧道、瓶颈和转向
- 让世界路线更像真实空间，而不是无差别直线

---

## 九、推荐 trunk edge 类型

建议把世界主干边明确分成五类：

- `bridge`
- `tunnel`
- `road`
- `rail`
- `ferry`

推荐连接关系：

1. `river arc` <-> `central axis`
   - 主桥接
2. `west ridge` <-> `river arc`
   - 校园走廊或滨水桥接
3. `west ridge` <-> `central axis`
   - 陆上或轨道走廊
4. `north belt` <-> `central axis`
   - 北向桥头连接
5. `north belt` <-> `harbor line`
   - 桥接或高架连接
6. `central axis` <-> `harbor line`
   - 隧道型连接
7. `central axis` <-> `east loop`
   - 主地面或快速走廊
8. `harbor line` <-> `east loop`
   - 港湾边缘连接

这个结构的目的不是模拟真实 Boston，而是把 Boston 的“瓶颈感”转译成你的 world graph。

---

## 十、对 route planning 的影响

一旦采用这套 Boston 化布局，世界级路线就会更有层次：

- 不是任意两点直接连
- 而是 destination -> portal -> region hub -> junction hub -> region hub -> portal -> destination

这会直接带来三个好处：

1. 世界路线更容易读
2. 不同交通模式更容易表达
3. 跨图 route composition 的解释性更强

例如：

- `walk` 更适合桥、地面廊道、市场环
- `shuttle` 更适合隧道、快速走廊、轨道边
- `mixed` 更自然

---

## 十一、UI 上应该怎样体现 Boston 参考

UI 不需要出现 Boston 字样，但应体现它带来的空间特征：

- 地图背景要明显有水域留白
- 东侧港湾区不能像普通块区一样贴着中心
- 桥和隧道应有独立视觉提示
- choke point 在缩小时也应可辨识
- `fit route` 时要能看出路线绕过水体和通过瓶颈

这会明显增强“开放世界感”。

---

## 十二、建议新增而不是硬改旧文档

我建议新增一份 Boston 参考文档，而不是直接把旧 spec 全文重写。

原因：

- 旧 spec 里很多架构决策是对的
- Boston 参考只改变世界布局，不改变整个技术路线
- 单独留一份映射稿，方便比较 generic 方案和 Boston-inspired 方案

因此当前最合理的工件组合是：

- 保留 [world-map-mode-spec-and-plan.md](/home/frisk/ds-ts/world-map-mode-spec-and-plan.md)
- 保留 [world-map-region-concept.md](/home/frisk/ds-ts/world-map-region-concept.md)
- 新增本文件
- 新增一个 Boston-inspired 的 world seed 样例：
  - [world-map-boston-inspired.seed-fragment.json](/home/frisk/ds-ts/world-map-boston-inspired.seed-fragment.json)

---

## 十三、下一步建议

如果按这份文档继续推进，推荐顺序如下：

1. 先冻结 Boston-inspired 的六区宏观坐标
2. 再冻结 region hub 和 junction hub
3. 再补 representative destinations 的 placement
4. 再补 trunk edges
5. 最后再把完整 220 个 destination 铺上去

---

## 十四、结论

Boston 参考真正带来的价值是：

- 让世界图从“主题分区图”升级为“水体切割的空间系统”
- 让 hub 从“地理中心”升级为“桥头/隧道口/换乘点”
- 让 route 从“平面连线”升级为“经过瓶颈的世界路线”

这正是你想要的“大地图模式”里最像开放世界游戏的部分。
