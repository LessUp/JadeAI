<div align="center">

# JadeAI

**AI 驱动的简历与求职工作台**

拖拽编辑、AI 优化、版本历史、模拟面试、多格式导出，一站式完成简历制作与求职准备。

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-222?logo=githubpages)](https://lessup.github.io/JadeAI)

[English](./README.en.md) · [更新日志](./changelog/)

</div>

---

> 仓库首页：https://lessup.github.io/JadeAI  
> GitHub Pages 只承载项目主页与说明文档；完整应用需要服务端运行环境来支持 API、认证、数据库和导出能力。

## JadeAI 是什么

JadeAI 是一个面向简历编辑、AI 优化和求职准备的全栈应用。它把传统“文档编辑器 + 模板网站 + AI 工具”的体验整合成一个工作流：

- 在可视化画布里拖拽、编辑、排序简历模块
- 用 AI 生成内容、润色经历、分析 JD、翻译简历、生成求职信
- 在模拟面试里按岗位要求练习，并生成评估报告
- 导出 PDF / DOCX / HTML / TXT / JSON，或生成分享链接

## 核心能力

### 简历编辑

- **拖拽式编辑器**：模块、条目与顺序可直接调整
- **50 套模板**：覆盖通用、创意、技术、金融、学术等风格
- **主题定制**：颜色、字体、间距、页边距实时预览
- **Markdown 支持**：摘要、经历、项目等文本支持 Markdown 排版
- **多简历管理**：支持创建、复制、重命名、搜索和排序

### AI 求职能力

- **AI 聊天助手**：在编辑器中对话式修改简历
- **AI 生成简历**：根据职位、技能和经历快速生成初稿
- **AI 简历解析**：上传 PDF / 图片自动抽取内容
- **JD 匹配分析**：关键词匹配、ATS 分析与改进建议
- **语法与写作检查**：识别弱表达、语法问题与可优化内容
- **多语言翻译**：跨语言转换并保留技术术语
- **AI 求职信**：结合简历和 JD 生成定制求职信

### 版本与恢复

- **完整草稿级撤销 / 重做**：覆盖标题、模板、主题、语言和模块内容
- **本地版本历史**：自动保存后保留浏览器本地版本记录
- **历史恢复**：可以从本地版本列表中恢复到先前状态

### 模拟面试

- **基于 JD 的面试模拟**：按岗位描述生成面试流程
- **多角色面试官**：HR、技术、行为、项目深挖、Leader 等
- **追问与提示**：根据回答质量动态追问
- **面试报告**：评分、维度分析、建议与导出

### 导出与分享

- **多格式导出**：PDF、智能一页 PDF、DOCX、HTML、TXT、JSON
- **JSON 导入**：可恢复现有简历或创建新简历
- **分享链接**：支持密码保护与访问统计
- **本地 PDF 渲染依赖**：优先使用系统 Chrome / Chromium；如未找到，会提示并回退到 bundled Chromium。可通过 `CHROME_PATH` 显式指定浏览器路径以避免运行时下载。
- **PDF 分页引擎**：`fit-one-page` 与 `prevent-blank-page` 现在共用同一个分页策略入口，并可在 `node --import tsx scripts/benchmark-pdf-layout.ts` 中输出分页 telemetry，便于比较不同渲染引擎与压缩效果。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16、React 19、Tailwind CSS 4、shadcn/ui、Radix UI |
| 状态管理 | Zustand |
| AI | Vercel AI SDK v6、OpenAI、Anthropic |
| 数据库 | Drizzle ORM、SQLite / PostgreSQL |
| 认证 | NextAuth.js v5、FingerprintJS |
| 导出 | Puppeteer Core、Chromium、DOCX |
| 国际化 | next-intl |

## 快速开始

### Docker（推荐）

```bash
cp .env.example .env.local
# 至少设置 AUTH_SECRET；如需容器内直接启用 AI，设置 OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY

pnpm docker:run
```

默认会：

- 按 `package.json` 的版本号构建 `jadeai-local:v<version>` 与 `jadeai-local:latest`
- 使用名为 `jadeai-data` 的 Docker volume 持久化 SQLite 数据
- 在本机 `3003` 端口启动容器，访问 [http://localhost:3003](http://localhost:3003)

如果你想只构建镜像，不启动容器：

```bash
pnpm docker:build
```

镜像现在基于 Debian slim 构建，而不是 Alpine，这样安装 Chromium 与 CJK 字体时不会再依赖 `apk`，能规避部分代理环境下的 TLS / 超时问题。

如果你想改为宿主机目录持久化数据库：

```bash
DATA_DIR="$(pwd)/jadeai-data" pnpm docker:run
```

> `AUTH_SECRET` 是必填项，可使用 `openssl rand -base64 32` 生成。
>
> 如果你希望容器启动后所有用户都能直接使用 AI，而不是分别在浏览器里填写 Key，请在 `.env.local` 里配置服务端 AI 环境变量，例如：
>
> ```bash
> AI_PROVIDER=openai
> OPENAI_API_KEY=sk-...
> AI_MODEL=gpt-4o
> ```
>
> 也支持 `ANTHROPIC_API_KEY` 与 `GOOGLE_GENERATIVE_AI_API_KEY`；若未设置 `AI_PROVIDER`，应用会自动选择第一个已配置的服务端模型提供商。
>
> 镜像内应用默认以非 root 用户运行；如果你使用 `DATA_DIR=...` 绑定宿主机目录并遇到 SQLite 权限问题，请确保该目录对容器内 uid `1000` 可写。

### Docker Hub 发布与版本号规范

Docker 镜像版本现在统一以 `package.json` 的 `version` 为唯一来源：

- Git tag / Release note / Docker tag 统一使用 `v<version>`，例如 `v0.3.7`
- 发布脚本会同时推送 `v<version>`、`<version>`，稳定版本额外推送 `latest`
- 预发布版本（如 `0.4.0-rc.1`）不会覆盖 `latest`

建议发布流程：

```bash
pnpm version patch --no-git-tag-version
# 然后补一份 changelog/YYYY-MM-DD-vX.Y.Z-release.md

docker login
IMAGE_REPOSITORY=shuai0/jadeai pnpm docker:publish
```

发布脚本默认使用 `docker buildx` 生成 `linux/amd64,linux/arm64` 多架构镜像；如需先本地演练，可执行：

```bash
PUSH=false PLATFORMS=linux/amd64 IMAGE_REPOSITORY=shuai0/jadeai pnpm docker:publish
```

### 本地开发

```bash
git clone https://github.com/LessUp/JadeAI.git
cd JadeAI

pnpm install
cp .env.example .env.local
pnpm db:generate
pnpm db:migrate
pnpm dev
```

默认数据库为 SQLite；如需 PostgreSQL，请在 `.env.local` 中设置：

```bash
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/jadeai
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm db:generate` | 生成 SQLite 迁移 |
| `pnpm db:generate:pg` | 生成 PostgreSQL 迁移 |
| `pnpm db:migrate` | 执行迁移 |
| `pnpm db:seed` | 填充示例数据 |

## 截图

| 模板画廊 | 简历编辑器 |
|:---:|:---:|
| ![模板画廊](images/template-list.png) | ![简历编辑器](images/resume-edit.png) |

| AI 优化 | JD 匹配分析 |
|:---:|:---:|
| ![AI 优化](images/ai%20优化.png) | ![JD 匹配分析](images/JD%20匹配分析.png) |

| 模拟面试 | 面试报告 |
|:---:|:---:|
| ![模拟面试](images/模拟面试.png) | ![面试报告](images/面试报告.png) |

## 文档与发布记录

- 版本更新请查看 [`changelog/`](./changelog/)
- 架构说明请查看 [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 功能想法请查看 [`FEATURE-IDEAS.md`](./FEATURE-IDEAS.md)

## 社区

- [Linux.do](https://linux.do/)

---

如果你想把 JadeAI 部署到自己的服务器，建议先用本地 Docker 流程验证，再迁移到正式环境。
