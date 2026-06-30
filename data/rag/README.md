# RAG Source Workflow

This folder contains the source material used by the Digital Twin chatbot.

## Files

- `resume.pdf`: replace this whenever there is a new resume.
- `linkedin.txt`: stable LinkedIn source text. The monthly GitHub Action attempts to refresh this from the public profile.
- `linkedin.pdf`: fallback LinkedIn export.
- `research-interests.md`: editable notes about current research interests.
- `sources.js`: generated file consumed by `lib/digitalTwinRag.js`.

## Updating The Resume

1. Replace `data/rag/resume.pdf`.
2. Replace `public/resume.pdf` with the same file so the website download link stays current.
3. Optionally run `npm run sync-rag` locally to inspect the generated source text.
4. Commit and push.
5. Vercel runs `npm run build`, which runs `npm run sync-rag` first through the `prebuild` script.

## Updating Research Interests

Edit `data/rag/research-interests.md`, then run:

```bash
npm run sync-rag
```

## LinkedIn Refresh

The monthly workflow in `.github/workflows/monthly-linkedin-refresh.yml` tries to fetch the public LinkedIn profile, update `linkedin.txt`, regenerate `sources.js`, and open a pull request if anything changed.

LinkedIn frequently blocks unauthenticated scraping. If that happens, the workflow exits successfully and keeps the current LinkedIn source unchanged.
