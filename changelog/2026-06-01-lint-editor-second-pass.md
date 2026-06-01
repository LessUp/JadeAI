# 2026-06-01 lint 分批治理（第二批：`src/components/editor`）

## 本次目的

继续按目录压缩 lint warnings，聚焦编辑器核心目录 `src/components/editor`。

## 本次改动

1. **错误边界 `any` 改造为 `unknown`**
   - `cover-letter-dialog.tsx`：`catch (err: any)` → `catch (error: unknown)`，统一提取 message。
   - `export-dialog.tsx`：同上。
   - `grammar-check-dialog.tsx`：同上。
   - `jd-analysis-dialog.tsx`：同上。

2. **i18n key 与 props 类型收敛**
   - `cover-letter-dialog.tsx`：新增 `TONE_LABEL_KEYS`，去掉 `as any` 的动态 key 拼接。
   - `editable-date.tsx`：引入 `MonthKey/MonthMessageKey`，移除月份翻译处 `as any`。
   - `section-wrapper.tsx`：`sectionComponents` 的 `onUpdate` 从 `any` 改为 `Partial<SectionContent>`。
   - `grammar-check-dialog.tsx` / `jd-analysis-dialog.tsx`：结果视图与 badge 组件的 `t` 入参改为 `ReturnType<typeof useTranslations>`。

3. **sections 子模块批量去除 `as any`**
   - `certifications.tsx`
   - `custom-section.tsx`
   - `education.tsx`
   - `github.tsx`
   - `projects.tsx`
   - `skills.tsx`
   - `work-experience.tsx`
   - `languages.tsx`（同时直接使用 `LanguageItem.description`）

4. **无用导入清理**
   - `share-dialog.tsx` 删除未使用的 `Badge` 导入。

5. **`no-img-element` 告警修复**
   - `personal-info.tsx`：将头像 `<img>` 改为 `next/image` 组件（`NextImage`，`unoptimized`）。

## 验证记录

- `pnpm exec eslint src/components/editor` ✅（0 warnings / 0 errors）
- `pnpm type-check` ✅
- `pnpm lint` ✅（全仓警告从 754 降至 714）
