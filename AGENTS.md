# AGENTS.md

Guidance for AI coding agents working in this repository. Read [README.md](README.md) for the project overview and [docs/architecture.md](docs/architecture.md) for how the pieces connect.

## Project summary

A Next.js 16 (App Router) personal portfolio with one API route, `POST /api/digital-twin`, which answers questions about Sachin using RAG over his resume, LinkedIn export, and research notes. Deployed on Vercel from `main`. Plain JavaScript (no TypeScript), plain CSS (no Tailwind or CSS modules).

## Commands

```bash
npm install
npm run dev        # dev server on http://localhost:3000
npm test           # Vitest, tests/**/*.test.js
npm run lint       # ESLint (next/core-web-vitals)
npm run sync-rag   # regenerate data/rag/sources.js from data/rag/ source files and repo overviews
npm run build-repo-overview # write data/repos/<slug>/overview.md when a snapshot branch changed
npm run build      # runs sync-rag first via prebuild
```

Run `npm test` and `npm run lint` before finishing any change. There is no CI job that runs them, so nothing else will catch a regression before it deploys.

## Code conventions

- Formatting follows `.prettierrc.json`: semicolons, double quotes, trailing commas.
- Components are named exports (`export function HeroSection()`), one per file in `components/`. Only `app/page.js` and `app/layout.js` use default exports, as Next.js requires.
- Add `"use client"` only to components that use state, effects, or browser APIs.
- Imports are relative (`../lib/...`). There is no path alias.
- Page content lives in `data/*.js` arrays, not inline in components. Add new list content there.
- Styles go in `app/globals.css` using the existing semantic class names (`panel`, `chip-grid`, `project-card`, and so on) and CSS variables. Avoid inline styles, except for the computed background in `app/page.js`.
- Tunable chat limits live in `lib/digitalTwinConfig.js`. Model names and retrieval constants live at the top of `lib/digitalTwinRag.js`.
- Scripts in `scripts/` are ES modules (`.mjs`). Keep pure, testable logic in `scripts/lib/` and keep file and network side effects in the top-level script.

## Generated and sensitive files

- **`data/rag/sources.js` is generated.** Never edit it by hand. Change the inputs (`data/rag/resume.pdf`, `data/rag/linkedin.pdf`, `data/rag/research-interests.md`, or a repo `overview.md`) and run `npm run sync-rag`. Note that `npm run build` also rewrites it.
- **`data/repos/<slug>/snapshot.json`, `data/repos/manifest.json`, and `data/repos/<slug>/overview.md` are generated.** Don't edit them by hand. `npm run sync-repos` writes the snapshot and manifest. `npm run build-repo-overview` writes the overview, and only calls the model when a branch commit in the snapshot changed.
- **`data/rag/drive-manifest.json`** (created by `npm run fetch-drive`) is generated. Don't edit it by hand.
- **`data/rag/resume.pdf` and `public/resume.pdf` must stay identical.** The Drive sync writes both. If you replace one manually, replace the other.
- The PDFs in the repo root (`AI Eng Resume, Master of DS -Sachin Ganpule  (6).pdf`, `LinkedInProfile.pdf`) are original uploads. Nothing reads them. Don't delete them without asking.
- Never commit `.env` or print secret values. `.env.example` lists the variable names.

## Chatbot guardrails

- Keep `app/api/digital-twin/route.js` thin: origin check, rate limit, validation, analytics logging, then a call to `answerCareerQuestion`. Retrieval and prompting belong in `lib/digitalTwinRag.js`.
- The route must stay read-only and must not receive Google credentials. Drive access happens only in the GitHub Action and `scripts/`.
- The route uses `export const runtime = "nodejs"`. Don't switch it to the Edge runtime, because the analytics module uses `node:crypto`.
- The system prompt tells the model to answer only from the retrieved context and not to fabricate details. Preserve that constraint when editing the prompt.
- The embedding index and the rate limiter are both in memory, per serverless instance. Neither is shared across instances or survives a cold start. Don't rely on them for global guarantees.
- Every response path in the route should call `logDigitalTwinEvent` with an `outcome`. Don't log message content or raw IPs.

## Testing

- Tests live in `tests/` and run in the Node environment with Vitest globals enabled.
- Route tests mock `../lib/digitalTwinRag` with `vi.mock` and call `resetRateLimitBuckets()` in `beforeEach`. Follow that pattern so tests never call OpenAI.
- Google Drive helpers accept a `fetchImpl` argument. Pass a mock instead of stubbing global `fetch`.
- Analytics logging is skipped when `NODE_ENV === "test"`.

## Weekly RAG refresh

`.github/workflows/weekly-rag-refresh.yml` runs `fetch-drive`, `sync-rag`, and `summarize-rag-changes.mjs`, then opens a pull request on the `weekly-rag-refresh` branch. The summary script diffs against `git show HEAD:...`, so the workflow must not commit before the pull request step. Design details are in [PLAN.md](PLAN.md). Pull requests from this workflow are never auto-merged, and that should stay the case.

## Documentation

When you change behavior, update the matching doc: [README.md](README.md) for setup and scripts, [docs/](docs/) for architecture, the API, content, and deployment, and [data/rag/README.md](data/rag/README.md) for the source-update workflow.

## Cursor Cloud specific instructions

- Install dependencies with `npm ci`. The Cloud Agent image provides Node.js 22, which is enough for the dev server, tests, lint, and production build. The weekly GitHub Action uses Node.js 24.
- `npm run dev` serves the site at http://localhost:3000. If port 3000 is already accepting connections, reuse that server.
- The homepage, Vitest suite, ESLint, and `npm run build` do not need secrets. `POST /api/digital-twin` returns `Missing OPENAI_API_KEY in environment.` until that variable is set. `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID` are only required for `npm run fetch-drive`.
