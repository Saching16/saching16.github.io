import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compareTotals,
  fixtureCoverageErrors,
  gradeCitations,
  gradeClaims,
  gradeMentions,
  gradeQuestion,
  gradeRoute,
  mapWithConcurrency,
  parseArgs,
  parseCitation,
  parseClaimJudgment,
  summarizeFixture,
  totalsByCategory,
} from "../scripts/lib/evalTwin.mjs";

const questions = JSON.parse(
  readFileSync(
    new URL("./fixtures/twin-eval-questions.json", import.meta.url),
    "utf8",
  ),
);

describe("eval fixture", () => {
  it("covers every route, follow-ups, traps, and branch questions", () => {
    expect(fixtureCoverageErrors(questions)).toEqual([]);
    const summary = summarizeFixture(questions);
    expect(summary.total).toBeGreaterThanOrEqual(29);
    expect(summary.byRoute.off_topic).toBeGreaterThanOrEqual(5);
    expect(summary.byRoute.career).toBeGreaterThanOrEqual(5);
    expect(summary.byRoute.repo_overview).toBeGreaterThanOrEqual(5);
    expect(summary.byRoute.repo_deep).toBeGreaterThanOrEqual(5);
    expect(summary.followUps).toBeGreaterThanOrEqual(5);
    expect(summary.attributionTraps).toBeGreaterThanOrEqual(3);
    expect(summary.borderline).toBeGreaterThanOrEqual(2);
    expect(summary.branchQuestions).toBeGreaterThanOrEqual(5);
  });
});

describe("eval grading", () => {
  it("treats a missing route as not applicable", () => {
    expect(gradeRoute(undefined, "career")).toEqual({
      status: "not_applicable",
      reason: "response has no route",
    });
    expect(gradeRoute("career", "career").status).toBe("passed");
    expect(gradeRoute("off_topic", "career").status).toBe("failed");
  });

  it("matches required mentions case-insensitively in the answer or sources", () => {
    expect(
      gradeMentions("He studied at RUTGERS.", [], ["Rutgers"]).status,
    ).toBe("passed");
    expect(
      gradeMentions("See the resume.", ["Volvo Cars"], ["Volvo"]).status,
    ).toBe("passed");
    expect(gradeMentions("No details.", [], ["Volvo"]).missing).toEqual([
      "Volvo",
    ]);
  });

  it("parses yes and no claim judgments and fails when the claim is present", () => {
    expect(parseClaimJudgment("Yes")).toBe(true);
    expect(parseClaimJudgment("no, it does not")).toBe(false);
    expect(parseClaimJudgment("maybe")).toBe(null);
    expect(
      gradeClaims([{ claim: "Sachin wrote it", claims: false }]).status,
    ).toBe("passed");
    expect(
      gradeClaims([{ claim: "Sachin wrote it", claims: true }]).claimed,
    ).toEqual(["Sachin wrote it"]);
  });

  it("skips citation checks until a snapshot exists, then checks lines", () => {
    expect(gradeCitations(["Resume"], null).status).toBe("not_applicable");

    const snapshot = {
      defaultBranch: "main",
      branches: {
        main: {
          files: [{ path: "train/model.py", blobId: "abc" }],
        },
      },
      blobs: {
        abc: "line 1\nline 2\nline 3",
      },
    };

    expect(parseCitation("main:train/model.py:L1-L2")).toEqual({
      branch: "main",
      path: "train/model.py",
      startLine: 1,
      endLine: 2,
    });
    expect(gradeCitations(["main:train/model.py:L1-L2"], snapshot).status).toBe(
      "passed",
    );
    expect(gradeCitations(["main:train/model.py:L1-L9"], snapshot).status).toBe(
      "failed",
    );
    expect(
      gradeCitations(["other:train/model.py:L1-L2"], snapshot).status,
    ).toBe("failed");
  });

  it("grades one question across all four checks", () => {
    const checks = gradeQuestion({
      question: questions[0],
      payload: {
        answer: "Rutgers, Electrical and Computer Engineering.",
        sources: ["Resume"],
      },
      snapshot: null,
      claimJudgments: [],
    });

    expect(checks.route.status).toBe("not_applicable");
    expect(checks.mentions.status).toBe("passed");
    expect(checks.claims.status).toBe("passed");
    expect(checks.citations.status).toBe("not_applicable");
  });

  it("totals statuses and compares them with the previous report", () => {
    const totals = totalsByCategory([
      {
        checks: {
          route: { status: "not_applicable" },
          mentions: { status: "passed" },
          claims: { status: "passed" },
          citations: { status: "not_applicable" },
        },
      },
    ]);
    expect(totals.mentions.passed).toBe(1);
    expect(
      compareTotals(totals, {
        mentions: { passed: 0 },
        route: { not_applicable: 1 },
        claims: { passed: 1 },
        citations: { not_applicable: 1 },
      }).mentions.passed,
    ).toBe(1);
    expect(compareTotals(totals, null)).toBeNull();
  });

  it("stops the run when a request is rate limited", async () => {
    const seen = [];
    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
        seen.push(item);
        if (item === 1) {
          const error = new Error("429");
          error.code = "RATE_LIMITED";
          throw error;
        }
        return item;
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(seen).toContain(1);
  });

  it("parses eval script arguments", () => {
    expect(
      parseArgs(["--url", "http://127.0.0.1:3001", "--concurrency", "2"]),
    ).toEqual({
      url: "http://127.0.0.1:3001",
      concurrency: 2,
    });
    expect(() => parseArgs(["--concurrency", "0"])).toThrow(
      "--concurrency must be a positive integer",
    );
  });
});
