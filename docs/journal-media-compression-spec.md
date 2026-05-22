# Journal Media And Compression Spec

## Goal

在保留现有日记、feed、评论、exchange 和本地运行方式的前提下，补齐两个面向课程设计演示的能力：

- 评论区支持本地图片上传、预览、持久化和展示。
- 旅游日记正文支持无损压缩导出、压缩文件下载、导入和解压预览。

这两个能力服务于同一条演示路径：用户可以浏览旅游日记，在评论区上传本地图片参与互动，也可以把日记正文导出为压缩文件，再上传该文件还原预览。

## Context Boundary

本文档定义评论图片上传与日记压缩导入导出的功能规格。它不是完整社交系统重写方案，也不重新定义现有目的地、路线、world map、feed、认证或推荐行为。

本规格默认基于当前仓库架构：

- Node HTTP server 继续提供静态资源和 JSON API。
- SPA 继续使用现有 vanilla TypeScript 架构。
- `JournalMedia` 继续作为日记和评论可复用的媒体元数据形状。
- LZW 无损压缩算法继续作为正文压缩能力的核心算法。

## Frozen Decisions

以下约束已经冻结：

- 评论图片必须支持从浏览器选择本地文件，而不是只填写图片 URL。
- 上传后的图片由服务端保存到运行期目录，并通过稳定静态 URL 返回给浏览器展示。
- 评论记录保存图片元数据，不把图片二进制直接内嵌到评论 JSON 中。
- 图片资源不参与 LZW 文本压缩。
- 日记压缩功能不改变用户正常浏览体验；用户看到的正文必须是可读明文。
- 压缩演示采用导出文件和导入预览形式，而不是在页面上直接展示压缩字节串。
- 上传解析优先使用成熟轻量 multipart 依赖，避免把实现风险集中到手写 parser 上。
- 不为本功能引入完整前端框架，除非后续另一个规格扩大到富文本、多图拖拽、裁剪或复杂上传队列。

## Product Shape

## Comment Image Upload

评论区应支持：

- 选择一张本地图片。
- 在提交前显示图片预览和文件摘要。
- 提交评论时上传图片并创建带图片的评论。
- 评论列表展示图片缩略图或可读图片区域。
- 纯文本评论继续可用。
- 上传失败时保留评论正文输入，给出可恢复提示。

上传范围：

- 支持 `image/png`、`image/jpeg`、`image/webp`、`image/gif`。
- 单张图片大小上限固定为 5 MB。
- 第一轮只要求每条评论最多一张图片。

## Journal Compression Export And Import

日记详情页或 feed 中的日记工具应支持：

- 从某篇日记正文生成压缩导出文件。
- 浏览器下载该文件。
- 用户重新选择该压缩文件。
- 系统解压并展示预览结果。
- 预览中展示原始标题、还原正文、算法名、原始长度、压缩后 payload 长度、压缩率和节省比例。

压缩文件是演示用可移植文件。它可以是 JSON 文本格式，不要求伪装成真实二进制归档。

## Data Contracts

## Comment Media

评论记录应扩展媒体字段：

- `media`
  - 类型：`JournalMedia[]`
  - 缺省值：`[]`
  - 第一轮只写入 `type = "image"` 的条目

`JournalMedia` 继续使用现有形状：

- `type`
- `title`
- `source`
- `note?`

冻结语义：

- `source` 是可由浏览器访问的图片 URL。
- `title` 是用户可见标题或上传文件显示名。
- `note` 可保存可选说明。
- 旧评论缺少 `media` 时必须按 `[]` 处理。

## Upload Response

图片上传接口应返回可直接写入 `JournalMedia.source` 的 URL，以及展示和校验所需元数据。

建议响应字段：

- `item.id`
- `item.url`
- `item.fileName`
- `item.originalName`
- `item.mimeType`
- `item.size`

## Compressed Journal File

压缩导出文件应具备稳定格式标识，便于导入时校验。

建议格式：

```json
{
  "format": "trail-atlas-journal-lzw-v1",
  "algorithm": "lzw",
  "title": "Journal title",
  "compressedBody": "...",
  "stats": {
    "inputLength": 1200,
    "payloadLength": 640,
    "compressionRatio": 0.53,
    "spaceSavings": 0.47
  },
  "exportedAt": "2026-05-23T00:00:00.000Z"
}
```

冻结语义：

- `compressedBody` 只保存日记正文压缩 payload。
- 导入预览必须调用现有解压能力或等价服务端包装还原正文。
- 文件中的 `title` 只用于预览，不作为覆盖线上日记的依据。
- 导入压缩文件不自动创建或更新日记。

## API Surface

## Image Upload

新增接口：

- `POST /api/uploads/images`

契约：

- 接收单张图片文件。
- 返回上传后的静态 URL 和文件元数据。
- 非图片、超过大小、空文件、无法解析的请求必须返回稳定错误。

新增静态资源能力：

- `/uploads/images/:fileName`

契约：

- 只暴露服务端生成文件名的图片。
- 不允许路径穿越。
- 返回正确图片 MIME type。

## Comment API

现有接口扩展：

- `POST /api/journals/:journalId/comments`
  - 新增可选 `media` 字段。
- `GET /api/journals/:journalId/comments`
  - 返回的评论 item 包含 `media`。

第一轮继续保持评论正文必填。只发图片不写正文可以作为后续扩展，不进入本规格首轮范围。

## Compression API

现有接口可继续复用：

- `POST /api/journal-exchange/compress`
- `POST /api/journal-exchange/decompress`

允许新增更面向导出文件的包装接口，但不是必需项。若新增，应保持现有 exchange 压缩接口兼容。

## Storage Model

## Runtime Upload Storage

上传图片保存到运行期目录，建议：

```text
.runtime/uploads/images/
```

要求：

- 文件名由服务端生成。
- 文件扩展名由 MIME type 决定。
- 保存路径不依赖用户原始文件名。
- 删除评论第一轮不强制删除图片文件，但记录应可回滚。

## Journal And Comment Storage

评论 JSON 继续由 `JournalStore` 管理。新增 `media` 字段应自然持久化。

压缩导出文件不要求服务端长期保存。第一轮推荐在浏览器端下载，导入时读取用户选择的文件并调用解压接口。

## UI Requirements

## Comment Surface

帖子详情评论区应提供：

- 正文输入。
- 图片选择控件。
- 上传前预览。
- 移除已选图片。
- 提交状态。
- 上传或评论创建失败提示。
- 评论图片展示。

图片展示必须防止布局被大图撑破，应有稳定宽度、比例约束和移动端适配。

## Compression Surface

日记详情页应提供压缩工具入口：

- 导出压缩日记。
- 导入压缩文件预览。
- 解压结果展示。
- 压缩指标展示。

压缩工具文案应说明这是“无损压缩导出”和“导入还原预览”，避免让用户误解为加密、备份或线上恢复。

## Validation And Safety

图片上传必须校验：

- 文件存在。
- MIME type 在允许范围内。
- 文件大小不超过上限。
- 文件名由服务端生成。
- 静态读取路径不能逃逸上传目录。

评论 media 必须校验：

- `media` 是数组。
- 第一轮最多一个图片条目。
- `type` 必须是 `image`。
- `source` 必须是上传接口返回的本地 URL 或符合允许策略的图片 URL。
- `title` 不能为空。

压缩文件导入必须校验：

- 文件可解析为 JSON。
- `format` 与版本匹配。
- `algorithm` 与支持算法匹配。
- `compressedBody` 存在。
- 解压失败时不破坏当前页面状态。

## Testing Contract

测试应覆盖：

- 图片上传成功返回 URL 和元数据。
- 非图片上传失败。
- 超限图片上传失败。
- 评论创建可携带 media。
- 评论列表返回 media。
- 服务重启后评论 media 仍存在。
- 旧评论缺少 media 时返回 `[]`。
- 帖子详情评论区可提交带图评论并展示图片。
- 压缩导出文件包含稳定格式和指标。
- 导入合法压缩文件可还原正文。
- 导入非法文件显示失败状态。

## Non-Goals

本规格不做：

- 多图评论。
- 视频上传。
- 图片裁剪、压缩、转码或缩略图生成。
- 云存储。
- 富文本编辑器。
- 图片参与 LZW 压缩。
- 压缩文件自动恢复为线上日记。
- 重写前端为 React、Vue 或其他框架。
- 把日记持久化层改成只存压缩正文。

## Implementation Order

建议顺序：

1. 评论 media 契约与旧数据兼容。
2. 图片上传 API 与运行期静态资源服务。
3. 带图评论创建、持久化、读取和测试。
4. 帖子详情评论区上传预览和图片展示。
5. 日记压缩导出文件。
6. 压缩文件导入和解压预览。
7. 补充文案、样式和回归测试。
