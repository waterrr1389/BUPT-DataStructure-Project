# AGENTS.md

## 工作方式
- 在实现前先说明方法。
- 若需求有歧义、风险较高或影响较大，先澄清并等待批准，再开始写代码。
- Plan 只写方案，不写代码。
- 坚持 Spec Coding，不做 Vibe Coding。
- 基于 plan 将任务拆分后分配给不同的 Agent 并行或串行执行。
- 所有子任务应保持边界清晰、职责明确、便于独立验证。
- 完成后再指定一个 Agent 汇总结果并输出最终报告给我。

## 项目结构速览
- `README.md`: 项目简介、环境要求和启动方式。
- `package.json`: npm 脚本、Node 版本要求和依赖声明。
- `src/domain`: 领域模型和共享数据类型。
- `src/data`: 种子数据与数据校验逻辑。
- `src/algorithms`: 核心数据结构与算法，包括图、Trie、倒排索引、Top-K、模糊匹配、多点路线和压缩。
- `src/services`: 业务服务层，负责目的地、路线、设施、餐饮、日记、交换、世界地图和跨地图路线。
- `src/server`: Node HTTP 服务入口，提供静态资源和 `/api/*` JSON 接口。
- `public`: 浏览器端源码、样式、静态资源和 vendored Leaflet 文件。
- `public/spa`: SPA shell、路由视图、地图渲染和前端共享工具。
- `scripts`: 可重复执行的命令行入口，包括 demo、benchmark、数据校验和浏览器构建。
- `tests`: 算法、服务、API、SPA、浏览器构建和回归测试。
- `docs`: 需求、设计、数据结构、世界地图契约和用户文档。
- `dist`: 构建产物，由 npm 脚本生成，不作为主要源码阅读入口。
- `.runtime`: 本地运行时数据目录，通常用于运行期状态。
- `.humanize`: 本地协作/审查辅助目录，不要提交其中内容。

## 快速理解入口
- 先读 `README.md` 了解产品目标：Trail Atlas 个性化旅游探索系统。
- 再读 `docs/overall-design.md` 理解分层架构和数据流。
- 需要看业务边界时读 `src/services/index.ts` 和 `src/services/contracts.ts`。
- 需要看接口行为时读 `src/server/index.ts`。
- 需要看前端页面时从 `public/spa/app-shell.ts` 和 `public/spa/views` 进入。
- 需要看可验证范围时读 `tests/index.ts`，再进入对应测试文件。

## 编码规则
- 代码中只允许使用英文。
- 用户可见的界面文案、表单文案、提示文案和本地化 copy 允许使用中文；变量名、函数名、类型名、协议值、枚举值、URL、CSS class、`data-*`、注释、提交信息和 PR 正文仍应使用英文。
- Spec 不依赖行号定位代码。
- 注释中不要写开发过程式说明。
- 优先用概念性描述定位代码，不用“文件路径 + 行号”。

## 拆分与范围控制
- 将任务拆分为低耦合、可独立验证的子任务
- 重复出现 3 次的流程应沉淀为 Skill。
- 任务分配时优先控制单个 Agent 的上下文范围，避免把过多背景一次性注入到同一个上下文中。
- 只向负责该子任务的 Agent 提供完成任务所必需的最小上下文。
- 跨任务共享信息时，优先传递经过整理的结论、约束和接口，而不是完整过程性上下文。

## 质量要求
- 项目早期只保留最小必要质量标准：可运行、可验证、可回滚。
- 优先保证关键路径和高风险改动可验证。
- 处理 bug 时，先复现，再修复并验证。

## 纠错与协作
- 被纠正时，识别原因并改进做法；对重复性问题，沉淀为明确规则。
- 实现与审查分离：先完成方案或代码，再独立复核。
- 统筹者负责跟踪各 Agent 的输入、输出、依赖关系和验收结果，避免遗漏与重复劳动。
- 汇总报告应至少包含：任务目标、各子任务结果、验证结论、遗留风险、后续建议。

## 禁止事项
- 永远不要使用 `/init`。
- `Agent.md` 应按项目实际需求编写，不要套用空泛模板。
- 不要提交.humanize目录的内容
- 不要在README内添加开发过程描述
- Avoid terms to describe development progress (`FIXED`, `Step`, `Week`, `Section`, `Phase`, `AC-x`, etc) in code comments or commit message or PR body.
- Avoid AI tools name (like Codex, Claude, Grok, Gemini, ...) in code comments or git commit message (including authorship) or PR body.
