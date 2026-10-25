import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { REPO_SOURCES, repoFullName } from "../data/repos/config.mjs";
import { describeRepoChange } from "./lib/repoChanges.mjs";
import {
  buildPrBody,
  describeDriveChanges,
  diffSources,
  parseSourcesFile,
  sanityWarnings,
  summarizeChange,
} from "./lib/ragChanges.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const SOURCES_FILE = "data/rag/sources.js";
const MANIFEST_FILE = "data/rag/drive-manifest.json";

function readCommitted(relativePath) {
  try {
    return execFileSync("git", ["show", `HEAD:${relativePath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      // Snapshots are larger than Node's default 1 MB stdout limit.
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.status === 128) {
      return "";
    }
    throw error;
  }
}

async function readWorking(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFile(filePath, "utf8") : "";
}

function parseJson(text) {
  return text ? JSON.parse(text) : {};
}

function parseSnapshot(text) {
  return text.trim() ? JSON.parse(text) : null;
}

async function collectRepoChanges() {
  const changes = [];
  for (const source of REPO_SOURCES) {
    const snapshotFile = `data/repos/${source.slug}/snapshot.json`;
    const overviewFile = `data/repos/${source.slug}/overview.md`;
    changes.push(
      describeRepoChange({
        slug: source.slug,
        repo: repoFullName(source),
        beforeSnapshot: parseSnapshot(readCommitted(snapshotFile)),
        afterSnapshot: parseSnapshot(await readWorking(snapshotFile)),
        beforeOverview: readCommitted(overviewFile),
        afterOverview: await readWorking(overviewFile),
      }),
    );
  }
  return changes;
}

async function summarizeAll(sourceChanges) {
  const summaries = new Map();
  if (!sourceChanges.length) {
    return { summaries, aiNote: "" };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { summaries, aiNote: "OPENAI_API_KEY is not set." };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let aiNote = "";
  for (const change of sourceChanges) {
    try {
      summaries.set(change.label, await summarizeChange(client, change));
    } catch (error) {
      aiNote = `OpenAI request failed (${error.message}).`;
    }
  }
  return { summaries, aiNote };
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error(
      "Usage: node scripts/summarize-rag-changes.mjs <output.md>",
    );
  }

  const sourceChanges = diffSources(
    parseSourcesFile(readCommitted(SOURCES_FILE)),
    parseSourcesFile(await readWorking(SOURCES_FILE)),
  );
  const driveChanges = describeDriveChanges(
    parseJson(readCommitted(MANIFEST_FILE)),
    parseJson(await readWorking(MANIFEST_FILE)),
  );
  const { summaries, aiNote } = await summarizeAll(sourceChanges);
  const warnings = sanityWarnings(sourceChanges);
  const repoChanges = await collectRepoChanges();

  const body = buildPrBody({
    driveChanges,
    sourceChanges,
    summaries,
    aiNote,
    warnings,
    repoChanges,
  });
  await writeFile(outputPath, body, "utf8");
  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
