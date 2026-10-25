import { DRIVE_SOURCES } from "./driveSources.mjs";
import { formatRepoChanges } from "./repoChanges.mjs";

const MIN_SOURCE_LENGTH = 500;
const MAX_SHRINK_RATIO = 0.4;
const MAX_PROMPT_CHARS = 15000;
const SUMMARY_MODEL = "gpt-4o-mini";

export function parseSourcesFile(fileText) {
  if (!fileText) {
    return [];
  }
  const start = fileText.indexOf("[");
  const end = fileText.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Could not find RAG_SOURCES array in sources file.");
  }
  return JSON.parse(fileText.slice(start, end + 1));
}

export function diffSources(beforeSources, afterSources) {
  const before = new Map(
    beforeSources.map((source) => [source.label, source.content]),
  );
  const after = new Map(
    afterSources.map((source) => [source.label, source.content]),
  );
  const labels = [...new Set([...before.keys(), ...after.keys()])];

  return labels
    .filter((label) => (before.get(label) || "") !== (after.get(label) || ""))
    .map((label) => ({
      label,
      before: before.get(label) || "",
      after: after.get(label) || "",
    }));
}

export function describeDriveChanges(beforeManifest, afterManifest) {
  return DRIVE_SOURCES.filter(
    (source) =>
      afterManifest[source.key] &&
      JSON.stringify(afterManifest[source.key]) !==
        JSON.stringify(beforeManifest[source.key]),
  ).map((source) => ({ label: source.label, ...afterManifest[source.key] }));
}

export function sanityWarnings(changes) {
  const warnings = [];
  for (const { label, before, after } of changes) {
    if (!after) {
      warnings.push(`${label} is no longer present in the generated sources.`);
      continue;
    }
    if (after.length < MIN_SOURCE_LENGTH) {
      warnings.push(
        `${label} text is only ${after.length} characters. The PDF may be scanned or exported incorrectly.`,
      );
    }
    if (before && after.length < before.length * (1 - MAX_SHRINK_RATIO)) {
      const shrinkPercent = Math.round(
        (1 - after.length / before.length) * 100,
      );
      warnings.push(
        `${label} text shrank by ${shrinkPercent}% (${before.length} to ${after.length} characters). Check that the right file was uploaded.`,
      );
    }
  }
  return warnings;
}

export async function summarizeChange(client, { label, before, after }) {
  const completion = await client.chat.completions.create({
    model: SUMMARY_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You compare two versions of a document about Sachin Ganpule that feeds his personal website's chatbot. List the factual changes (roles, dates, skills, projects, education, certifications, contact details) as short Markdown bullets, at most 8. Ignore whitespace, ordering, and formatting differences. If there are no meaningful changes, reply with exactly: - No meaningful content changes.",
      },
      {
        role: "user",
        content: `Source: ${label}\n\n<before>\n${before.slice(0, MAX_PROMPT_CHARS) || "(empty)"}\n</before>\n\n<after>\n${after.slice(0, MAX_PROMPT_CHARS) || "(empty)"}\n</after>`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

function formatLength(text) {
  return text.length.toLocaleString("en-US");
}

export function buildPrBody({
  driveChanges,
  sourceChanges,
  summaries,
  aiNote,
  warnings,
  repoChanges = [],
}) {
  const lines = [
    "## Summary",
    "",
    "Automated refresh of the Digital Twin chatbot's sources from Google Drive and the research repos listed in `data/repos/config.mjs`.",
    "",
    "### Drive files picked up",
    "",
  ];

  if (driveChanges.length) {
    for (const file of driveChanges) {
      lines.push(
        `- **${file.label}:** "${file.name}" (modified ${file.modifiedTime})`,
      );
    }
  } else {
    lines.push("- None");
  }

  lines.push("", "### What changed", "");
  if (!sourceChanges.length) {
    lines.push("The extracted text is unchanged.");
  }
  for (const change of sourceChanges) {
    lines.push(
      `#### ${change.label}`,
      "",
      `Text length: ${formatLength(change.before)} to ${formatLength(change.after)} characters.`,
      "",
    );
    const summary = summaries.get(change.label);
    lines.push(summary || `_AI summary unavailable: ${aiNote}_`, "");
  }

  lines.push("", "### Repo changes", "", ...formatRepoChanges(repoChanges), "");
  lines.push("### Sanity checks", "");
  if (warnings.length) {
    lines.push(...warnings.map((warning) => `- **Warning:** ${warning}`));
  } else {
    lines.push("- No issues found.");
  }

  lines.push(
    "",
    "## Review",
    "",
    "Merging this pull request triggers a Vercel redeploy, and the chatbot starts answering from the new sources.",
    "",
  );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
