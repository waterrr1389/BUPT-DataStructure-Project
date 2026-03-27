# Trail Atlas

## 项目简介
`Trail Atlas` 是一个围绕出行与探索体验设计的产品。它把目的地浏览、推荐、路线规划、周边设施查找、餐饮发现以及日记交流放在同一个整体流程里，让用户可以从“想去哪里”一路走到“怎么去、吃什么、记录什么”。

这个项目强调连续、真实的探索过程，而不是拆散的单点功能。用户既可以查看目的地信息、获取推荐、规划不同方式的路线，也可以在途中寻找设施与餐饮，并通过日记、评分与搜索继续沉淀自己的体验与内容。

## 核心体验
- 浏览目的地并获得推荐
- 规划不同方式与策略的路线
- 查找周边设施与餐饮
- 发布、查看、评分和推荐日记内容
- 通过搜索与交换延展探索记录

## 产品特点
- 一个统一的探索闭环：从发现目的地到完成记录，都在同一套体验里完成
- 强调实用场景而不是演示式拼接，让搜索、路线、设施、餐饮和内容彼此关联
- 既关注出行决策，也关注体验沉淀，让探索结果可以被保存、分享和再次发现

## 环境要求
- Git
- Node.js `>=20`
- npm

## 快速开始
### Windows
在 PowerShell 中运行：

```powershell
git clone <current-repository-url> ds-ts
cd ds-ts
npm install
npm run start
```

### macOS / Linux
在终端中运行：

```bash
git clone <current-repository-url> ds-ts
cd ds-ts
npm install
npm run start
```

启动后打开 `http://127.0.0.1:3000`

如果你已经在仓库根目录中，可以直接从 `npm install` 开始。

## 常用命令
- `npm run start`：先执行构建，再运行 `dist/src/server/index.js`
- `npm test`：包含 `npm run build`，随后执行 `dist/tests/index.js`
- `npm run validate:data`：包含构建并校验真实种子数据
- `npm run benchmark`：包含构建并输出代表性基准结果
- `npm run demo`：包含构建并输出确定性的演示报告

## 当前交付边界
- 第一方浏览器源码位于 `public/*.ts` 与 `public/spa/**/*.ts`
- `public/vendor/**` 是第三方浏览器资源的例外目录
- `dist/public/**` 仅作为构建生成并被服务的浏览器运行时输出，不作为源码编辑位置
- 当前浏览器与 API 交付面覆盖目的地浏览、局部路线规划、world 视图与 world route 规划、设施与餐饮发现、日记 feed 与详情、以及 journal exchange 工具

## 记录的验证证据
- `2026-03-27`：当前轮次重跑 `npm test`
- `2026-03-19`：保留的记录运行 `npm run validate:data`、`npm run benchmark`、`npm run demo`
- `2026-03-18`：保留的历史记录，证明非受限环境下 `npm run start` 的启动与 smoke 行为
