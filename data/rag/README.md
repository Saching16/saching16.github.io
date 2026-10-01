# RAG Source Workflow

This folder contains the source material used by the Digital Twin chatbot.

## Files

- `resume.pdf`: the current resume. Synced from Google Drive, along with `public/resume.pdf`.
- `linkedin.pdf`: LinkedIn "Save to PDF" export. Synced from Google Drive.
- `research-interests.md`: editable notes about current research interests.
- `drive-manifest.json`: generated record of which Drive files were last synced. Do not edit by hand.
- `sources.js`: generated file consumed by `lib/digitalTwinRag.js`. `npm run sync-rag` also adds each `data/repos/<slug>/overview.md` as a source labeled `Project: <repo name>`. Those overview files are written by `npm run build-repo-overview`.

`linkedin.txt` is still read as a fallback if `linkedin.pdf` is missing.

## Updating The Resume Or LinkedIn

Upload the new file to the shared Google Drive folder:

- Resume: any PDF or Google Doc with `resume` in its name.
- LinkedIn: on your profile, choose **More → Save to PDF** and upload the file as-is (`Profile.pdf`), or any PDF with `linkedin` in its name.

If several files match, the most recently modified one wins.

The weekly workflow in `.github/workflows/weekly-rag-refresh.yml` downloads changed files, regenerates `sources.js`, and opens a pull request summarizing what changed. Merge it to redeploy. See `PLAN.md` for architecture and one-time setup.

To run the same steps locally, put `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID` in `.env`, then:

```bash
npm run fetch-drive
npm run sync-rag
```

## Updating Manually

Replace `resume.pdf` (and `public/resume.pdf`) or `linkedin.pdf`, then commit and push. Vercel runs `npm run build`, which runs `npm run sync-rag` first through the `prebuild` script.

## Updating Research Interests

Edit `data/rag/research-interests.md`, then run:

```bash
npm run sync-rag
```
