# RLCR 并发与状态一致性问题复盘

日期：2026-03-20  
范围：`.humanize/rlcr/2026-03-19_19-29-46` 的 Round 0 到 Round 14 review 记录、对应 summary，以及 `main` 上已落地的修复提交

> 注：本文按 2026-03-20 当时的 review 轨迹做历史复盘。文中提到的 `actor` 路由传播、Explore/Map/Post Detail hand-off、comments 错误分类退化和相关回归覆盖缺口，后续已经由 bounded SPA convergence pass 与当前为绿的 deterministic regression suite 收口；下面的“问题/缺口”应理解为当时观察到的阶段性状态，而不是当前 `main` 的未修复现状。
> 本文中的 round、commit、缺口和建议都服务于该次复盘语境；除开头已明确更新的现状说明外，不应把它们直接当成当前仓库的实时待办或产品事实清单。

## 结论摘要

这次 RLCR 看起来像是“很多轮都卡在并发问题”，但更准确的说法是：

1. 不是多线程并发，而是单页应用里的“异步交错 + 路由状态传播 + 分页锚点稳定性”问题反复暴露。
2. 真正反复出现的不是一个 bug，而是四个系统级不变量没有一次性建立。
3. Round 2 之后实现层面已经能跑通主流程，但 review phase 继续沿着边界场景深挖，于是把这些不变量缺口一轮轮揭出来。
4. 从 Round 3 到 Round 14，除 Round 7 外，几乎每轮都至少有一个“状态一致性/竞态”类问题，而不是纯样式或普通 CRUD 问题。

如果只看 commit，会感觉每轮都在修一个小洞；如果看 review 链路，会发现它们其实都落在同一组根因上：

1. `actor` 不是一等路由状态，导致跨视图 hand-off 时不断丢失。
2. 分页 cursor 没有从一开始建立在“不可变、全序、可恢复”的锚点上。
3. SPA 中异步请求返回后缺少“结果是否仍然属于当前视图状态”的校验。
4. fallback / degrade 分支把“真实错误”和“能力缺失”混在一起，掩盖了并发下暴露出来的真实失败。

## 这里的“并发问题”到底指什么

这次遇到的并发问题，不是线程锁、共享内存那类传统并发，而是 JavaScript SPA 中更常见的几类问题：

1. 用户在前一个请求未返回前，又触发了新的选择或导航，导致旧响应覆盖新状态。
2. UI 通过 `navigate(..., { render: false })` 或局部刷新改 URL/状态，但没有同步更新所有依赖这个状态的链接和动作。
3. 分页请求的“下一页”依赖上一页的锚点，而这个锚点在用户继续操作期间被修改、删除或重排。
4. 接口失败时，前端把“服务不存在”与“请求无效/服务临时失败”统一降级，导致真实问题被隐藏。

因此，这次“并发”本质上是“交错执行下的状态一致性问题”。

## 复盘时间线

### Round 0 到 Round 2：主功能落地，但并发模型还没有被完整建起来

- Round 0 首批问题里就已经出现了两个后面会反复出现的主题：
  - `viewerUserId` / `actor` 没有贯穿 feed 和 post detail。
  - comments 分页只拿第一页，没有把 `cursor` / `nextCursor` 作为稳定交互的一部分。
- Round 1 继续暴露的是“fallback 分支没有带 viewer context”和“关键回归场景没有 deterministic regression coverage”。
- Round 2 虽然拿到了 `COMPLETE`，但它更多是在说明“主线能力已闭环”，并不等于“所有交错场景都已经有不变量保护”。

这一步的关键问题不是实现失败，而是：

1. 主流程先被做通了。
2. 交错场景还没有被系统化枚举。
3. tracker 在 Round 2 之后没有继续把 review phase 发现的系统性不变量补回去，导致后续问题更像“追加发现”，而不是“计划内收口”。

## 四类反复出现的根因

### 1. `actor` 上下文没有被当成跨路由的一等状态

这是后期最反复的一类问题。

涉及轮次：

- Round 5：Compose 初始化忽略 `route.params.actor`，发布后跳转也丢 actor
- Round 6：Post Detail 到 Compose 的 hand-off 丢 actor
- Round 9：Feed 的 compose CTA 和已渲染 post 链接在 actor 切换后变 stale
- Round 11：切换 actor 只改链接，不刷新 feed 卡片本身
- Round 12：shell 顶部导航丢 actor；`render: false` 的导航不会自动修正 shell links
- Round 13：journal card 的 map 链接丢 actor
- Round 14：Map 控件重写 URL 时丢 actor；Explore 目的地卡片 hand-off 也丢 actor

为什么会这样反复：

1. `actor` 是跨 Feed / Post Detail / Compose / Map / Explore 的共享上下文，但实现上它被分散处理。
2. 某些地方通过 `createUrl` 或 `buildMapHref` 生成链接，某些地方直接硬编码 `/compose?...`、`/map?...`。
3. 某些地方只在初次 render 时把 `actor` 烘焙进链接，后续 actor 改变时没有统一刷新。
4. 某些地方是完整 render，某些地方是 `render: false` 的 URL 改写，后者不会天然触发所有视图逻辑重跑。

本质上，`actor` 没有被当作“必须 lossless round-trip 的路由状态”，而被当成“某些页面碰巧会带的 query param”。

结果就是：每修一个 hand-off，又会在下一个 hand-off 面找到同族问题。

### 2. cursor / 排序模型不是从一开始就建立在不可变全序上

这是最典型的“单线程应用里的并发 bug”：不是同时写同一块内存，而是“用户拿着旧页面锚点继续翻页时，底层排序已经变了”。

涉及轮次：

- Round 3：feed cursor 依赖可变的 `updatedAt`，点赞/评论/浏览后下一页 cursor 直接失效
- Round 4：即使修掉部分 social activity，`rate()` 和 `update()` 仍然会改 `updatedAt`
- Round 6：时间戳相同情况下用字符串 id 排序，`journal-10` 会排到 `journal-9` 后面；comments 也同样有问题
- Round 8：上一页锚点项被删除后，cursor 解析直接失败
- Round 12：`/api/feed` 的真实 cursor 错误被错误 fallback 掩盖
- Round 14：comments 接口的真实错误又被统一降级成 “Comments unavailable”

为什么它会拖这么多轮：

1. 第一轮只看到了“mutable `updatedAt` 会破坏 cursor”。
2. 修完后又发现“就算时间戳不变，排序 tie-break 也必须是稳定全序”。
3. 再往后又发现“就算全序稳定，锚点实体本身也可能被删除，cursor 仍要能恢复”。
4. 最后又发现“当前端把真实 cursor 错误伪装成 fallback/unavailable 时，服务端已经修好的稳定性也会被 UI 吃掉”。

也就是说，问题并不是“cursor 某一行代码写错了”，而是 cursor 设计一开始没有完整覆盖：

1. 可变更新
2. 同时间戳 tie
3. 锚点删除
4. 错误语义传递

这四层约束是分几轮才补齐的。

### 3. SPA 异步请求缺少“只提交当前请求结果”的保护

这是最典型的前端 race。

涉及轮次：

- Round 5：路由加载 promise 被丢弃，后续失败只留下 loading 状态
- Round 10：Map 和 Explore 的目的地详情请求在切换 destination 后发生 stale overwrite
- Round 10：Food 搜索结果返回时，卡片却拿当前 selector 的 destination 渲染链接，而不是请求发起时的 destination
- Round 12：shell link 同步需要覆盖 `render: false` 的非完整渲染路径
- Round 14：Map 控件改 URL 时触发的是局部状态同步，不是完整 render，这条路径再次暴露 actor 丢失

为什么这类问题在后面才集中出现：

1. 初期主要在“功能能不能跑通”。
2. 真正的 stale response 必须在“用户快速切换 + 请求尚未返回”的交错路径里才会暴露。
3. 如果没有 request token / response ownership 的思路，就很容易只在 happy path 上验证成功，而忽略旧响应覆盖新选择的问题。

这类问题说明当时的视图设计默认假设是：

- 用户点一下，等返回，再点下一次。

但真实 SPA 里必须按下面这个模型设计：

1. 请求发起时记录版本号或 token。
2. 响应返回时确认“它还属于当前 destination / 当前 route / 当前 actor”。
3. 不属于当前上下文的结果直接丢弃。

Round 10 才明确把这层保护补进来。

### 4. fallback / degrade 分支的语义边界不清

这类问题表面像错误处理，实际上会让并发问题更难定位，也会把状态一致性问题伪装成“功能不可用”。

涉及轮次：

- Round 1：`/api/feed` 缺失时 fallback 到 `/api/journals`，但 viewer context 没带过去
- Round 5：route-load failure 没有被显式 surface
- Round 12：`/api/feed` 任何非 OK 都 fallback 到 `/api/journals`，把 invalid cursor / 500 都伪装成另一套 timeline
- Round 14：comments 任何非 404 错误都被降级成 `{ available: false }`

为什么这类问题会放大“并发卡住”的感觉：

1. 服务端已经明确返回了 `Invalid cursor`，但 UI 把它换成另一个 fallback 结果。
2. comments 接口明明只是临时失败或 cursor 无效，界面却显示 “Comments unavailable”，甚至禁用发评论。
3. 结果 review 看起来像“前一个并发问题刚修完，怎么又冒出一个新问题”，其实很多时候是旧问题的错误语义被错误处理遮住了。

所以这不是普通异常分支，而是状态机设计问题：  
“能力不存在” 和 “当前请求失败” 是两种完全不同的状态，不能共用一个 degrade 分支。

## 为什么会一轮一轮地暴露，而不是一次性收敛

### 1. 修的是局部症状，不是全局不变量

最明显的例子就是 actor。

修复顺序基本是：

1. Compose 自己要保 actor
2. Post Detail 到 Compose 要保 actor
3. Feed 到 Compose 要保 actor
4. Feed 已渲染卡片切 actor 后要刷新 post link
5. Shell nav 要保 actor
6. Journal card 的 map link 要保 actor
7. Map 自己重写 URL 时还要保 actor
8. Explore 卡片 hand-off 也要保 actor

这说明系统里真正缺的不是“某一个链接忘了拼 query”，而是：

`actor` 的跨视图传播没有被抽象成统一规则并做全局审计。

### 2. 测试是逐步补上的，但矩阵覆盖不是一次性建好的

Round 2 之前，deterministic SPA regression harness 还没完整建立。  
Round 2 之后虽然有了 harness，但测试是跟着发现走的：

1. 先补分页
2. 再补 lazy load
3. 再补 feed actor
4. 再补 stale destination loads
5. 再补 shell nav actor

这能防回归，但不能自动推出“所有 hand-off 都要测 actor round-trip”。

也就是说，测试体系是在变强，但最初不是按“不变量矩阵”组织的，而是按“发现一个 case，补一个 case”组织的。

### 3. 旧能力与新社交能力共存，导致状态面急剧变大

这次改造不是从零做 SPA，而是在保留：

1. destinations
2. map / routes
3. facilities
4. foods
5. journal exchange
6. feed / detail / compose social flows

的前提下，把它们重组成 routed SPA。

这意味着每多一个新上下文，就会多一批交叉边界：

1. Explore -> Map
2. Explore -> Compose
3. Feed -> Post Detail
4. Feed -> Compose
5. Post Detail -> Compose
6. Journal card -> Map
7. Shell nav -> 任意页面
8. `render: false` 导航 -> shell link 刷新

每个边界都要决定：

1. 带不带 actor
2. 带不带 destination
3. 出错是否 fallback
4. 是否需要重新拉数据
5. 旧请求回来时还应不应该生效

边界一多，局部修补就很容易漏。

### 4. Round 2 后 tracker 没继续吸收 review phase 的系统结论

`goal-tracker.md` 在 Round 2 还写着“所有 tracked implementation and verification tasks are complete”。  
但实际从 Round 3 到 Round 14，review 还连续发现了 cursor、actor、stale response、fallback 这几大类问题。

这带来两个后果：

1. 心理上会感觉“明明已经 complete，怎么还在卡”。
2. 实操上每轮更像处理单个 review finding，而不是把后来发现的系统不变量回填成显式 checklist。

这不是代码 bug，但它解释了为什么循环体感会非常长。

## 哪几轮最值得当成“关键拐点”

### Round 3 和 Round 4：cursor 问题第一次被识别为“并发下会失效”

这两轮把问题从“分页能不能跑”推进到“分页在用户继续互动后还能不能稳定跑”。

如果没有这一步，后面 comments/feed 的所有 social mutation 都会天然把 cursor 弄坏。

### Round 8：cursor 模型从“稳定排序”进一步推进到“可恢复”

Round 8 很关键，因为它说明即便排序本身稳定，锚点项被删除后仍然要能恢复下一页。  
这意味着设计开始从“理想条件下稳定”进入“真实会被修改的数据集里仍然稳定”。

### Round 10：真正的前端 stale-response race 被明确打掉

这是整轮最像经典并发问题的一轮。  
Map / Explore / Food 三个视图都出现了“请求发起时的上下文”和“响应提交时的上下文”不一致。

Round 10 之后，团队才算明确建立起“异步结果必须有 ownership 校验”的意识。

### Round 12 到 Round 14：发现 actor 丢失不是单点 bug，而是系统性路由状态问题

Round 12 修 shell nav。  
Round 13 修 journal card map handoff。  
Round 14 又发现 map 自己改 URL 和 Explore 卡片 handoff 仍会丢 actor。

这三轮连起来看，结论非常清楚：

`actor` 传播没有中心化，所以 review 只能顺着用户路径一段一段把漏点揪出来。

## 我认为最核心的根因，不是“并发写错了”，而是这四个不变量没有先立起来

建议把这次复盘压缩成下面四条系统规则：

1. Actor invariant  
   只要用户已经选定 `actor`，任何路由生成、非渲染 URL 改写、跨视图 hand-off 都必须无损携带它。

2. Async ownership invariant  
   任何异步请求返回时，都只能在“请求发起时的上下文仍然是当前上下文”时提交结果。

3. Cursor invariant  
   分页 cursor 必须基于不可变、全序、可恢复的锚点，而不是依赖会被 mutation 改写的字段。

4. Error taxonomy invariant  
   “端点不存在” 与 “当前请求失败” 必须严格区分，不能用同一个 fallback/degrade 分支吞掉真实错误。

如果这四条在 Round 0 的实现设计里就写成 checklist，后续 review 轮数会明显少很多。

## 后续如果再做类似改造，应该怎么避免重演

### 代码层

1. 抽出统一的 actor-aware URL helper，而不是在各 view 里各自拼 `/compose`、`/map`、`/feed`。
2. 所有异步视图加载都统一使用 request token / version guard。
3. cursor 设计文档里必须明确：
   - 排序字段是否可变
   - tie-break 是什么
   - anchor 删除后如何恢复
   - 前端如何 surface cursor 错误
4. fallback 分支统一只处理“能力缺失”，其他错误一律原样上抛并显示。

### 测试层

1. 增加 actor round-trip matrix：
   - Feed -> Compose
   - Feed -> Post Detail
   - Feed -> Map
   - Post Detail -> Compose
   - Explore -> Map
   - Explore -> Compose
   - Shell nav -> 任意页
   - Map 自改 URL 后 -> Shell nav
2. 增加 mutation-between-pages matrix：
   - like/unlike/view/rate/comment/delete 发生在 page 1 与 page 2 请求之间
3. 增加 stale response matrix：
   - destination 改变前后旧请求回包
   - actor 改变前后旧请求回包
   - non-render navigation 前后 shell link 同步
4. 增加 error taxonomy matrix：
   - missing endpoint
   - invalid cursor
   - invalid limit
   - 500
   - transient fetch failure

### 流程层

1. review phase 发现的新系统性问题，要回填进 tracker，而不是只写在单轮 summary。
2. 每轮修复前先判断它是不是“某个不变量的一个新实例”，如果是，就做全局搜索和统一修复。
3. 对 routed SPA 的交互设计，必须先画状态传播图，而不是只画页面结构图。

## 最后判断

这次之所以“很多轮都卡在并发问题”，不是因为实现者一直在同一个 bug 上原地打转，而是因为：

1. 第一版实现先完成了功能闭环。
2. review phase 才开始系统地检查交错状态。
3. 系统里缺的不是一个点，而是四个横跨多页面、多接口、多 fallback 路径的不变量。
4. 每修完一个实例，review 又在另一个 hand-off 或另一个 mutation 路径上找到同族缺口。

所以这是一场典型的“系统状态模型补课”，不是简单的“修代码手速不够”。

## 关键证据索引

- Round 3: `round-3-review-result.md`, `1a38329`, `705b043`
- Round 4: `round-4-review-result.md`, `de47397`, `4326edd`
- Round 5: `round-5-review-result.md`, `3fc3842`
- Round 6: `round-6-review-result.md`, `3ad6628`
- Round 8: `round-8-review-result.md`, `84cee62`
- Round 9: `round-9-review-result.md`, `8a31ad7`
- Round 10: `round-10-review-result.md`, `ab63827`
- Round 11: `round-11-review-result.md`, `a76c753`
- Round 12: `round-12-review-result.md`, `3eef5b1`
- Round 13: `round-13-review-result.md`, `040ba5a`
- Round 14: `round-14-review-result.md`
