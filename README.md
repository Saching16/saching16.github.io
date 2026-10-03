# Sachin Ganpule — Personal Website

Personal portfolio and research archive for Sachin Ganpule, built with Next.js and deployed on Vercel. The site includes a **Digital Twin** chatbot that answers questions about Sachin's background using retrieval-augmented generation (RAG) over his resume, LinkedIn export, and research notes.

## Features

- Single-page portfolio: hero, status, areas of inquiry, reading archive, featured projects, and contact links.
- Scroll-reactive dark gradient background (`hooks/useScrollProgress.js` drives the colors in `app/page.js`).
- Digital Twin chat backed by a server-side API route that calls OpenAI. The API key never reaches the browser.
- Chatbot sources are generated from PDFs at build time, and a weekly GitHub Action pulls updated resume and LinkedIn PDFs from Google Drive and opens a pull request for review.

## Tech stack

| Area       | Choice                                                               |
| ---------- | -------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, plain JavaScript                  |
| Styling    | Hand-written CSS in `app/globals.css`, fonts from `next/font/google` |
| AI         | OpenAI Node SDK: `text-embedding-3-small` and `gpt-4o-mini`          |
| PDF text   | `pdf-parse` (build time only)                                        |
| Tests      | Vitest                                                               |
| Lint       | ESLint with `eslint-config-next`, Prettier for formatting            |
| Hosting    | Vercel (auto-deploys from `main`)                                    |
| Automation | GitHub Actions (`.github/workflows/weekly-rag-refresh.yml`)          |

## Getting started

Requires Node.js 24 (the version CI uses; `npm run fetch-drive` needs at least 22.9 for `--env-file-if-exists`).

```bash
npm install
cp .env.example .env   # then fill in OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page works without an API key, but the Digital Twin chat returns an error until `OPENAI_API_KEY` is set.

## Scripts

| Command               | What it does                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server.                                                                 |
| `npm run build`       | Production build. Runs `sync-rag` first via `prebuild`.                                       |
| `npm start`           | Serve the production build.                                                                   |
| `npm run sync-rag`    | Extract text from `data/rag/` sources and regenerate `data/rag/sources.js`. Also adds each `data/repos/<slug>/overview.md`. |
| `npm run sync-repos`  | Copy the research repos listed in `data/repos/config.mjs` into `data/repos/`.                  |
| `npm run build-repo-overview` | Write `data/repos/<slug>/overview.md` with `gpt-4.1` when a snapshot branch commit changed. Needs `OPENAI_API_KEY`. |
| `npm run fetch-drive` | Download changed resume/LinkedIn PDFs from Google Drive (needs Google credentials in `.env`). |
| `npm test`            | Run the Vitest suite in `tests/`.                                                             |
| `npm run lint`        | Run ESLint.                                                                                   |

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable                      | Used by                                   | Required             |
| ----------------------------- | ----------------------------------------- | -------------------- |
| `OPENAI_API_KEY`              | Chat API route, change-summary script, `npm run build-repo-overview` | Yes, for the chatbot |
| `CHAT_ANALYTICS_SALT`         | Hashing client IPs in chat analytics logs | No (has a default)   |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `npm run fetch-drive`                     | Only for Drive sync  |
| `GOOGLE_DRIVE_FOLDER_ID`      | `npm run fetch-drive`                     | Only for Drive sync  |

## Project structure

```text
app/
  api/digital-twin/route.js   Chat API: origin check, rate limit, validation, analytics
  globals.css                 All site styles
  layout.js                   Root layout, fonts, metadata, skip link
  page.js                     Home page and scroll-reactive background
components/                   SiteHeader, HeroSection, DigitalTwinChat
hooks/useScrollProgress.js    Scroll position (0 to 1), throttled with requestAnimationFrame
data/
  projects.js                 Featured projects
  readingArchive.js           Reading archive entries
  rag/                        Chatbot source files and generated sources.js (see data/rag/README.md)
  repos/                      Research-repo list, manifest, and generated snapshots
lib/
  digitalTwinRag.js           Chunking, embeddings, retrieval, and answer generation
  digitalTwinConfig.js        Message, history, and rate-limit settings
  digitalTwinAnalytics.js     Structured JSON logs for each chat request
  rateLimiter.js              In-memory per-IP rate limiter
scripts/                      RAG sync, Google Drive fetch, and PR summary scripts
tests/                        Vitest tests
public/resume.pdf             Resume linked from the site
assets/profile.png            Hero portrait
```

## Updating content

- **Page copy** (projects, reading archive, hero text, skills): see [docs/content.md](docs/content.md).
- **Chatbot knowledge** (resume, LinkedIn, research interests): see [data/rag/README.md](data/rag/README.md).

## Deployment

Pushing to `main` deploys to Vercel. The Vercel build runs `npm run build`, which regenerates the chatbot sources from the PDFs in `data/rag/`. See [docs/deployment.md](docs/deployment.md) for environment setup, the weekly Drive refresh workflow, and troubleshooting.

## Documentation

| Document                                             | Contents                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)         | How the page, chat API, and RAG pipeline fit together            |
| [docs/digital-twin-api.md](docs/digital-twin-api.md) | Chat API request/response contract, limits, and logging          |
| [docs/content.md](docs/content.md)                   | Where each piece of site content lives and how to edit it        |
| [docs/deployment.md](docs/deployment.md)             | Vercel, GitHub secrets, weekly refresh workflow, troubleshooting |
| [data/rag/README.md](data/rag/README.md)             | Updating the chatbot's source material                           |
| [AGENTS.md](AGENTS.md)                               | Conventions and guardrails for AI coding agents                  |
| [PLAN.md](PLAN.md)                                   | Design of the weekly Google Drive RAG refresh                    |
| [PLAN_UPDATED_WEBSITE.md](PLAN_UPDATED_WEBSITE.md)   | Earlier plan for build-time RAG generation (historical)          |
