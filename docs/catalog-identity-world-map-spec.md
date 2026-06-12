# Catalog, Identity, And World Map Upgrade Spec

## Goal

在不重写 Trail Atlas 整体架构的前提下，冻结并说明已经落地的三类可信度改进：

- 目的地数据、world placement 和 portal label 保持同一套 catalog identity。
- 登录后的写笔记、评论、点赞、评分和删除使用当前 session 用户。
- world map 从抽象路线演示扩展为可浏览、可选点、可跨地图规划的大地图。

本规格的目标是让产品在演示路径上表现为一个一致的旅行探索系统：用户登录后以自己的身份创作和互动；目的地名称、world 标记和选择器显示互相对齐；world map 拥有足够的视觉细节、路网层次和地图驱动交互。

## Context Boundary

本文档定义一次面向产品可信度和演示质量的修复规格。它不是完整的生产认证方案、GIS 导入方案、前端框架迁移方案，也不重新定义现有算法课程项目边界。

本规格默认基于当前仓库架构：

- `src/data/seed.ts` 和 `src/services/fallback-data.ts` 继续提供确定性演示数据。
- `src/services/**` 继续作为业务服务层。
- `src/server/index.ts` 继续提供 Node HTTP server 和 JSON API。
- `public/spa/**` 继续使用 vanilla TypeScript SPA。
- world mode 继续使用 `Leaflet + CRS.Simple`。
- local map 继续使用现有 SVG 渲染，不迁移到 Leaflet。

## Implemented Baseline

## Destination Catalog

当前主 seed catalog 已通过数据校验禁止重复 `destination.name`，并校验 world placement、portal 和 world node 的可见 label 与主 catalog 对齐。选择器仍保留同名目的地消歧逻辑，以便未来接入真实数据时继续保持稳定 destination id 与可读 label。

首页、探索卡片、日记归属、world marker、portal label、route handoff 和目的地详情现在共享同一套 destination identity 约束。

## Identity Flow

登录页、session cookie、`/api/auth/me` 和 `/api/bootstrap.currentUser` 已经接入浏览器 shell。Compose 显示当前用户身份且不提供作者下拉；Feed 的作者选择仅作为内容过滤器；Post Detail 同时显示笔记作者和当前用户。

HTTP 写接口以 session 用户为准，创建笔记、评论、点赞、取消点赞、评分和删除等写操作不再依赖浏览器提交的伪造 `userId` 或旧 actor 参数。新注册用户保存在当前进程内，并可在当前会话中创作和互动。

## World Map

world map 使用与 world 坐标系对齐的 raster asset，并通过 Leaflet 常态渲染底图、区域 polygon、world graph 路网、hub、junction、portal node 和 destination marker。道路、桥、隧道、铁路等 roadType 由图层样式和说明共同表达。

路线规划支持 world-only 与 cross-map itinerary。用户可以通过 marker 和详情面板设置起终点；cross-map 规划默认通过 portal 选择本地入口，不要求普通用户手写 local node id。

## Frozen Decisions

以下约束在本规格中冻结：

- Destination ids、local graph node ids、API path、query key 和协议字段保持稳定。
- Destination display names 可以调整，但必须同步更新测试期望、world labels 和 journal fixture。
- world map 底图必须是坐标对齐的高分辨率 raster asset，且不把地名文字直接烘焙进图片。
- 地名、区域名、路网、目的地 marker、hub、junction、路线和状态标签必须由 Leaflet 或 DOM 图层渲染。
- world mode 继续放在 `/map?view=world`。
- local map 继续保持现有 SVG 渲染。
- world graph 与 local graph 保持分层，不合并成超级图。
- `portal` 继续作为 world 与 local 的唯一合法桥接实体。
- `/api/bootstrap` 保持轻量，不承载 world graph 或大图资源详情。
- 登录态存在时，浏览器写操作以 session 中的当前用户为准。
- Compose 不再让普通用户选择作者。
- Feed 和 Post Detail 不再用 actor 下拉驱动写操作。若保留演示用查看者切换，必须明确标记为只读预览工具，不能影响写操作作者。

## Product Shape

## Destination Catalog Shape

目的地目录应表现为真实演示数据，而不是生成器痕迹：

- 主要 seed catalog 中不应出现重复 `destination.name`。
- 生成名称不得出现明显机械组合，如同词重复。
- 首页、探索卡片、日记归属、world marker 和路线 handoff 显示同一套 destination name。
- 选择器继续使用稳定 destination id 作为 value。
- 如果将来真实数据允许同名地点，选择器消歧逻辑仍应保留。

## Identity Shape

登录后的用户体验应保持一致：

- 未登录用户进入主要 SPA 页面时继续跳转登录页。
- 登录后顶部用户栏显示当前用户。
- 写笔记页显示当前用户身份，但不允许选择其他作者。
- 创建笔记、评论、点赞、取消点赞、评分和删除等写操作使用当前 session 用户。
- Feed 的作者筛选可以保留为内容过滤器。
- Post Detail 可以显示作者信息和当前用户操作状态。
- 新注册用户至少能在当前会话内正常创作、互动，并在自己的内容中显示可读用户名。

## World Map Shape

world map 应从路线 demo 升级为可浏览地图：

- 底图应体现水体、陆地区域、主要道路、桥、隧道入口、校园区、市场区、港湾区和地形/城区层次。
- 底图不得承载可交互文字；文字由图层渲染。
- 地图常态显示 world graph 的主要路网。
- 不同 roadType 应有可辨识的样式。
- hub、junction、portal 和 destination marker 应具备不同视觉层级。
- 用户点击 destination marker 可以打开详情面板，并可设置为路线起点或终点。
- world-only route 应能通过地图选点或选择器规划。
- cross-map route 不应要求用户手写 local node id；默认使用主要 portal，也可以通过详情面板选择可读入口。
- 规划结果在地图上高亮路线，并在侧栏中显示可读说明和 local map handoff。

## Data Contracts

## Destination Naming

主 destination records 保持现有结构，但 seed/fallback 数据必须满足：

- `id` 唯一且稳定。
- `name` 非空。
- 演示 seed 中 `name` 唯一。
- `region` 继续作为 display/search/filter 相关数据。
- `keywords` 和 `categories` 继续支持现有搜索和推荐。

允许通过以下方式达到唯一性：

- 扩展 scenic 和 campus 名称词库。
- 引入确定性区域或地貌限定词。
- 避免同词组合。
- 对已有 journal fixture、world placement 和测试期望做同步更新。

## World Data Alignment

world data 必须和主 destination catalog 对齐：

- 每个 `world.destinations[].destinationId` 必须引用真实 destination。
- world placement label 的 destination name 部分必须来自主 catalog 或统一 display helper。
- portal label 和 portal world node label 必须和对应 destination 一致。
- world summary/details 不得返回与主 catalog 冲突的可见名称。
- world region labels 可以继续使用 display mapping。

## World Visual Asset

world 底图 asset 必须满足：

- 尺寸与 `world.width` / `world.height` 坐标系一致，或代码中明确设置一致的 bounds。
- 不包含地名、marker 文本或路线文字。
- 不出现明显黑边、低分辨率拉伸、模糊占位块。
- 保留 Boston-inspired 空间逻辑：水体切分空间、桥和隧道形成 choke point、主干线少而强、世界图不对称。

## Identity Data

用户相关合同保持：

- `currentUser` 表示当前 session 用户。
- seed users 可继续作为演示账号和内容 fixture。
- 新注册用户保存在当前进程内的 `UserStore`，本规格不要求生产级持久化。
- `bootstrap.users` 可以继续用于作者筛选和展示 lookup，但必须包含当前 session 用户，或前端必须把 `currentUser` 合并到用户 lookup 中。

## API Surface

## Authentication

现有接口继续存在：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

浏览器写操作使用 HttpOnly session cookie 识别用户。

## Journal Writes

以下写接口应以 session 用户为准：

- `POST /api/journals`
- `PATCH /api/journals/:id`
- `DELETE /api/journals/:id`
- `POST /api/journals/:id/comments`
- `DELETE /api/comments/:id`
- `POST /api/journals/:id/likes`
- `DELETE /api/journals/:id/likes`
- `POST /api/journals/:id/rate`

未认证请求应返回稳定 401 错误，除非调用路径是明确的 service-level demo/test helper 而不是 HTTP 写接口。

读取接口可以继续接收筛选参数：

- 作者筛选可使用 `userId`。
- 当前查看者状态应优先使用 session 用户；如果为了兼容保留 `viewerUserId`，浏览器 UI 不应让普通用户误以为自己能冒充其他用户写操作。

## World Map APIs

现有 world 接口继续存在：

- `GET /api/world`
- `GET /api/world/details`
- `POST /api/world/routes/plan`

本规格不要求改变 route response shape，但要求 route request 能由地图驱动 UI 生成，不要求用户输入内部 local node id。

## UI Requirements

## Compose

写笔记页应：

- 显示当前登录用户。
- 隐藏或移除作者 `<select>`。
- 发布请求不依赖前端提交的 `userId`。
- 发布成功后进入新笔记详情，并保持当前用户上下文。
- 当前用户缺失时显示可恢复错误或跳转登录。

## Feed

动态页应：

- 保留作者筛选作为内容过滤器。
- 使用当前用户计算 like/viewer state。
- 写操作按钮不得由 actor 下拉决定用户身份。
- 写笔记入口不得带旧 actor 参数。

## Post Detail

笔记详情页应：

- 显示笔记作者和当前用户。
- 评分、点赞、评论、删除等写操作使用当前用户。
- 删除按钮仅对作者或当前允许的用户显示。
- 不再要求用户通过 actor 下拉选择操作人。

## World Map UI

world map 页面应：

- 以地图为主视觉，而不是让表单占据主要体验。
- 常态显示底图、区域边界、主要路网、hub、junction、portal 和 destination marker。
- 为 destination marker 提供详情面板。
- 支持通过点击或详情面板设置起点/终点。
- 支持重置选择。
- 支持 route result 高亮。
- 支持 local map handoff。
- 移动端布局不得让地图、面板和路线说明互相遮挡。

## Validation And Safety

数据验证应覆盖：

- seed destination name 唯一性。
- world placement、portal 和 world node visible label 与 catalog 对齐。
- world graph nodes/edges/portals 仍满足现有引用完整性。
- new world visual asset 可以被 build 复制到 `dist/public/assets/**`。

认证安全应覆盖：

- HTTP 写接口未登录时拒绝。
- 已登录用户不能通过 body/query `userId` 冒充其他用户写入内容。
- 前端不再暴露作者写入下拉。

视觉安全应覆盖：

- world map 底图加载失败时显示降级状态。
- route polyline、marker 和 labels 不应使 Leaflet 容器空白。
- 移动端 world map 页面不应出现关键控件不可达。

## Testing Contract

测试应覆盖：

- seed catalog 中 destination name 唯一。
- world placement labels 与主 catalog 一致。
- shared destination selector label 无重复，且 value 仍为 id。
- Compose 页面不再渲染作者下拉，并以当前用户创建笔记。
- HTTP 创建笔记时，body 中伪造 `userId` 不会覆盖 session 用户。
- 未登录 HTTP 写请求返回 401。
- Feed/Post 写操作使用 current user。
- world map 使用高分辨率底图 asset。
- world map 常态创建 road/hub/junction/destination 图层。
- world route 可以通过 UI 选择起终点规划，并渲染可见 polyline。
- local map `/map?destinationId=...` 不回归。
- browser build 仍不把 first-party generated JS 写回 `public/`。

## Rollout Model

推荐分三条工作线：

- Destination catalog and world data alignment.
- Authenticated identity flow.
- World map visual and interaction upgrade.

前两条可以并行。world map upgrade 必须在 world data alignment 稳定后推进，避免新底图和坐标数据反复返工。

## Non-Goals

本规格不做：

- 生产级用户持久化、密码策略或权限系统。
- 引入 React、Vue 或完整状态管理框架。
- 导入真实 GIS、OSM 或瓦片服务。
- 替换 Leaflet。
- 重写 local map。
- 把所有 220 个 destination 都强行放到 world map 第一屏。
- 在底图图片里烘焙中文或英文地名。
