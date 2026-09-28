import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
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
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

async function readWorking(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFile(filePath, "utf8") : "";
}

function parseJson(text) {
  return text ? JSON.parse(text) : {};
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

  const body = buildPrBody({
    driveChanges,
    sourceChanges,
    summaries,
    aiNote,
    warnings,
  });
  await writeFile(outputPath, body, "utf8");
  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
