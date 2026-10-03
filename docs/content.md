# Editing Site Content

Most content is either in a small data file or inline in a component. After editing, check the result with `npm run dev`.

| Content                                   | File                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| Page title and meta description           | `app/layout.js` (`metadata`)                             |
| Navigation links                          | `components/SiteHeader.js` (`NAV_ITEMS`)                 |
| Portrait, name, intro, quote, CTA buttons | `components/HeroSection.js`                              |
| Portrait image                            | `assets/profile.png`                                     |
| Status bar                                | `app/page.js`, section with class `status-bar`           |
| Core skills chips and interests list      | `app/page.js`, section `#inquiry`                        |
| Reading archive                           | `data/readingArchive.js`                                 |
| Featured projects                         | `data/projects.js`                                       |
| Chat panel intro and greeting             | `components/DigitalTwinChat.js` (`INITIAL_TWIN_MESSAGE`) |
| Footer name and email                     | `app/page.js`, `<footer>`                                |
| Downloadable resume                       | `public/resume.pdf`                                      |
| Colors, spacing, and typography           | `app/globals.css` (CSS variables in `:root`)             |

The contact email `sachin.s.ganpule@gmail.com` appears in three places: `SiteHeader.js`, `HeroSection.js`, and the footer in `app/page.js`. Update all three if it changes.

## Reading archive entries

```js
{
  date: "2023 / NeurIPS",
  title: "Reflexion: Language Agents with Iterative Self-Reflection",
  description: "One or two sentences on why it matters.",
  status: "In practice",
}
```

`title` is used as the React key, so titles must be unique.

## Project entries

```js
{
  title: "Hybrid RAG Pipeline",
  description: "One or two sentences on what was built and the outcome.",
  tags: ["RAG", "Azure AI Search"],
  repo: "owner/repository",
}
```

`title` must be unique, and each `tags` entry must be unique within its project. `repo` is optional. When present, it must be `owner/name` and match an entry in `data/repos/config.mjs`.

## Resume

The resume appears in two places that should always match:

- `public/resume.pdf`, served at `/resume.pdf` for the Resume nav link and the Download resume button.
- `data/rag/resume.pdf`, the chatbot's source.

The weekly Drive sync updates both. To update by hand, copy the new PDF to both paths.

## Chatbot knowledge

The page content above is not visible to the chatbot. It answers only from the resume, the LinkedIn export, and `data/rag/research-interests.md`. To change what it knows, follow [data/rag/README.md](../data/rag/README.md). For example, if you add a project to `data/projects.js` and want the chatbot to discuss it, also describe it in `research-interests.md` or the resume.
