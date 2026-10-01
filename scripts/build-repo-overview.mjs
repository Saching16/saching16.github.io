import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { REPO_SOURCES } from "../data/repos/config.js";
import {
  OVERVIEW_INSTRUCTIONS,
  buildOverviewMaterials,
  overviewIsCurrent,
  stampOverview,
  stripModelFences,
  validateOverview,
} from "./lib/repoOverview.mjs";
import { findSecret } from "./lib/repoSnapshot.mjs";

const OVERVIEW_MODEL = "gpt-4.1";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function draftOverview(client, snapshot) {
  const materials = buildOverviewMaterials(snapshot);
  for (const redaction of materials.redactions) {
    console.warn(
      `Redacted ${redaction.labels.join(", ")} while preparing ${redaction.label}.`,
    );
  }

  let feedback = "";
  let lastErrors = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const completion = await client.chat.completions.create({
      model: OVERVIEW_MODEL,
      temperature: 0,
      max_tokens: 3000,
      messages: [
        { role: "system", content: OVERVIEW_INSTRUCTIONS },
        { role: "user", content: `${materials.text}${feedback}` },
      ],
    });
    const body = stripModelFences(
      completion.choices[0]?.message?.content || "",
    );
    const finding = findSecret("overview.md", body);
    if (finding) {
      throw new Error(`Refusing to write overview: ${finding}`);
    }

    lastErrors = validateOverview(body, snapshot);
    if (lastErrors.length === 0) {
      return stampOverview(body, snapshot);
    }

    feedback = `\n\nYour previous draft failed these checks:\n${lastErrors
      .map((error) => `- ${error}`)
      .join("\n")}\nRewrite the full overview with the six required headings.`;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 65000));
    }
  }

  throw new Error(
    `Overview failed checks:\n${lastErrors.map((error) => `- ${error}`).join("\n")}`,
  );
}

async function buildSource(source, client) {
  const snapshotPath = path.join(
    repoRoot,
    "data",
    "repos",
    source.slug,
    "snapshot.json",
  );
  if (!existsSync(snapshotPath)) {
    throw new Error(
      `${source.slug}: missing snapshot. Run npm run sync-repos first.`,
    );
  }

  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const overviewPath = path.join(path.dirname(snapshotPath), "overview.md");
  const existing = existsSync(overviewPath)
    ? await readFile(overviewPath, "utf8")
    : "";

  if (existing && overviewIsCurrent(existing, snapshot)) {
    console.log(`${source.slug}: unchanged`);
    return;
  }

  if (!client) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add it to .env before building a repo overview.",
    );
  }

  const overview = await draftOverview(client, snapshot);
  await writeFile(overviewPath, overview, "utf8");
  console.log(`${source.slug}: wrote overview.md`);
}

async function main() {
  const client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  for (const source of REPO_SOURCES) {
    await buildSource(source, client);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
