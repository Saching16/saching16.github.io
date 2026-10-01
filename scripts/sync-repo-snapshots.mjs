import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { REPO_SOURCES } from "../data/repos/config.js";
import {
  assembleSnapshot,
  assertNoSecrets,
  attributionForEmails,
  branchChanges,
  diffFromMain,
  filterTreeEntries,
  isSecretFilename,
  parseCommitLog,
  findSecret,
  parseLsTree,
  parseNumstat,
  redactSecrets,
  selectBranches,
  splitUnifiedDiff,
  stripNotebook,
} from "./lib/repoSnapshot.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const reposDir = path.join(repoRoot, "data", "repos");
const manifestPath = path.join(reposDir, "manifest.json");
const COMMIT_FORMAT = "%x1e%H%x1f%cI%x1f%an%x1f%ae%x1f%s%x1f%b";

async function runGit(args, cwd) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout;
}

async function readBlob(cloneDir, blobId) {
  const { stdout } = await execFileAsync(
    "git",
    ["-C", cloneDir, "cat-file", "blob", blobId],
    {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    },
  );

  if (stdout.includes(0)) {
    return null;
  }

  return stdout.toString("utf8");
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function fileAuthors(cloneDir, branch, filePath) {
  const raw = await runGit(
    ["log", branch, "--format=%ae", "--", filePath],
    cloneDir,
  );
  return raw
    .split("\n")
    .map((email) => email.trim())
    .filter(Boolean);
}

async function commitLog(cloneDir, source, branch) {
  const range =
    branch === source.defaultBranch
      ? ["-n", "10", branch]
      : ["-n", "30", `${source.defaultBranch}..${branch}`];
  const raw = await runGit(
    ["log", ...range, `--format=${COMMIT_FORMAT}`],
    cloneDir,
  );
  return parseCommitLog(raw);
}

async function aheadBehind(cloneDir, source, branch) {
  if (branch === source.defaultBranch) {
    return { ahead: 0, behind: 0 };
  }

  const raw = await runGit(
    [
      "rev-list",
      "--left-right",
      "--count",
      `${source.defaultBranch}...${branch}`,
    ],
    cloneDir,
  );
  const [behind, ahead] = raw.trim().split(/\s+/).map(Number);
  return { ahead, behind };
}

async function snapshotBranch(cloneDir, source, branch, commit) {
  const committedAt = (
    await runGit(["log", "-1", "--format=%cI", branch], cloneDir)
  ).trim();
  const { ahead, behind } = await aheadBehind(cloneDir, source, branch);
  const listing = parseLsTree(
    await runGit(["ls-tree", "-r", "-l", branch], cloneDir),
  );
  for (const entry of listing) {
    if (isSecretFilename(entry.path)) {
      console.warn(
        `Skipping secret-like file ${branch}:${entry.path}. It is not copied into the snapshot.`,
      );
    }
  }
  const tree = filterTreeEntries(listing, source);
  const files = [];
  const blobEntries = {};
  const secretEntries = [];

  for (const entry of tree) {
    const raw = await readBlob(cloneDir, entry.blobId);
    if (raw === null) {
      console.warn(`Skipping binary file ${branch}:${entry.path}`);
      continue;
    }

    const stripped = entry.path.endsWith(".ipynb") ? stripNotebook(raw) : raw;
    const redacted = redactSecrets(stripped);
    if (redacted.labels.length > 0) {
      console.warn(
        `Redacted ${redacted.labels.join(", ")} in ${branch}:${entry.path}.`,
      );
    }
    const content = redacted.content;
    if (Buffer.byteLength(content) > source.maxFileBytes) {
      continue;
    }

    const emails = await fileAuthors(cloneDir, branch, entry.path);
    files.push({
      path: entry.path,
      blobId: entry.blobId,
      attribution: attributionForEmails(emails, source.authorEmails),
      size: Buffer.byteLength(content),
    });
    blobEntries[entry.blobId] = content;
    secretEntries.push({ branch, path: entry.path, content });
  }

  let diff = [];
  if (branch !== source.defaultBranch) {
    const numstat = parseNumstat(
      await runGit(
        ["diff", "--numstat", `${source.defaultBranch}...${branch}`],
        cloneDir,
      ),
    );
    const unified = splitUnifiedDiff(
      await runGit(
        ["diff", "--unified=3", `${source.defaultBranch}...${branch}`],
        cloneDir,
      ),
    );
    diff = diffFromMain(numstat, unified, source);
  }

  return {
    record: {
      commit,
      committedAt,
      ahead,
      behind,
      files,
      commits: await commitLog(cloneDir, source, branch),
      diffFromMain: diff,
    },
    blobEntries,
    secretEntries,
  };
}

async function syncSource(source, manifest) {
  const cloneDir = await mkdtemp(path.join(tmpdir(), "repo-snapshot-"));

  try {
    await runGit([
      "clone",
      "--filter=blob:none",
      "--bare",
      `https://github.com/${source.owner}/${source.name}.git`,
      cloneDir,
    ]);

    const heads = (
      await runGit(
        [
          "for-each-ref",
          "refs/heads",
          "--format=%(refname:short)%09%(objectname)",
        ],
        cloneDir,
      )
    )
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, commit] = line.split("\t");
        return { name, commit };
      });
    const kept = new Set(
      selectBranches(
        heads.map((head) => head.name),
        source,
      ),
    );
    const live = Object.fromEntries(
      heads
        .filter((head) => kept.has(head.name))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((head) => [head.name, head.commit]),
    );
    const saved = manifest[source.slug]?.branches || {};
    const changes = branchChanges(saved, live);

    if (changes.unchanged) {
      console.log(`${source.slug}: unchanged`);
      return manifest;
    }

    const branchRecords = {};
    const blobEntries = {};
    const secretEntries = [];
    for (const [branch, commit] of Object.entries(live)) {
      const snapshot = await snapshotBranch(cloneDir, source, branch, commit);
      branchRecords[branch] = snapshot.record;
      Object.assign(blobEntries, snapshot.blobEntries);
      secretEntries.push(...snapshot.secretEntries);
    }

    assertNoSecrets(
      secretEntries.filter((entry) => findSecret(entry.path, entry.content)),
    );

    const snapshot = assembleSnapshot({
      source,
      fetchedAt: new Date().toISOString(),
      branchRecords,
      blobEntries,
    });
    const snapshotDir = path.join(reposDir, source.slug);
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(
      path.join(snapshotDir, "snapshot.json"),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );

    const nextManifest = {
      ...manifest,
      [source.slug]: { branches: live },
    };
    const fileCount = Object.values(snapshot.branches).reduce(
      (total, branch) => total + branch.files.length,
      0,
    );
    console.log(
      `${source.slug}: wrote ${Object.keys(snapshot.branches).length} branches, ${fileCount} files, ${Object.keys(snapshot.blobs).length} blobs`,
    );
    return nextManifest;
  } finally {
    await rm(cloneDir, { recursive: true, force: true });
  }
}

async function main() {
  let manifest = await readManifest();
  for (const source of REPO_SOURCES) {
    manifest = await syncSource(source, manifest);
  }

  await mkdir(reposDir, { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
