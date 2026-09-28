# Deployment and Operations

## Vercel

The site is a Vercel project (`personal-website`) connected to the GitHub repository [Saching16/saching16.github.io](https://github.com/Saching16/saching16.github.io).

- **Production:** every push to `main` deploys automatically.
- **Manual deploy:** `npx vercel --prod` from a machine linked to the project.
- **Build command:** `npm run build`. The `prebuild` script runs `npm run sync-rag` first, so the chatbot sources are always regenerated from the PDFs in `data/rag/`. The build fails if the resume or research interests source is missing.

### Environment variables in Vercel

Set these under **Project Settings → Environment Variables**:

| Variable              | Required | Notes                                                |
| --------------------- | -------- | ---------------------------------------------------- |
| `OPENAI_API_KEY`      | Yes      | Without it, every chat request returns 500.          |
| `CHAT_ANALYTICS_SALT` | No       | Set a random value so IP hashes can't be reproduced. |

Google credentials are not needed in Vercel. The deployed site never talks to Google Drive.

### Logs

Chat analytics are JSON lines in the Vercel function logs for `/api/digital-twin`. Filter on `"event":"digital_twin_chat"` and group by `outcome` to see traffic, rate limiting, and errors. The log format is in [digital-twin-api.md](digital-twin-api.md#analytics-logging).

## Weekly RAG refresh (GitHub Actions)

`.github/workflows/weekly-rag-refresh.yml` keeps the chatbot's resume and LinkedIn sources in sync with a Google Drive folder.

**Triggers:** every Monday at 12:00 UTC, manually from the **Actions** tab (`workflow_dispatch`), or through a `repository_dispatch` event of type `drive-changed`, which is reserved for a future Drive webhook.

**Steps:**

1. `npm run fetch-drive` lists the Drive folder, picks the newest file matching each source, and downloads it only if its ID, modified time, or checksum differs from `data/rag/drive-manifest.json`.
2. `npm run sync-rag` regenerates `data/rag/sources.js`.
3. `node scripts/summarize-rag-changes.mjs` compares the new sources with those committed on `main`, asks `gpt-4o-mini` for a bullet summary of each change, and adds sanity warnings if extracted text is under 500 characters or shrank by more than 40%.
4. `peter-evans/create-pull-request` opens or updates a pull request from the `weekly-rag-refresh` branch. If nothing changed, no pull request is opened.

Review the pull request summary and warnings, then merge to redeploy. The workflow never merges on its own.

### Drive file matching

| Source   | Filename must match                           | Formats                             | Written to                                 |
| -------- | --------------------------------------------- | ----------------------------------- | ------------------------------------------ |
| Resume   | contains `resume` (case-insensitive)          | PDF or Google Doc (exported to PDF) | `data/rag/resume.pdf`, `public/resume.pdf` |
| LinkedIn | contains `linkedin`, or starts with `Profile` | PDF                                 | `data/rag/linkedin.pdf`                    |

The resume is required: the job fails if none is found. LinkedIn is optional.

### GitHub secrets

Under **Settings → Secrets and variables → Actions**:

| Secret                        | Required | Notes                                                                                              |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes      | Full JSON key of a service account with Viewer access to the folder.                               |
| `GOOGLE_DRIVE_FOLDER_ID`      | Yes      | The ID at the end of the folder URL.                                                               |
| `OPENAI_API_KEY`              | No       | Enables the AI change summary. Without it, the pull request notes that the summary is unavailable. |

The one-time Google Cloud and Drive setup is described in [PLAN.md](../PLAN.md#one-time-setup).

### Running the refresh locally

Add `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID` to `.env`, then:

```bash
npm run fetch-drive
npm run sync-rag
node scripts/summarize-rag-changes.mjs /tmp/pr-body.md   # optional, prints the PR body
git diff --stat
```

## Troubleshooting

| Symptom                                                | Likely cause and fix                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat shows "Missing OPENAI_API_KEY in environment."    | Set `OPENAI_API_KEY` in `.env` locally or in Vercel, then restart the dev server or redeploy.                                                   |
| Chat returns "Origin is not allowed."                  | A proxy or custom domain is rewriting the `Host` header so it no longer matches `Origin`. Check `x-forwarded-host` in `route.js`.               |
| Build fails with "Missing required RAG source content" | `data/rag/resume.pdf` (or `resume.txt`) or `research-interests.md` is missing or has no extractable text, for example a scanned PDF.            |
| Chatbot gives outdated answers after replacing a PDF   | The change hasn't been deployed yet. Merge or push to `main` and wait for the Vercel build to finish.                                           |
| Weekly workflow fails with "Missing GOOGLE\_…"         | The GitHub secret isn't set or is misspelled.                                                                                                   |
| Weekly workflow fails with "No Resume file found"      | No file in the Drive folder has `resume` in its name, or the service account can't see the folder. Share it with the service account as Viewer. |
| Weekly workflow fails with "is not a valid PDF"        | The matched file isn't a real PDF, or it's under 1 KB. Re-export it.                                                                            |
| Pull request warns that text shrank or is too short    | The PDF export may be image-only or the wrong file. Open the PDF and check before merging.                                                      |
