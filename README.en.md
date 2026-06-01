<div align="center">

# JadeAI

**AI-powered resume and job-search workspace**

Create resumes, improve them with AI, recover past versions, practice interviews, and export to multiple formats in one workflow.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-222?logo=githubpages)](https://lessup.github.io/JadeAI)

[简体中文](./README.md) · [Changelog](./changelog/)

</div>

---

> Project homepage: https://lessup.github.io/JadeAI  
> GitHub Pages hosts the landing/docs site only. The full application still requires a server runtime for API routes, auth, database access, and export features.

## What JadeAI is

JadeAI is a full-stack application for resume editing, AI-assisted writing, and interview preparation. It combines what would normally be several separate tools into one workflow:

- Drag, edit, and reorder resume sections in a visual editor
- Use AI to generate, rewrite, analyze, translate, and tailor content
- Practice mock interviews based on real job descriptions
- Export to PDF / DOCX / HTML / TXT / JSON or share via protected links

## Key capabilities

### Resume editing

- **Drag-and-drop editor** for sections and items
- **50 templates** across general, tech, creative, finance, and academic styles
- **Theme customization** with live preview
- **Markdown support** in supported text-rich sections
- **Multi-resume dashboard** with search, sort, duplicate, and rename

### AI job-search features

- **AI chat assistant** inside the editor
- **AI resume generation** from role, skills, and experience
- **Resume parsing** from PDF or image uploads
- **JD match analysis** with ATS-style feedback
- **Grammar and writing checks**
- **Resume translation** across multiple languages
- **AI cover letter generation**

### Versioning and recovery

- **Full-draft undo / redo** covering title, template, theme, language, and content
- **Local version history** persisted in the browser
- **Version restore** from the history panel

### Mock interviews

- **JD-driven interview simulation**
- **Multiple interviewer personas**
- **Adaptive follow-up questions**
- **Interview reports** with scoring and export support

### Export and sharing

- **Multi-format export**: PDF, one-page PDF, DOCX, HTML, TXT, JSON
- **JSON import** to restore or create resumes
- **Share links** with optional password protection and view counts
- **Local PDF rendering dependency**: prefers a system Chrome / Chromium. In production, set `CHROME_PATH` to an installed browser; if you really need the bundled Chromium runtime download fallback, explicitly set `ALLOW_CHROMIUM_DOWNLOAD=true`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| State | Zustand |
| AI | Vercel AI SDK v6, OpenAI, Anthropic |
| Database | Drizzle ORM, SQLite / PostgreSQL |
| Auth | NextAuth.js v5, FingerprintJS |
| Export | Puppeteer Core, Chromium, DOCX |
| i18n | next-intl |

## Quick start

### Docker (recommended)

```bash
cp .env.example .env.local
# Set AUTH_SECRET at minimum

pnpm docker:run
```

By default this will:

- build `jadeai-local:v<version>` and `jadeai-local:latest` from `package.json`
- persist SQLite data in a Docker volume named `jadeai-data`
- start the container on port `3003`, available at [http://localhost:3003](http://localhost:3003)

If you only want to build the image:

```bash
pnpm docker:build
```

To run a full but optional container smoke test before publishing:

```bash
pnpm docker:smoke
```

This builds the image, starts it with a temporary Docker volume, and verifies app reachability, SQLite database creation, Chromium execution, and the `/api/ai/models` API. It is intentionally not part of `pnpm release:check`, so normal release checks stay lightweight.

The image now uses Debian slim instead of Alpine so Chromium and CJK font installation no longer depends on `apk`, which avoids the TLS and timeout failures some proxy setups hit during Docker builds.

If Docker builds in mainland China fail while downloading `chromium` or `fonts-noto-cjk` with `unexpected EOF` or `Connection failed`, pass a Debian mirror for the build:

```bash
DEBIAN_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian \
DEBIAN_SECURITY_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian-security \
pnpm docker:build
```

`docker:run` and `docker:publish` accept the same `DEBIAN_MIRROR` / `DEBIAN_SECURITY_MIRROR` environment variables. The Dockerfile also configures apt retries and network timeouts.

If you prefer a host bind mount for the database:

```bash
DATA_DIR="$(pwd)/jadeai-data" pnpm docker:run
```

> `AUTH_SECRET` is required. You can generate one with `openssl rand -base64 32`.
>
> The image now runs as a non-root user by default. If you use `DATA_DIR=...` and hit SQLite permission issues, make sure that directory is writable by container uid `1000`.

### Docker Hub publishing and versioning

Docker image tags now use `package.json` as the single source of truth:

- Git tags, release notes, and Docker tags use `v<version>` such as `v0.3.7`
- The publish script pushes `v<version>` and `<version>` for every release
- Stable releases also publish `latest`, while prereleases such as `0.4.0-rc.1` do not overwrite `latest`

Recommended release flow:

```bash
pnpm version patch --no-git-tag-version
# then add changelog/YYYY-MM-DD-vX.Y.Z-release.md

pnpm release:check
docker login
IMAGE_REPOSITORY=shuai0/jadeai pnpm docker:publish
```

The publish script uses `docker buildx` for `linux/amd64,linux/arm64` by default. For a local dry run:

```bash
PUSH=false PLATFORMS=linux/amd64 IMAGE_REPOSITORY=shuai0/jadeai pnpm docker:publish
```

### Local development

```bash
git clone https://github.com/LessUp/JadeAI.git
cd JadeAI

pnpm install
cp .env.example .env.local
pnpm db:generate
pnpm db:migrate
pnpm dev
```

SQLite is the default database. To use PostgreSQL:

```bash
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/jadeai
```

Database selection rules:

| Configuration | Result |
|---|---|
| `DB_TYPE=postgresql` + `DATABASE_URL` | Uses PostgreSQL |
| `DB_TYPE` omitted, but `DATABASE_URL` is set | Uses PostgreSQL and warns to set `DB_TYPE=postgresql` explicitly |
| `DB_TYPE=sqlite` | Uses SQLite; if `DATABASE_URL` is also set, warns that the URL is ignored |
| Production without `DB_TYPE` or `DATABASE_URL` | Keeps SQLite for compatibility with existing installs and warns |

## Common commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Run a production build |
| `pnpm type-check` | Run TypeScript checks |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate SQLite migrations |
| `pnpm db:generate:pg` | Generate PostgreSQL migrations |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:seed` | Seed sample data |

## Screenshots

| Template Gallery | Resume Editor |
|:---:|:---:|
| ![Template Gallery](images/template-list.png) | ![Resume Editor](images/resume-edit.png) |

| AI Optimization | JD Match Analysis |
|:---:|:---:|
| ![AI Optimization](images/ai%20优化.png) | ![JD Match Analysis](images/JD%20匹配分析.png) |

| Mock Interview | Interview Report |
|:---:|:---:|
| ![Mock Interview](images/模拟面试.png) | ![Interview Report](images/面试报告.png) |

## Docs and release notes

- See [`changelog/`](./changelog/) for release history
- See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for architecture notes
- See [`FEATURE-IDEAS.md`](./FEATURE-IDEAS.md) for feature ideas

## Community

- [Linux.do](https://linux.do/)
