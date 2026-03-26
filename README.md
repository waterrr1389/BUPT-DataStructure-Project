# Trail Atlas

## 项目简介
`Trail Atlas` 是一个以 TypeScript 为主的出行与探索产品，不只是教学脚手架，而是具备完整功能的课程项目。仓库内包含目的地探索、推荐、路线规划、周边设施查找、餐饮推荐以及日记与交换机制，配套 SPA 界面与 JSON API，且依赖全局 `tsc` 编译。浏览器侧维护中的源码位于 `public/*.ts` 与 `public/spa/**/*.ts`，对外提供的运行时资源仍是 `public/*.js` 与 `public/spa/**/*.js`；`public/vendor/**` 仍保留第三方 JavaScript 资源。

## 当前能力
- 目的地探索与推荐：通过自定义排名和全文索引，对目的地与推荐结果提供搜索与排序。
- 路线规划：支持 `distance` / `time` / `mixed` 策略和 `walk` / `bike` / `shuttle` / `mixed` 出行模式的室内外路径规划。
- 周边设施：依据图距离排序附近设施，避免直线误差。
- 餐饮：提供推荐列表、按菜系筛选及容错搜索。
- 日记与社交：支持日记撰写、查看、评分、推荐，搭配 Exchange 搜索、压缩/解压与故事板生成功能。
- 运行时体验：SPA 通过 actor/user 选择替代身份系统，数据持久保存在 `.runtime/*.json`，未引入传统 auth/session。

## 页面与接口概览
- SPA 路由：`/`、`/explore`、`/map`、`/feed`、`/compose`、`/posts/:journalId`。
- 主要 JSON API：`/api/health`、`/api/bootstrap`、目的地与推荐接口、距离/时间/混合路由规划、附近设施、日记/Feed/评论/点赞/评分/查看、Exchange 相关、餐饮接口。

## 环境要求
- Node `>=20`。
- `package.json` 当前包含 `Leaflet` 相关依赖，仍依赖全局 `tsc`。
- 脚本包括：`build`、`validate:data`、`test`、`benchmark`、`demo`、`start`，其中 `build` 会先执行 `build:browser:esm`、`build:browser:script`，再执行现有服务端构建；`start` 默认监听 `127.0.0.1:3000`。

## 快速开始
1. 安装或确认有全局 `tsc`。
2. 运行 `npm run build` 生成产物。
3. 依次执行 `npm run validate:data`、`npm test`、`npm run benchmark` 保证数据与功能完整。
4. 若需本地演示，执行 `npm run demo` 或 `npm run start` 并访问 `http://127.0.0.1:3000`。

## 项目结构
- `src/`: 领域模型、数据、算法、服务与 `server/index.ts`。
- `public/`: 浏览器 SPA 源码、已提供的运行时脚本、样式与第三方静态资源；服务端直接对外提供该目录，因此现有浏览器访问 URL 不变。
- `scripts/`: 含 `validate-data.ts`、`run-benchmarks.ts`、`demo.ts`。
- `tests/` 与 `docs/`：测试与交付文档。

## 当前验证状态
- 仓库文档此前记录过 `npm test` 的一次通过结果；本次文档同步未重新执行构建或测试，因此这里不额外声明新的验证结论。

## 文档索引
- 用户指南：`docs/user-guide.md`。
- 示例结果与测试：`docs/example-results-and-tests.md`。
- 设计文档：`docs/overall-design.md`、`docs/module-design.md`。
- World mode 交接文档：`docs/world/README.md`。
- 数据结构与字典：`docs/data-structures-and-dictionary.md`。
- 其他参考：任务/需求/评估/创新文档（可在 `docs/` 下查找相应文件）。

## 补充说明
1. 所有运行时数据通过 `.runtime/*.json` 保留；SPA 通过选择 actor/user 展示作用，未引入账号系统。
2. 本仓库当前就是可运行的 Trail Atlas 产品，后续更新应围绕功能拓展、数据优化与文档同步展开。 
