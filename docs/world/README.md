# World Docs

## Purpose

本目录收敛 world mode 的必要交接材料，供后续 agent 或实现者直接开工。

这里的内容只描述 world mode 这一特定上下文下的方案与交接边界，不是当前 `main` 的完整产品事实清单，也不是过程/历史记录。

在该上下文内，技术基线已冻结：

- world mode 的前端地图实现必须使用 `Leaflet + CRS.Simple`
- 现有 local map 继续保持 SVG 渲染，不迁移到 `Leaflet`
- world graph 与 local graph 分层存在，通过 `portal` 连接

## Files

- [spec.md](./spec.md)
  - world mode 的总方案、范围、术语、Boston-inspired 空间逻辑和实施顺序
- [contract.md](./contract.md)
  - world 数据模型、HTTP 合同、路由语义和失败语义
- [plan.md](./plan.md)
  - world mode 的实施计划与参考性任务拆分，供维护中的 planning/reference set 对照使用
- [boston-inspired.seed-fragment.json](./examples/boston-inspired.seed-fragment.json)
  - Boston-inspired 的 world 样例数据片段，供规格/合同对照使用，不是当前运行时 seed 的唯一事实来源

## Merge Notes

本目录文件已经吸收并替代以下旧草案。以下名称只用于来源追踪，不表示这些旧文件仍作为当前仓库的活跃文档存在：

- `spec.md`
  - 合并了原 `world-map-mode-spec-and-plan.md`
  - 合并了原 `world-map-review-glossary.md`
  - 合并了原 `world-map-boston-reference-mapping.md`
- `contract.md`
  - 合并了原 `world-models-draft.md`
  - 合并了原 `world-api-contract-draft.md`
- `examples/boston-inspired.seed-fragment.json`
  - 接替原 `world-map-boston-inspired.seed-fragment.json`

## Reading Order

推荐顺序：

1. 先读 [spec.md](./spec.md)
2. 再读 [contract.md](./contract.md)
3. 再读 [plan.md](./plan.md)
4. 最后对照 [boston-inspired.seed-fragment.json](./examples/boston-inspired.seed-fragment.json)
