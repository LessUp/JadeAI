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

docker build --pull -t jadeai-local:latest .

docker run -d --name jadeai \
  --restart unless-stopped \
  --env-file .env.local \
  -p 3000:3000 \
  -v "$(pwd)/jadeai-data:/app/data" \
  jadeai-local:latest
```

Then open [http://localhost:3000](http://localhost:3000).

> `AUTH_SECRET` is required. You can generate one with `openssl rand -base64 32`.

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
