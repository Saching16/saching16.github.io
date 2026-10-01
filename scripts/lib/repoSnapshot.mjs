import {
  isBranchExcluded,
  isRepoFileIncluded,
} from "../../data/repos/config.js";

const SECRET_CONTENT = [
  ["OpenAI-style key", /sk-[A-Za-z0-9]{20,}/g],
  ["GitHub token", /ghp_[A-Za-z0-9]{20,}/g],
  ["AWS access key", /AKIA[0-9A-Z]{16}/g],
  ["Tavily key", /tvly-[A-Za-z0-9_-]{16,}/g],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
];

export function selectBranches(branchNames, source) {
  const kept = branchNames
    .filter((branch) => !isBranchExcluded(branch, source.excludeBranches))
    .sort((left, right) => left.localeCompare(right));

  if (kept.length > source.maxBranches) {
    throw new Error(
      `${source.owner}/${source.name} has ${kept.length} branches after exclusions, above the limit of ${source.maxBranches}. Add patterns to excludeBranches.`,
    );
  }

  return kept;
}

export function branchChanges(saved, live) {
  const savedBranches = saved || {};
  const added = Object.keys(live)
    .filter((name) => !(name in savedBranches))
    .sort();
  const removed = Object.keys(savedBranches)
    .filter((name) => !(name in live))
    .sort();
  const updated = Object.keys(live)
    .filter(
      (name) => name in savedBranches && savedBranches[name] !== live[name],
    )
    .sort();

  return {
    added,
    removed,
    updated,
    unchanged:
      added.length === 0 && removed.length === 0 && updated.length === 0,
  };
}

export function attributionForEmails(emails, authorEmails) {
  const authors = new Set(authorEmails.map((email) => email.toLowerCase()));
  const seen = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ];

  if (seen.length === 0) {
    throw new Error("Cannot attribute a file with no commits.");
  }

  const own = seen.filter((email) => authors.has(email));
  if (own.length === 0) {
    return "upstream";
  }
  if (own.length === seen.length) {
    return "sachin";
  }
  return "mixed";
}

export function stripNotebook(raw) {
  const notebook = JSON.parse(raw);
  const cells = (notebook.cells || []).map((cell) => ({
    cell_type: cell.cell_type,
    source: cell.source,
  }));

  return JSON.stringify(
    {
      nbformat: notebook.nbformat,
      cells,
    },
    null,
    2,
  );
}

export function isSecretFilename(filePath) {
  const base = filePath.split("/").pop();
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base.endsWith(".pem") ||
    /key/i.test(base)
  );
}

export function findSecret(filePath, content) {
  if (isSecretFilename(filePath)) {
    return `secret-like filename ${filePath}`;
  }

  for (const [label, pattern] of SECRET_CONTENT) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return `${label} in ${filePath}`;
    }
  }

  return null;
}

export function redactSecrets(content) {
  const labels = [];
  let redacted = content;

  for (const [label, pattern] of SECRET_CONTENT) {
    pattern.lastIndex = 0;
    if (!pattern.test(redacted)) {
      continue;
    }
    labels.push(label);
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[redacted]");
  }

  return { content: redacted, labels };
}

export function assertNoSecrets(entries) {
  for (const entry of entries) {
    const finding = findSecret(entry.path, entry.content);
    if (finding) {
      throw new Error(
        `Refusing to snapshot ${entry.branch}: ${finding}. Remove it from the research repo before syncing.`,
      );
    }
  }
}

export function capDiff(diff, maxLines = 400) {
  const lines = String(diff).split("\n");
  if (lines.length <= maxLines) {
    return diff;
  }

  return `${lines.slice(0, maxLines).join("\n")}\n... diff truncated ...\n`;
}

export function parseCommitLog(raw) {
  return String(raw)
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, date, author, email, subject, ...body] = record.split("\x1f");
      return {
        sha,
        date,
        author,
        email,
        subject,
        body: body.join("\x1f").trim(),
      };
    });
}

export function parseNumstat(raw) {
  return String(raw)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [additions, deletions, path] = line.split("\t");
      return {
        path,
        additions: additions === "-" ? null : Number(additions),
        deletions: deletions === "-" ? null : Number(deletions),
      };
    });
}

export function parseLsTree(raw) {
  return String(raw)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      const meta = line.slice(0, tab);
      const path = line.slice(tab + 1);
      const [mode, type, blobId, size] = meta.split(/\s+/);
      return {
        mode,
        type,
        blobId,
        size: Number(size),
        path,
      };
    })
    .filter((entry) => entry.type === "blob");
}

export function filterTreeEntries(entries, source) {
  return entries.filter(
    (entry) =>
      isRepoFileIncluded(entry.path, source) &&
      (entry.path.endsWith(".ipynb") || entry.size <= source.maxFileBytes),
  );
}

export function splitUnifiedDiff(diffText) {
  const parts = String(diffText).split(/^diff --git /m);
  const diffs = [];

  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }

    const newline = part.indexOf("\n");
    const header = newline === -1 ? part : part.slice(0, newline);
    const match = header.match(/^a\/(.+) b\/(.+)$/);
    diffs.push({
      path: match ? match[2] : null,
      diff: capDiff(`diff --git ${part}`),
    });
  }

  return diffs;
}

export function diffFromMain(numstat, unifiedDiffs, source) {
  const diffByPath = new Map(
    unifiedDiffs
      .filter((entry) => entry.path)
      .map((entry) => [entry.path, entry.diff]),
  );

  return numstat
    .filter((entry) => entry.path && isRepoFileIncluded(entry.path, source))
    .map((entry) => ({
      path: entry.path,
      additions: entry.additions,
      deletions: entry.deletions,
      diff: diffByPath.get(entry.path) || "",
    }));
}

export function assembleSnapshot({
  source,
  fetchedAt,
  branchRecords,
  blobEntries,
}) {
  const branches = {};
  for (const name of Object.keys(branchRecords).sort()) {
    const record = branchRecords[name];
    branches[name] = {
      commit: record.commit,
      committedAt: record.committedAt,
      ahead: record.ahead,
      behind: record.behind,
      files: [...record.files].sort((left, right) =>
        left.path.localeCompare(right.path),
      ),
      commits: record.commits,
      diffFromMain: record.diffFromMain,
    };
  }

  const blobs = {};
  for (const blobId of Object.keys(blobEntries).sort()) {
    blobs[blobId] = blobEntries[blobId];
  }

  return {
    generatedBy: "scripts/sync-repo-snapshots.mjs",
    slug: source.slug,
    repo: `${source.owner}/${source.name}`,
    defaultBranch: source.defaultBranch,
    upstream: source.upstream,
    fetchedAt,
    branches,
    blobs,
  };
}
