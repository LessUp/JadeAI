# 2026-06-01 lint 分批治理（第一批：`src/stores` / `src/app/api`）

## 本次目的

按目录分批压缩 lint warnings，优先处理：

- `src/stores`
- `src/app/api`

## 本次改动

1. **清理 `src/app/api` 中的未使用变量告警**
   - 删除 `src/app/api/interview/[id]/report/route.ts` 中未使用变量 `lang`。
   - 删除 `src/app/api/resume/[id]/export/templates/clean.ts` 中未使用变量 `BL`（projects 分支）。
   - 删除以下模板文件里未使用的 `buildHighlights` 导入：
     - `src/app/api/resume/[id]/export/templates/developer.ts`
     - `src/app/api/resume/[id]/export/templates/magazine.ts`
     - `src/app/api/resume/[id]/export/templates/swiss.ts`

2. **清理 `src/app/api` 中的 `no-explicit-any` 告警**
   - 在 `src/app/api/resume/[id]/shares/route.ts` 中为 `shares.map` 的条目补充精确类型：
     - 新增 `ResumeShareRecord = Awaited<ReturnType<typeof shareRepository.findByResumeId>>[number]`
     - 替换 `map((s: any) => ...)` 为 `map((s: ResumeShareRecord) => ...)`

3. **`src/stores`**
   - 本轮检查时 `src/stores` 未出现新增需处理告警；保持无改动。

## 验证记录

- `pnpm exec eslint src/stores src/app/api` ✅（0 warnings / 0 errors）
- `pnpm type-check` ✅
- `pnpm lint` ✅（全仓仍有存量 warnings，本轮从 760 降至 754，主要下降来自 `src/app/api`）
