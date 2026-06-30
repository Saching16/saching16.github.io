# Code Review: personal-website

**Date:** 2026-03-20
**Scope:** All application source files
**Linter status:** No errors

---

## 1. Executive Summary

This is a Next.js portfolio site with a server-side RAG-powered "Digital Twin" chat feature. The codebase is small (~10 source files), well-structured, and deploys cleanly to Vercel. The review below covers security, correctness, performance, maintainability, accessibility, and infrastructure, with severity-rated findings and concrete remedial actions.

### Severity Key

| Level | Meaning |
|-------|---------|
| **Critical** | Must fix before further production use |
| **High** | Should fix soon; impacts reliability or security |
| **Medium** | Recommended improvement; impacts maintainability or UX |
| **Low** | Nice-to-have polish |

---

## 2. Security

### 2.1 API key committed to git history (Critical)

`OPENAI_API_KEY` appears in `.env` which is gitignored, but the key value was visible in earlier conversation context. If the key was ever committed to git history (even briefly), it remains extractable.

**Remedial action:** Rotate the OpenAI API key immediately. Verify with `git log -p --all -S 'sk-proj'` that no commit contains the key. If it does, consider the key compromised and rotate it in both OpenAI dashboard and Vercel environment variables.

### 2.2 No rate limiting on the Digital Twin endpoint (High)

`/api/digital-twin` accepts unlimited POST requests. A malicious actor could exhaust your OpenAI credits by sending thousands of requests.

**Remedial action:** Add rate limiting. Options include:
- Vercel's built-in [WAF / rate limiting](https://vercel.com/docs/security) on the Pro plan.
- A lightweight in-memory rate limiter (e.g., `lru-cache` with IP-based keys) in the route handler.
- Upstream protection via Cloudflare or similar.

### 2.3 No input length validation (Medium)

The API route checks for empty messages but does not cap message length. A user could send an extremely long string, inflating token usage and cost.

**Remedial action:** Add a maximum character limit (e.g., 1000 characters) in both the frontend textarea (`maxLength`) and the API route validation.

### 2.4 No CORS restriction (Low)

The API route is callable from any origin. For a personal site this is low risk, but worth noting.

**Remedial action:** Consider adding origin checks if the endpoint is ever extended to handle sensitive operations.

---

## 3. Correctness

### 3.1 Chat history sent to API excludes the current user message (Medium)

In `app/page.js` line 144, history is built from `messages.slice(1)`, which is the state *before* the new user message is appended. This means the API receives prior conversation turns but not the current question as part of history. The question is sent separately in the `message` field, so the behavior is technically correct, but the naming is misleading and could cause bugs if refactored.

```js
const history = messages
  .slice(1)  // skips INITIAL_TWIN_MESSAGE, but uses stale `messages`
  .map((entry) => ({ role: entry.role, content: entry.content }));
```

**Remedial action:** Use `nextMessages.slice(1)` instead of `messages.slice(1)` so history includes the current user message, then adjust the backend to not double-count the latest user turn. Alternatively, add a code comment explaining the intentional exclusion.

### 3.2 `cachedIndexPromise` is module-scoped and never invalidated (Medium)

In `lib/digitalTwinRag.js`, the embedding index is built once and cached in a module-level variable. In Vercel serverless, each cold start rebuilds the index (calling OpenAI embeddings API), but within a warm instance the cache persists indefinitely. If `data/rag/sources.js` is updated, a redeployment is required to pick up changes.

**Remedial action:** This is acceptable for now since source data changes require redeployment anyway. Document this behavior. For future dynamic sources, add a cache invalidation mechanism.

### 3.3 Chunking splits mid-word (Low)

`chunkText` slices at a fixed character offset without attempting to break on word or sentence boundaries. This can produce chunks that start or end mid-word, slightly degrading retrieval quality.

**Remedial action:** Adjust the chunking logic to find the nearest whitespace or sentence boundary near the target split point.

### 3.4 Stale `index.html` still in project root (Low)

The original static HTML file remains at the project root. It is not served by Next.js but adds confusion.

**Remedial action:** Delete `index.html` from the repository.

---

## 4. Performance

### 4.1 Scroll handler fires on every pixel (Medium)

The `updateScrollProgress` function runs on every scroll event. While `{ passive: true }` avoids blocking, the handler triggers a React state update and re-render on each frame.

**Remedial action:** Throttle the scroll handler using `requestAnimationFrame` so React only re-renders once per animation frame:

```js
useEffect(() => {
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateScrollProgress();
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);
```

### 4.2 OpenAI client is re-instantiated on every request (Low)

`getClient()` creates a new `OpenAI` instance each time it is called. Within `answerCareerQuestion`, it is called once, but `buildIndex` also calls it.

**Remedial action:** Cache the client instance at module scope (similar to `cachedIndexPromise`) so it is created once per serverless invocation.

### 4.3 No image optimization (Low)

The profile photo is imported as a static asset via `import profilePhoto from "../assets/profile.png"` and rendered with a plain `<img>` tag. Next.js has a built-in `<Image>` component that handles lazy loading, responsive sizing, and format conversion.

**Remedial action:** Replace the `<img>` tag with `next/image` for automatic optimization.

---

## 5. Maintainability

### 5.1 `app/page.js` is a 394-line monolith (High)

The entire portfolio UI, scroll logic, chat state management, and API interaction live in a single file. This makes the file harder to navigate and modify.

**Remedial action:** Extract into smaller components:
- `components/Header.js`
- `components/Hero.js`
- `components/DigitalTwinChat.js`
- A custom hook like `useScrollProgress.js` for the scroll logic.

### 5.2 Content data is hardcoded in the page component (Medium)

The `readingArchive` and `projects` arrays are defined inline in `app/page.js`. If you want to add or edit content, you must modify the React component file.

**Remedial action:** Move content data to dedicated files (e.g., `data/reading.js`, `data/projects.js`) and import them.

### 5.3 Dependency versions use `"latest"` (Medium)

`package.json` pins `next`, `react`, and `react-dom` to `"latest"`. This means a fresh `npm install` could pull a breaking major version at any time.

```json
"next": "latest",
"react": "latest",
"react-dom": "latest"
```

**Remedial action:** Pin dependencies to specific versions or semver ranges (e.g., `"next": "^16.2.2"`). Run `npm outdated` periodically to upgrade deliberately.

### 5.4 No tests exist (Medium)

There are no unit or integration tests for any part of the application, including the RAG pipeline and API route.

**Remedial action:** Add at minimum:
- A unit test for `chunkText` and `cosineSimilarity` in `lib/digitalTwinRag.js`.
- An integration test for the `/api/digital-twin` route (mocking the OpenAI client).

### 5.5 No linting or formatting configuration (Low)

There is no `.eslintrc`, `prettier` config, or similar. Code style is currently consistent but relies on manual discipline.

**Remedial action:** Add ESLint (Next.js ships a default config via `next lint`) and Prettier for automatic formatting.

---

## 6. Accessibility

### 6.1 Navigation lacks mobile toggle (High)

The nav bar uses `flex-wrap` to handle overflow, but on very small screens the links may become cramped or hard to tap. There is no hamburger menu or other mobile navigation pattern.

**Remedial action:** Add a collapsible mobile menu triggered by a button with `aria-expanded` and `aria-controls` attributes.

### 6.2 Chat log does not auto-scroll to latest message (Medium)

When a new message is added to the chat, the `.chat-log` container does not scroll to the bottom. Users must manually scroll to see the latest response.

**Remedial action:** Add a `useEffect` that scrolls the chat container to the bottom whenever `messages` changes, using a ref on the container element.

### 6.3 No skip-to-content link (Low)

Screen reader users must tab through all navigation links before reaching main content.

**Remedial action:** Add a visually-hidden "Skip to main content" link as the first focusable element in the page.

### 6.4 Form textarea lacks a visible label (Low)

The Digital Twin textarea uses a `placeholder` but has no associated `<label>` element. Placeholder text disappears on focus and is not announced by all screen readers.

**Remedial action:** Add a visually-hidden `<label htmlFor="twin-question">` linked to the textarea via an `id`.

---

## 7. Infrastructure and Deployment

### 7.1 Old GitHub Pages workflow was deleted but `.github/` directory remains (Low)

The `.github/workflows/deploy.yml` file was removed, but the empty `.github/` directory structure may still exist in the repository.

**Remedial action:** Remove the empty `.github/` directory if no other workflows are planned.

### 7.2 No custom domain configured (Low)

The site is served from a Vercel-generated subdomain (`personal-website-ten-delta-96.vercel.app`). For a professional portfolio, a custom domain is expected.

**Remedial action:** Add a custom domain in Vercel project settings (e.g., `sachinganpule.com` or similar).

### 7.3 No environment variable validation at startup (Low)

If `OPENAI_API_KEY` is missing, the error surfaces only when a user submits a chat message. There is no build-time or startup check.

**Remedial action:** Add a startup validation in the API route or a Next.js instrumentation hook that logs a clear warning if required environment variables are absent.

---

## 8. CSS Review

### 8.1 Two `!important` declarations in `.chat-sources` (Low)

```css
.chat-sources {
  margin-top: 0.5rem !important;
  color: rgba(178, 201, 235, 0.9) !important;
}
```

These override the global `p` styles. Using `!important` is a code smell that usually indicates a specificity conflict.

**Remedial action:** Increase selector specificity (e.g., `.chat-message .chat-sources`) instead of using `!important`.

### 8.2 Magic numbers in color values (Low)

The stylesheet uses many raw `rgba(...)` values with no design tokens or CSS custom properties. This makes it difficult to adjust the color palette consistently.

**Remedial action:** Define a set of CSS custom properties (e.g., `--border-subtle`, `--text-muted`, `--surface-card`) in `:root` and reference them throughout the stylesheet.

---

## 9. Summary of Remedial Actions by Priority

| Priority | Count | Key Items |
|----------|-------|-----------|
| **Critical** | 1 | Rotate API key if ever committed |
| **High** | 3 | Rate limiting, component decomposition, mobile nav |
| **Medium** | 8 | Input length cap, chat history logic, scroll throttle, pin deps, add tests, auto-scroll chat, content data extraction, cache invalidation docs |
| **Low** | 9 | CORS, chunking boundaries, stale index.html, client caching, image optimization, linting config, skip link, textarea label, CSS cleanup |

---

## 10. Positive Observations

- Clean separation between API route and RAG library.
- Proper use of React hooks (`useState`, `useEffect`, `useMemo`) with correct dependency arrays.
- Accessible `aria-live="polite"` on the chat log for screen reader announcements.
- Good error handling in both frontend (catch + user-facing message) and backend (try/catch + JSON error response).
- Consistent code style throughout without a formatter enforcing it.
- Effective use of CSS `clamp()` for fluid typography.
- Responsive breakpoints at 900px and 640px handle the major layout shifts well.
- The scroll-reactive background is implemented efficiently with `useMemo` to avoid redundant gradient string computation.
