import { redactSecrets } from "./repoSnapshot.mjs";

export const OVERVIEW_SECTIONS = [
  "What RecursiveMAS is (upstream work)",
  "What Sachin's research adds",
  "Current work",
  "Branches",
  "Repo layout",
  "Key entry points",
];

export const OVERVIEW_INSTRUCTIONS = `You write a factual overview of one GitHub repository for Sachin Ganpule's website chatbot. Use only the materials in the user message. Do not invent results, authors, dates, or file paths.

Write Markdown with exactly these second-level headings, in this order, and no other second-level headings:
${OVERVIEW_SECTIONS.map((title) => `## ${title}`).join("\n")}

Rules:
- "What RecursiveMAS is (upstream work)" credits the upstream authors and the upstream repository named in the materials, and links the paper URL from the README. Do not say Sachin wrote the upstream code or the paper.
- "What Sachin's research adds" may describe only files whose attribution is sachin. Do not name upstream file paths in this section.
- "Current work" is the most recently committed branch. State its name, its last commit date as YYYY-MM-DD, and what its newest commit subjects say. Do not describe that work as merged.
- "Branches" has one short paragraph per branch. Cover its purpose, its last commit date as YYYY-MM-DD, what it adds compared with the default branch, and whether it has been merged. For every branch that is not the default branch, include the words "not merged". You may say the default branch contains an upstream merge commit. Do not say any other branch has been merged.
- "Repo layout" says what each top-level folder does, and notes folders that exist only on a branch.
- "Key entry points" names which files to read for training, inference, evaluation, and the deepagents integration, and states the branch for each. Label upstream entry points as upstream. Say a path is on all branches only when that exact path is in every branch's file tree. Do not say a path is absent from a branch when that path is in the branch file tree. If a file exists on the default branch and is also in another branch's diff, that branch revises it. A file that is missing from the default branch is new on the other branch, not an extension of a default-branch file.
- Be specific and concise. Do not paste the source documents.`;

const PLAN_PATH = /^(?:PROPOSAL\.md|PLAN\.md|experiments\/exp[^/]+\.md)$/;
const STAMP = /^<!-- overview-commits: (\{.*\}) -->\n*/;
const PYTHON_NOTE_LIMIT = 800;
const COMMIT_BODY_LIMIT = 1200;
const README_LIMIT = 12000;
const OTHER_README_LIMIT = 6000;
const PROPOSAL_LIMIT = 12000;
const PLAN_LIMIT = 10000;
const EXPERIMENT_LIMIT = 4000;
// gpt-4.1 on this OpenAI account allows 30,000 tokens per minute, and the
// requested max output counts against that. Stay under this character budget
// so one weekly call succeeds.
export const OVERVIEW_MATERIAL_CHAR_LIMIT = 110000;

export function leadingPythonNote(source) {
  const text = String(source ?? "").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  let index = 0;

  if (lines[0]?.startsWith("#!")) {
    index += 1;
  }
  while (lines[index]?.trim() === "") {
    index += 1;
  }
  if (/^#\s*(?:-\*-|coding[:=])/.test(lines[index] || "")) {
    index += 1;
    while (lines[index]?.trim() === "") {
      index += 1;
    }
  }

  const rest = lines.slice(index).join("\n");
  const docstring = rest.match(/^(?:[rRuUbBfF]{1,2})?("""|''')([\s\S]*?)\1/);
  if (docstring) {
    return docstring[2].trim();
  }

  const comments = [];
  for (let cursor = index; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() === "") {
      if (comments.length > 0) {
        break;
      }
      continue;
    }
    if (!line.trimStart().startsWith("#")) {
      break;
    }
    comments.push(line.replace(/^\s*#\s?/, ""));
  }

  return comments.join("\n").trim();
}

export function snapshotCommits(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot.branches)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, branch]) => [name, branch.commit]),
  );
}

export function recordedCommits(markdown) {
  const match = String(markdown).match(STAMP);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function overviewIsCurrent(markdown, snapshot) {
  const recorded = recordedCommits(markdown);
  if (!recorded) {
    return false;
  }

  return JSON.stringify(recorded) === JSON.stringify(snapshotCommits(snapshot));
}

export function stampOverview(body, snapshot) {
  const stamp = `<!-- overview-commits: ${JSON.stringify(snapshotCommits(snapshot))} -->`;
  return `${stamp}\n\n${String(body).trim()}\n`;
}

export function overviewBody(markdown) {
  return String(markdown).replace(STAMP, "").trim();
}

export function projectSourceLabel(source) {
  return `Project: ${source.name}`;
}

export function mostRecentBranch(snapshot) {
  const [name, branch] = Object.entries(snapshot.branches).sort(
    (left, right) =>
      Date.parse(right[1].committedAt) - Date.parse(left[1].committedAt) ||
      left[0].localeCompare(right[0]),
  )[0];

  return { name, branch };
}

export function newestCopy(snapshot, filePath) {
  let best = null;

  for (const [name, branch] of Object.entries(snapshot.branches)) {
    const file = branch.files.find((entry) => entry.path === filePath);
    if (!file) {
      continue;
    }

    const candidate = {
      branch: name,
      file,
      committedAt: branch.committedAt,
    };
    if (
      !best ||
      Date.parse(candidate.committedAt) > Date.parse(best.committedAt) ||
      (Date.parse(candidate.committedAt) === Date.parse(best.committedAt) &&
        candidate.branch.localeCompare(best.branch) > 0)
    ) {
      best = candidate;
    }
  }

  return best;
}

export function planPaths(snapshot) {
  const paths = new Set();
  for (const branch of Object.values(snapshot.branches)) {
    for (const file of branch.files) {
      if (PLAN_PATH.test(file.path)) {
        paths.add(file.path);
      }
    }
  }
  return [...paths].sort();
}

export function readmeCopies(snapshot) {
  const groups = new Map();

  for (const [name, branch] of Object.entries(snapshot.branches)) {
    const file = branch.files.find((entry) => entry.path === "README.md");
    if (!file) {
      continue;
    }

    const group = groups.get(file.blobId) || {
      blobId: file.blobId,
      branches: [],
      attribution: file.attribution,
    };
    group.branches.push(name);
    groups.set(file.blobId, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    branches: group.branches.sort(),
  }));
}

export function overviewSection(markdown, title) {
  const marker = `## ${title}`;
  const start = markdown.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const rest = markdown.slice(start + marker.length);
  const next = rest.search(/\n## /);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function sentencesOf(text) {
  const protectedText = String(text).replace(
    /\.(?=(?:md|py|ipynb|json|txt|sh|png)\b)/gi,
    "\u0000",
  );
  return protectedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .replace(/\u0000/g, ".")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function sentenceClaimsMerged(sentence) {
  return /\bmerged\b/i.test(sentence) && !/\bnot\b|n't\b/i.test(sentence);
}

export function claimsMerged(text) {
  return sentencesOf(text).some(sentenceClaimsMerged);
}

export function mergedBranchClaims(text, branchNames) {
  const hits = [];
  for (const sentence of sentencesOf(text)) {
    if (!sentenceClaimsMerged(sentence)) {
      continue;
    }
    for (const name of branchNames) {
      if (sentence.includes(name)) {
        hits.push(sentence.slice(0, 240));
      }
    }
  }
  return hits;
}

function citedPaths(section, snapshot) {
  const paths = [];
  for (const branch of Object.values(snapshot.branches)) {
    for (const file of branch.files) {
      paths.push(file.path);
    }
  }

  const unique = [...new Set(paths)].sort(
    (left, right) => right.length - left.length,
  );
  let remaining = section;
  const cited = [];
  for (const filePath of unique) {
    if (!remaining.includes(filePath)) {
      continue;
    }
    cited.push(filePath);
    remaining = remaining.split(filePath).join("");
  }
  return cited;
}

export function presenceClaimErrors(markdown, snapshot) {
  const errors = [];
  const defaultBranch = snapshot.branches[snapshot.defaultBranch];

  for (const sentence of sentencesOf(markdown)) {
    const absent = sentence.match(/not present on `?([A-Za-z0-9_/-]+)/i);
    if (absent && snapshot.branches[absent[1]]) {
      for (const filePath of citedPaths(sentence, snapshot)) {
        const exists = snapshot.branches[absent[1]].files.some(
          (file) => file.path === filePath,
        );
        if (exists) {
          errors.push(
            `${filePath} is present on ${absent[1]}; do not say it is absent`,
          );
        }
      }
    }

    if (!/\bextended\b/i.test(sentence) || !defaultBranch) {
      continue;
    }
    for (const filePath of citedPaths(sentence, snapshot)) {
      const onDefault = defaultBranch.files.some(
        (file) => file.path === filePath,
      );
      if (!onDefault) {
        errors.push(
          `${filePath} is not on ${snapshot.defaultBranch}, so it is new rather than extended`,
        );
      }
    }
  }

  return errors;
}

export function allBranchPathErrors(markdown, snapshot) {
  const names = Object.keys(snapshot.branches);
  const errors = [];

  for (const sentence of sentencesOf(markdown)) {
    if (!/all branches/i.test(sentence)) {
      continue;
    }
    for (const filePath of citedPaths(sentence, snapshot)) {
      const missing = names.filter(
        (name) =>
          !snapshot.branches[name].files.some((file) => file.path === filePath),
      );
      if (missing.length > 0) {
        errors.push(
          `${filePath} is not on ${missing.join(", ")}, so do not say it is on all branches`,
        );
      }
    }
  }

  return errors;
}

export function upstreamPathsCitedAsSachin(section, snapshot) {
  const sachinPaths = new Set();
  for (const branch of Object.values(snapshot.branches)) {
    for (const file of branch.files) {
      if (file.attribution === "sachin") {
        sachinPaths.add(file.path);
      }
    }
  }

  return citedPaths(section, snapshot).filter(
    (filePath) => !sachinPaths.has(filePath),
  );
}

export function paperUrl(snapshot) {
  const branch = snapshot.branches[snapshot.defaultBranch];
  const readme = branch?.files.find((entry) => entry.path === "README.md");
  const text = readme ? snapshot.blobs[readme.blobId] || "" : "";
  const match = text.match(/https:\/\/arxiv\.org\/abs\/\d+\.\d+/);
  return match ? match[0] : null;
}

export function validateOverview(markdown, snapshot) {
  const errors = [];
  const body = overviewBody(markdown);

  for (const title of OVERVIEW_SECTIONS) {
    if (!body.includes(`## ${title}`)) {
      errors.push(`Missing section: ${title}`);
    }
  }
  if (errors.length > 0) {
    return errors;
  }

  const recent = mostRecentBranch(snapshot);
  const current = overviewSection(body, "Current work");
  const day = recent.branch.committedAt.slice(0, 10);
  if (!current.includes(recent.name)) {
    errors.push(`Current work must name ${recent.name}`);
  }
  if (!current.includes(day)) {
    errors.push(`Current work must include the date ${day}`);
  }

  const branches = overviewSection(body, "Branches");
  const nonDefault = Object.keys(snapshot.branches).filter(
    (name) => name !== snapshot.defaultBranch,
  );
  for (const name of Object.keys(snapshot.branches)) {
    if (!branches.includes(name)) {
      errors.push(`Branches section must mention ${name}`);
    }
  }
  const notMerged =
    branches.match(/not merged|n't been merged|unmerged/gi) || [];
  if (notMerged.length < nonDefault.length) {
    errors.push(
      `Branches section must say "not merged" for each of: ${nonDefault.join(", ")}`,
    );
  }
  const wrongBranches = [
    ...allBranchPathErrors(body, snapshot),
    ...presenceClaimErrors(body, snapshot),
  ];
  if (wrongBranches.length > 0) {
    errors.push(...wrongBranches);
  }
  const mergedClaims = mergedBranchClaims(body, nonDefault);
  if (mergedClaims.length > 0) {
    errors.push(
      `These sentences describe a non-default branch as merged: ${mergedClaims.join(" | ")}`,
    );
  }

  const leaked = upstreamPathsCitedAsSachin(
    overviewSection(body, "What Sachin's research adds"),
    snapshot,
  );
  if (leaked.length > 0) {
    errors.push(
      `What Sachin's research adds cites files that are not attributed to him: ${leaked.join(", ")}`,
    );
  }

  const paper = paperUrl(snapshot);
  const upstream = overviewSection(
    body,
    "What RecursiveMAS is (upstream work)",
  );
  if (paper && !upstream.includes(paper)) {
    errors.push(`Upstream section must link ${paper}`);
  }

  return errors;
}

export function stripModelFences(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function topLevelFolders(branch) {
  const folders = new Set();
  for (const file of branch.files) {
    const slash = file.path.indexOf("/");
    folders.add(
      slash === -1 ? "(files at repo root)" : file.path.slice(0, slash),
    );
  }
  return [...folders].sort();
}

function prepareMarkdown(text) {
  return String(text || "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(text, limit) {
  const value = String(text || "").trim();
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit).trim()}\n... truncated ...`;
}

function clipWithHeadings(text, limit) {
  const cleaned = prepareMarkdown(text);
  if (cleaned.length <= limit) {
    return cleaned;
  }

  const head = cleaned.slice(0, limit);
  const cut = head.lastIndexOf("\n");
  const opening = (cut > limit * 0.6 ? head.slice(0, cut) : head).trim();
  const headings = cleaned
    .slice(opening.length)
    .split("\n")
    .map((line) => line.match(/^#{1,3} .+$/)?.[0])
    .filter(Boolean);
  if (headings.length === 0) {
    return `${opening}\n\n... truncated ...`;
  }

  return `${opening}\n\n... truncated. Later headings:\n${headings
    .map((heading) => `- ${heading}`)
    .join("\n")}`;
}

export function buildOverviewMaterials(snapshot) {
  const redactions = [];

  function include(label, text) {
    const result = redactSecrets(String(text ?? ""));
    if (result.labels.length > 0) {
      redactions.push({ label, labels: result.labels });
    }
    return result.content;
  }

  const recent = mostRecentBranch(snapshot);
  const lines = [];
  lines.push(`Repository: ${snapshot.repo}`);
  lines.push(`Upstream: ${snapshot.upstream}`);
  lines.push(`Default branch: ${snapshot.defaultBranch}`);
  lines.push(
    `Most recently committed branch: ${recent.name} on ${recent.branch.committedAt.slice(0, 10)}`,
  );
  lines.push(
    "A branch other than the default is not merged when its ahead count is greater than 0.",
  );

  lines.push("", "# Branch status");
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const merged =
      name === snapshot.defaultBranch || branch.ahead === 0
        ? "yes, this is the default branch or it has no commits of its own"
        : "no, not merged";
    lines.push(
      `- ${name}: last commit ${branch.committedAt.slice(0, 10)} (${branch.commit}), ahead ${branch.ahead}, behind ${branch.behind}, merged into ${snapshot.defaultBranch}: ${merged}`,
    );
  }

  lines.push("", "# README");
  const copies = readmeCopies(snapshot);
  const defaultReadme = copies.find((copy) =>
    copy.branches.includes(snapshot.defaultBranch),
  );
  for (const copy of copies) {
    const limit = copy === defaultReadme ? README_LIMIT : OTHER_README_LIMIT;
    lines.push(
      "",
      `## README.md on ${copy.branches.join(", ")} (attribution: ${copy.attribution})`,
      include(
        `README.md on ${copy.branches.join(", ")}`,
        clipWithHeadings(snapshot.blobs[copy.blobId], limit),
      ),
    );
  }

  lines.push("", "# Newest proposal, plan, and experiment files");
  for (const filePath of planPaths(snapshot)) {
    const copy = newestCopy(snapshot, filePath);
    lines.push(
      "",
      `## ${filePath} from ${copy.branch} (attribution: ${copy.file.attribution}, branch last commit ${copy.committedAt.slice(0, 10)})`,
      include(
        `${filePath} from ${copy.branch}`,
        clipWithHeadings(
          snapshot.blobs[copy.file.blobId],
          filePath === "PROPOSAL.md"
            ? PROPOSAL_LIMIT
            : filePath === "PLAN.md"
              ? PLAN_LIMIT
              : EXPERIMENT_LIMIT,
        ),
      ),
    );
  }

  const defaultBranch = snapshot.branches[snapshot.defaultBranch];
  lines.push("", `# File tree of ${snapshot.defaultBranch}`);
  for (const file of defaultBranch.files) {
    lines.push(`- ${file.path}`);
  }

  lines.push(
    "",
    "# Files other branches add or change compared with the default branch",
  );
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (name === snapshot.defaultBranch) {
      continue;
    }
    lines.push("", `## ${name}`);
    if (!branch.diffFromMain?.length) {
      lines.push("(no file differences)");
      continue;
    }
    for (const entry of branch.diffFromMain) {
      const additions = entry.additions ?? "?";
      const deletions = entry.deletions ?? "?";
      lines.push(`- ${entry.path} (+${additions} -${deletions})`);
    }
  }

  lines.push("", "# Top-level folders");
  const defaultFolders = new Set(topLevelFolders(defaultBranch));
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const folders = topLevelFolders(branch);
    const onlyHere = folders.filter((folder) => !defaultFolders.has(folder));
    lines.push(
      `- ${name}: ${folders.join(", ")}${
        name === snapshot.defaultBranch
          ? ""
          : `; only on this branch: ${onlyHere.join(", ") || "(none)"}`
      }`,
    );
  }

  lines.push("", "# Commit logs");
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    lines.push("", `## ${name}`);
    for (const commit of branch.commits) {
      lines.push(
        `- ${commit.date.slice(0, 10)} ${commit.author}: ${commit.subject}`,
      );
      if (commit.body) {
        lines.push(clip(commit.body, COMMIT_BODY_LIMIT));
      }
    }
  }

  lines.push("", "# Attribution");
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    lines.push("", `## ${name}`);
    const grouped = { sachin: [], mixed: [], upstream: [] };
    for (const file of branch.files) {
      (grouped[file.attribution] || grouped.upstream).push(file.path);
    }
    for (const kind of ["sachin", "mixed", "upstream"]) {
      lines.push(`${kind}:`);
      for (const filePath of grouped[kind]) {
        lines.push(`- ${filePath}`);
      }
    }
  }

  lines.push("", "# Python modules: first docstring or top comment");
  const seenBlobs = new Set();
  for (const [name, branch] of Object.entries(snapshot.branches).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    for (const file of branch.files) {
      if (!file.path.endsWith(".py") || seenBlobs.has(file.blobId)) {
        continue;
      }
      seenBlobs.add(file.blobId);
      const note = clip(
        leadingPythonNote(snapshot.blobs[file.blobId] || ""),
        PYTHON_NOTE_LIMIT,
      );
      lines.push(
        "",
        `## ${file.path} (first seen on ${name}, attribution: ${file.attribution})`,
        include(
          `${file.path} on ${name}`,
          note || "(no module docstring or leading comment)",
        ),
      );
    }
  }

  return { text: lines.join("\n"), redactions };
}
