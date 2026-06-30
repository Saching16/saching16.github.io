# Updated Website + RAG Chatbot Plan

## Goal

Update the portfolio website and Digital Twin RAG chatbot so they reflect the latest resume, current research interests, and a more automated workflow for keeping resume data fresh.

Preferred workflow:

1. Replace the resume at a fixed path in the repo.
2. Commit and push.
3. Vercel build automatically regenerates RAG source data.
4. The chatbot uses the updated resume after redeploy.

This plan uses build-time automation, not live in-browser resume uploads.

---

## Step 1: Establish Source File Locations

### Implementation

- Copy the updated resume into a fixed repo path:
  - `data/rag/resume.pdf`
- Copy the same resume into the public site path:
  - `public/resume.pdf`
- Keep LinkedIn as a RAG source using one of these stable inputs:
  - `data/rag/linkedin.pdf`
  - `data/rag/linkedin.txt`
- Add a research interests file:
  - `data/rag/research-interests.md`

Initial research interests content should cover:

- Agents
- Latent space reasoning
- LatentMAS
- RecursiveMAS

### Verification Before Proceeding

- Confirm `data/rag/resume.pdf` exists and opens correctly.
- Confirm `public/resume.pdf` exists and opens correctly.
- Confirm LinkedIn source input exists as either `data/rag/linkedin.pdf` or `data/rag/linkedin.txt`.
- Confirm `data/rag/research-interests.md` contains the latest research-interest notes.

Do not proceed until all source files are present and readable.

---

## Step 2: Add RAG Source Generation Script

### Implementation

- Add a script such as `scripts/sync-rag-sources.mjs`.
- The script should:
  - Extract text from `data/rag/resume.pdf`.
  - Extract text from `data/rag/linkedin.pdf` if present.
  - Read `data/rag/linkedin.txt` if present.
  - Read `data/rag/research-interests.md`.
  - Normalize whitespace.
  - Generate `data/rag/sources.js`.
- Add a dependency for PDF text extraction, likely `pdf-parse` or a maintained equivalent.
- Preserve the existing `RAG_SOURCES` export shape so `lib/digitalTwinRag.js` continues working.

Expected generated structure:

```js
export const RAG_SOURCES = [
  {
    label: "Resume",
    content: "...",
  },
  {
    label: "LinkedIn",
    content: "...",
  },
  {
    label: "Research Interests",
    content: "...",
  },
];
```

### Verification Before Proceeding

- Run:

```bash
npm run sync-rag
```

- Confirm `data/rag/sources.js` is regenerated.
- Confirm `sources.js` includes:
  - `label: "Resume"`
  - `label: "LinkedIn"`
  - `label: "Research Interests"`
- Confirm generated content is non-empty for every included source.
- Confirm no private binary data or malformed PDF text is accidentally written into `sources.js`.

Do not proceed until the generated RAG source file is correct.

---

## Step 3: Automate RAG Sync During Build

### Implementation

- Add package scripts:

```json
{
  "scripts": {
    "sync-rag": "node scripts/sync-rag-sources.mjs",
    "prebuild": "npm run sync-rag"
  }
}
```

- Keep `sync-rag` available for local manual testing.
- Use `prebuild` so Vercel automatically regenerates `data/rag/sources.js` before `next build`.

### Verification Before Proceeding

- Run:

```bash
npm run build
```

- Confirm build output shows the RAG sync script ran before the Next.js build.
- Confirm `data/rag/sources.js` remains valid after the build.
- Confirm the build completes successfully.

Do not proceed until a full production build passes.

---

## Step 4: Update RAG Chatbot Behavior

### Implementation

- Keep `lib/digitalTwinRag.js` reading from `data/rag/sources.js`.
- Update the system prompt so the assistant can answer questions about:
  - Resume
  - Skills
  - Projects
  - Education
  - Experience
  - Research interests
  - Agents and latent space reasoning
- Consider improving source labels in the UI so users can see whether an answer came from Resume, LinkedIn, or Research Interests.

### Verification Before Proceeding

- Run RAG helper tests:

```bash
npm test
```

- Ask the chatbot locally:
  - "What is Sachin's current resume background?"
  - "What are Sachin's research interests?"
  - "What are LatentMAS and RecursiveMAS?"
- Confirm answers are grounded in generated sources.
- Confirm the chatbot says it lacks enough information when a question is outside the source data.

Do not proceed until chatbot answers reflect the new resume and research-interest source.

---

## Step 5: Update Website Content From Resume

### Implementation

Update site content based on the new resume and research direction.

Likely files:

- `components/HeroSection.js`
- `app/page.js`
- `data/projects.js`
- `data/readingArchive.js`
- `components/SiteHeader.js`

Suggested content updates:

- Refresh hero copy around AI engineering, agents, and research-oriented systems.
- Update the status bar to reflect current work.
- Update skill chips based on the resume.
- Update interests to include agents, latent space reasoning, LatentMAS, and RecursiveMAS.
- Refresh featured projects from the new resume.
- Add a "Download Resume" link pointing to `/resume.pdf`.

### Verification Before Proceeding

- Run:

```bash
npm run lint
npm run build
```

- Start the site locally and visually inspect:

```bash
npm run dev
```

- Confirm:
  - Hero copy is accurate.
  - Research interests are visible.
  - Project descriptions match the latest resume.
  - Download Resume link opens `public/resume.pdf`.
  - Digital Twin chat still renders correctly.

Do not proceed until the page is visually correct and the resume link works.

---

## Step 6: Add Monthly LinkedIn Refresh Automation

### Implementation

LinkedIn scraping is often unreliable because LinkedIn can block public scraping, require login, or return incomplete content. The automation should be best-effort and should not break deploys if LinkedIn is unavailable.

Recommended approach:

- Add a GitHub Actions workflow that runs monthly.
- The job attempts to fetch the public LinkedIn profile URL.
- If useful content is retrieved:
  - Save it to `data/rag/linkedin.txt`.
  - Run `npm run sync-rag`.
  - Open a pull request with any changes.
- If LinkedIn blocks the request:
  - Leave the current LinkedIn source unchanged.
  - Log a clear message.
  - Exit successfully.

Possible workflow file:

- `.github/workflows/monthly-linkedin-refresh.yml`

### Verification Before Proceeding

- Run the LinkedIn refresh script locally if one is added.
- Confirm it does not require credentials for the public fetch path.
- Confirm failure to fetch LinkedIn does not fail the job.
- Confirm a changed LinkedIn source regenerates `data/rag/sources.js`.
- Confirm the GitHub Actions workflow syntax is valid.

Do not proceed until the workflow is safe to run unattended.

---

## Step 7: Update Documentation

### Implementation

Update `tutorial.md` or add a shorter `data/rag/README.md` explaining the new workflow.

Documentation should include:

- Where to put a new resume.
- How RAG source generation works.
- How to test locally.
- How Vercel build automation works.
- What to expect from monthly LinkedIn refresh.

Suggested ongoing workflow:

```text
1. Replace data/rag/resume.pdf.
2. Optionally run npm run sync-rag locally.
3. Commit and push.
4. Vercel runs npm run build.
5. prebuild runs npm run sync-rag.
6. Chatbot uses updated generated RAG sources after deploy.
```

### Verification Before Proceeding

- Read the updated docs from the perspective of future you.
- Confirm the workflow is understandable without needing to inspect implementation code.
- Confirm commands and paths match the actual repo.

Do not proceed until docs match the implemented workflow.

---

## Step 8: Final Validation

### Implementation

Run final checks across the whole app.

### Verification

Run:

```bash
npm run sync-rag
npm test
npm run lint
npm run build
```

Then manually verify:

- The website loads.
- The resume download link works.
- The Digital Twin chat opens.
- Chatbot answers resume questions accurately.
- Chatbot answers research-interest questions accurately.
- Chatbot keeps LinkedIn as a source.
- Generated RAG source content is up to date.

Only consider the implementation complete after all checks pass.

---

## Future Upgrade: Live Resume Uploads

The automated build-time workflow is the best fit for this repo right now.

A true live upload system would require:

- Authentication
- File upload UI
- Storage, such as S3 or Vercel Blob
- Persistent vector storage
- Cache invalidation
- Admin-only controls

That can be added later if the website becomes more than a static portfolio plus server-backed chatbot.
