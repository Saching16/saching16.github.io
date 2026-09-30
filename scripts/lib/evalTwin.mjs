const ROUTES = ["off_topic", "career", "repo_overview", "repo_deep"];
const CITATION_PATTERN = /^(?:([^:\s]+):)?(.+):L(\d+)-L(\d+)$/;

export function summarizeFixture(questions) {
  const byRoute = {};
  const counts = {
    follow_up: 0,
    attribution_trap: 0,
    borderline: 0,
    branch: 0,
  };

  for (const question of questions) {
    byRoute[question.expectedRoute] =
      (byRoute[question.expectedRoute] || 0) + 1;
    for (const tag of question.tags || []) {
      if (tag in counts) {
        counts[tag] += 1;
      }
    }
  }

  return {
    total: questions.length,
    byRoute,
    followUps: counts.follow_up,
    attributionTraps: counts.attribution_trap,
    borderline: counts.borderline,
    branchQuestions: counts.branch,
  };
}

export function fixtureCoverageErrors(questions) {
  const summary = summarizeFixture(questions);
  const errors = [];

  for (const route of ROUTES) {
    if ((summary.byRoute[route] || 0) < 5) {
      errors.push(`${route} has fewer than 5 questions`);
    }
  }
  if (summary.followUps < 5) {
    errors.push("fewer than 5 follow-up questions");
  }
  if (summary.attributionTraps < 3) {
    errors.push("fewer than 3 attribution traps");
  }
  if (summary.borderline < 2) {
    errors.push("fewer than 2 borderline questions");
  }
  if (summary.branchQuestions < 5) {
    errors.push("fewer than 5 branch questions");
  }

  return errors;
}

export function gradeRoute(actualRoute, expectedRoute) {
  if (typeof actualRoute !== "string" || actualRoute.length === 0) {
    return {
      status: "not_applicable",
      reason: "response has no route",
    };
  }

  return {
    status: actualRoute === expectedRoute ? "passed" : "failed",
    actual: actualRoute,
    expected: expectedRoute,
  };
}

export function gradeMentions(answer, sources, mustMention = []) {
  const haystack = `${answer}\n${sources.join("\n")}`.toLowerCase();
  const missing = mustMention.filter(
    (item) => !haystack.includes(item.toLowerCase()),
  );

  return {
    status: missing.length === 0 ? "passed" : "failed",
    missing,
  };
}

export function parseClaimJudgment(text) {
  const normalized = String(text || "")
    .trim()
    .toLowerCase();
  if (normalized.startsWith("yes")) {
    return true;
  }
  if (normalized.startsWith("no")) {
    return false;
  }
  return null;
}

export function gradeClaims(judgments) {
  if (!judgments.length) {
    return { status: "passed", claimed: [] };
  }

  const unparsed = judgments.filter((item) => item.claims === null);
  if (unparsed.length > 0) {
    return {
      status: "error",
      reason: "claim judge did not answer yes or no",
      claims: unparsed.map((item) => item.claim),
    };
  }

  const claimed = judgments
    .filter((item) => item.claims)
    .map((item) => item.claim);

  return {
    status: claimed.length === 0 ? "passed" : "failed",
    claimed,
  };
}

export function parseCitation(source) {
  const match = String(source).match(CITATION_PATTERN);
  if (!match) {
    return null;
  }

  return {
    branch: match[1] || null,
    path: match[2],
    startLine: Number(match[3]),
    endLine: Number(match[4]),
  };
}

export function gradeCitations(sources, snapshot) {
  if (!snapshot) {
    return {
      status: "not_applicable",
      reason: "no repo snapshot yet",
    };
  }

  const citations = sources.map(parseCitation).filter(Boolean);
  if (!citations.length) {
    return {
      status: "not_applicable",
      reason: "answer has no file citations",
    };
  }

  const missing = [];
  for (const citation of citations) {
    const branchName = citation.branch || snapshot.defaultBranch;
    const branch = snapshot.branches?.[branchName];
    const file = branch?.files?.find((entry) => entry.path === citation.path);
    const content = file ? snapshot.blobs?.[file.blobId] : null;
    const lineCount = content ? content.split("\n").length : 0;
    if (
      !file ||
      citation.startLine < 1 ||
      citation.endLine < citation.startLine ||
      citation.endLine > lineCount
    ) {
      missing.push(citation);
    }
  }

  return {
    status: missing.length === 0 ? "passed" : "failed",
    missing,
  };
}

export function gradeQuestion({ question, payload, snapshot, claimJudgments }) {
  return {
    route: gradeRoute(payload.route, question.expectedRoute),
    mentions: gradeMentions(
      payload.answer || "",
      payload.sources || [],
      question.mustMention || [],
    ),
    claims: gradeClaims(claimJudgments),
    citations: gradeCitations(payload.sources || [], snapshot),
  };
}

export function totalsByCategory(results) {
  const totals = {};
  for (const category of ["route", "mentions", "claims", "citations"]) {
    totals[category] = {};
    for (const result of results) {
      const status = result.checks[category].status;
      totals[category][status] = (totals[category][status] || 0) + 1;
    }
  }
  return totals;
}

export function compareTotals(current, previous) {
  if (!previous) {
    return null;
  }

  const deltas = {};
  for (const category of Object.keys(current)) {
    deltas[category] = {};
    const statuses = new Set([
      ...Object.keys(current[category]),
      ...Object.keys(previous[category] || {}),
    ]);
    for (const status of statuses) {
      deltas[category][status] =
        (current[category][status] || 0) - (previous[category]?.[status] || 0);
    }
  }
  return deltas;
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let rateLimitError = null;

  async function runWorker() {
    while (!rateLimitError) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        if (error?.code === "RATE_LIMITED") {
          rateLimitError = error;
          return;
        }
        throw error;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  if (rateLimitError) {
    throw rateLimitError;
  }

  return results;
}

export function parseArgs(argv) {
  const options = {
    url: "http://localhost:3000",
    concurrency: 3,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") {
      options.url = argv[index + 1];
      index += 1;
    } else if (arg === "--concurrency") {
      options.concurrency = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }

  return options;
}
