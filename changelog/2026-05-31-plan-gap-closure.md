# 2026-05-31 计划缺口补齐（安全 / 数据一致性 / 导出 / 可观测性）

## 本次目的

基于 `plan.md` 的全量审查清单，补齐仍未落地的高优先级缺口，重点覆盖：

- AI chat 配置错误导致的 orphan assistant message
- 简历保存多步写入的事务一致性
- 字体规范化与 DOCX 字体映射稳健性
- PDF 主题与分页规则作用域收敛
- 分享路由调试日志清理
- autosave 失败可观测性

## 主要改动

1. **AI chat 先验配置校验**
   - 在 `/api/ai/chat` 中把 `extractAIConfig()` / `getModel()` 前移到任何 chat DB 副作用之前，避免 `AIConfigError` 时写入 `submitted` 占位消息后提前返回。

2. **SQLite 事务能力增强（支持 async 回调）**
   - `SQLiteAdapter.transaction()` 改为 `BEGIN IMMEDIATE` + `COMMIT/ROLLBACK`，并通过内部队列串行化事务执行，保证异步回调也具备回滚语义。

3. **简历保存路径事务化**
   - 新增 `resumeRepository.replaceDraftForUser()`，把 metadata 更新 + sections 删除/更新/新增纳入同一事务。
   - `/api/resume/[id]` 的 `PUT` 改为走该事务入口，避免半更新状态。

4. **字体策略修复**
   - `normalizeFontStack()` 改为 token 级清洗：保留合法字体 token，仅在全部非法时回退默认。
   - `resolveDocxFonts()` 改为显式 west/east 解析规则，优先保留拉丁字体作为 west、中文字体作为 east。

5. **PDF 样式作用域收敛**
   - `build-theme-css` 不再用 `${selector}, ${selector} *` 全量覆盖字体，只对根容器设定字体族；
   - 全局字号覆盖去掉 `div`，减少对布局容器侵入。
   - PDF 分页 CSS 从 `[data-section] *` 收敛到 `[data-section] / [data-pdf-entry] / [data-pdf-entry-header]`。

6. **分享与可观测性**
   - 移除 `/api/resume/[id]/shares/[shareId]` PATCH 的调试 `console.log`。
   - 增加 autosave 失败文案与 toast：`getAutoSaveFailureCopy()`，并在 `resume-store` 自动保存失败时提示用户。

7. **认证绑定增强**
   - 当存在有效匿名会话 cookie 且请求头 `x-fingerprint` 与 cookie 指纹不一致时，拒绝该身份解析（返回 `null`），减少 header 伪造切换风险。

## 新增 / 更新测试

- `src/lib/db/transaction.test.ts`：SQLite async 事务回滚语义
- `src/lib/db/repositories/resume.repository.test.ts`：`replaceDraftForUser` 失败回滚验证
- `src/lib/resume-theme/theme-config.test.ts`：token 级字体清洗
- `src/lib/font-stacks.test.ts`：DOCX west/east 字体解析
- `src/lib/auth/current-user.test.ts`：cookie/header mismatch 拒绝
- `src/lib/editor/resume-version-history-status.test.ts`：autosave 失败文案
- `src/lib/pdf/export-html.test.ts`：回归基线更新（对应 CSS 作用域收敛后的 deterministic 快照）

## 验证记录

- `node --import tsx --test src/lib/auth/current-user.test.ts src/lib/resume-theme/theme-config.test.ts src/lib/pdf/export-html.test.ts src/lib/db/transaction.test.ts src/lib/db/repositories/resume.repository.test.ts src/lib/font-stacks.test.ts src/lib/editor/resume-version-history-status.test.ts`
- `pnpm type-check`
- `pnpm lint`（0 errors，warnings 仍较多）
- `pnpm build`
- `pnpm release:check`

## 仍待后续推进

- AI tool `updateSection` 的分区 schema 校验与统一 normalization 深模块
- 认证深模块（`CurrentUser`）在全部 API 路由的统一接入（当前仍有多路由 `getUserIdFromRequest + resolveUser` 重复样板）
- lint warning 分批治理（核心目录先清零）
- autosave 成功后用服务端返回值同步本地 `updatedAt` / section ids

---

## 2026-05-31（续）：autosave 成功回写与竞态保护

### 新增改动

1. **autosave 成功后同步服务端状态（含 section 时间戳/ID）**
   - 在 `resume-store` 保存成功分支中解析 `PUT /api/resume/[id]` 返回体，并进行结构归一化（时间字段转换、section 缺省字段回填）。
   - 当“请求发起后本地未再编辑”时，直接用服务端返回值回写 store（包含 `updatedAt` 与 section 维度字段）。
   - 当“请求在途期间本地发生新编辑”时，不覆盖用户新改动；仅同步简历 `updatedAt`，并保持 `isDirty=true` 触发后续自动保存，避免旧响应覆盖新草稿。

2. **补充回归测试**
   - 新增 `src/stores/resume-store.test.ts`：
     - 场景 A：无并发编辑时，验证 `updatedAt` 与 section `updatedAt` 按服务端响应同步，且 dirty 被清除。
     - 场景 B：在途编辑竞态时，验证本地新改动保留、`isDirty` 维持、并且仅同步服务端 `updatedAt` 元数据。

3. **lint 扫描范围收敛**
   - 在 `eslint.config.mjs` 的 `globalIgnores` 中加入 `.worktrees/**`，避免对工作树目录重复扫描导致噪声 warning 膨胀，确保 lint 结果聚焦当前仓库源码。

### 验证记录（续）

- `pnpm type-check` ✅
- `node --import tsx --test src/stores/resume-store.test.ts src/lib/editor/resume-version-history-status.test.ts src/lib/auth/current-user.test.ts src/lib/db/repositories/resume.repository.test.ts` ✅
- `pnpm lint` ✅（0 errors，warnings 仍存量较大）
- `pnpm build` ✅
