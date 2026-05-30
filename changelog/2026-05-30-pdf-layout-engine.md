# 2026-05-30 PDF layout engine seam

- 将 `fit-one-page` 和 `prevent-blank-page` 的分页流程收敛到统一的 `applyPaginationStrategy(...)` 接口，在不改变既有压缩行为的前提下补上可观测 telemetry。
- `generatePdf(...)` 现在可通过 `onPaginationResult` 暴露分页结果，评估入口 `src/lib/pdf/engine-evaluation.ts` 与 `scripts/benchmark-pdf-layout.ts` 会记录分页模式、是否成功、迭代次数和缩放比例。
- 为分页配置补充独立测试，并在 PDF 回归中验证一页压缩路径会产出成功的 telemetry，保证后续继续拆分布局引擎时仍能守住现有排版表现。
