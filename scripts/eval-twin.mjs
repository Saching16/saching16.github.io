import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import {
  compareTotals,
  fixtureCoverageErrors,
  gradeCitations,
  gradeClaims,
  gradeMentions,
  gradeRoute,
  mapWithConcurrency,
  parseArgs,
  parseClaimJudgment,
  totalsByCategory,
} from "./lib/evalTwin.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const questionsPath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "twin-eval-questions.json",
);
const resultsDir = path.join(repoRoot, "eval-results");

function rateLimitError() {
  const error = new Error(
    "Got HTTP 429. The rate-limit bypass is not active. Start the server with `DISABLE_RATE_LIMIT=1 npm run dev`. This script does not wait out the limit.",
  );
  error.code = "RATE_LIMITED";
  return error;
}

async function loadSnapshot() {
  const reposDir = path.join(repoRoot, "data", "repos");
  let entries = [];
  try {
    entries = await readdir(reposDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const snapshotPath = path.join(reposDir, entry.name, "snapshot.json");
    try {
      return JSON.parse(await readFile(snapshotPath, "utf8"));
    } catch {
      // This repo has no snapshot yet.
    }
  }

  return null;
}

async function latestReportPath() {
  let names = [];
  try {
    names = await readdir(resultsDir);
  } catch {
    return null;
  }

  const reports = names.filter((name) => name.endsWith(".json")).sort();
  if (!reports.length) {
    return null;
  }
  return path.join(resultsDir, reports[reports.length - 1]);
}

function createClaimJudge(client) {
  return async function judgeClaim(answer, claim) {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'You judge whether an answer makes a specific claim. Reply with exactly "yes" or "no". Answer "yes" only when the answer states the claim, not when it denies or avoids it.',
        },
        {
          role: "user",
          content: `Claim: ${claim}\n\nAnswer:\n${answer}`,
        },
      ],
    });

    return {
      claim,
      claims: parseClaimJudgment(completion.choices[0]?.message?.content),
      usage: completion.usage || null,
    };
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const questions = JSON.parse(await readFile(questionsPath, "utf8"));
  const coverageErrors = fixtureCoverageErrors(questions);
  if (coverageErrors.length > 0) {
    throw new Error(
      `Eval fixture is missing required coverage: ${coverageErrors.join("; ")}`,
    );
  }

  const snapshot = await loadSnapshot();
  const apiKey = process.env.OPENAI_API_KEY;
  const judgeClaim = apiKey ? createClaimJudge(new OpenAI({ apiKey })) : null;
  const previousPath = await latestReportPath();
  const previous = previousPath
    ? JSON.parse(await readFile(previousPath, "utf8"))
    : null;

  const results = await mapWithConcurrency(
    questions,
    options.concurrency,
    async (question) => {
      const startedAt = Date.now();
      const response = await fetch(`${options.url}/api/digital-twin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question.question,
          history: question.history || [],
        }),
      });
      const latencyMs = Date.now() - startedAt;

      if (response.status === 429) {
        throw rateLimitError();
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `${question.id} failed with HTTP ${response.status}: ${payload?.error || "unknown error"}`,
        );
      }

      let claims;
      let claimUsage = null;
      if (!judgeClaim) {
        claims = {
          status: "skipped",
          reason: "OPENAI_API_KEY is not set, so claims were not graded.",
        };
      } else if (!(question.mustNotClaim || []).length) {
        claims = { status: "passed", claimed: [] };
      } else {
        const judgments = [];
        for (const claim of question.mustNotClaim) {
          const judgment = await judgeClaim(payload.answer || "", claim);
          judgments.push(judgment);
          if (judgment.usage) {
            claimUsage = judgment.usage;
          }
        }
        claims = gradeClaims(judgments);
      }

      return {
        id: question.id,
        question: question.question,
        expectedRoute: question.expectedRoute,
        tags: question.tags || [],
        answer: payload.answer || "",
        sources: payload.sources || [],
        route: payload.route || null,
        latencyMs,
        tokenUsage: payload.usage || null,
        claimTokenUsage: claimUsage,
        checks: {
          route: gradeRoute(payload.route, question.expectedRoute),
          mentions: gradeMentions(
            payload.answer || "",
            payload.sources || [],
            question.mustMention || [],
          ),
          claims,
          citations: gradeCitations(payload.sources || [], snapshot),
        },
      };
    },
  );

  const totals = totalsByCategory(results);
  const report = {
    createdAt: new Date().toISOString(),
    url: options.url,
    questionCount: results.length,
    claimsGraded: Boolean(judgeClaim),
    totals,
    comparedTo: previousPath ? path.basename(previousPath) : null,
    deltas: compareTotals(totals, previous?.totals || null),
    questions: results,
  };

  await mkdir(resultsDir, { recursive: true });
  const stamp = report.createdAt.replace(/[:.]/g, "-");
  const reportPath = path.join(resultsDir, `${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Wrote ${reportPath}`);
  console.log(JSON.stringify(totals, null, 2));
  if (!judgeClaim) {
    console.log("Claims were not graded because OPENAI_API_KEY is not set.");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
