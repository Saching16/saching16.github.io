import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { findSecret } from "../scripts/lib/repoSnapshot.mjs";
import {
  OVERVIEW_SECTIONS,
  OVERVIEW_MATERIAL_CHAR_LIMIT,
  buildOverviewMaterials,
  allBranchPathErrors,
  presenceClaimErrors,
  claimsMerged,
  mergedBranchClaims,
  leadingPythonNote,
  newestCopy,
  overviewBody,
  overviewIsCurrent,
  planPaths,
  projectSourceLabel,
  stampOverview,
  upstreamPathsCitedAsSachin,
  validateOverview,
} from "../scripts/lib/repoOverview.mjs";

const snapshot = JSON.parse(
  await readFile(
    new URL(
      "../data/repos/recursivemas-coding-agents/snapshot.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("repo overview", () => {
  it("extracts a module docstring or a leading comment", () => {
    expect(leadingPythonNote('"""Hello world."""\n\nx = 1\n')).toBe(
      "Hello world.",
    );
    expect(leadingPythonNote("# first\n# second\n\nx = 1\n")).toBe(
      "first\nsecond",
    );
    expect(leadingPythonNote("import os\n")).toBe("");
    expect(leadingPythonNote("#!/usr/bin/env python\nr'''note'''\n")).toBe(
      "note",
    );
  });

  it("takes proposal, plan, and experiment files from the newest branch", () => {
    for (const filePath of planPaths(snapshot)) {
      expect(newestCopy(snapshot, filePath).branch).toBe(
        "deepagents-latent-integration",
      );
    }
    expect(planPaths(snapshot)).toContain("PLAN.md");
    expect(planPaths(snapshot)).toContain(
      "experiments/exp4-outer-recursive-delegation.md",
    );
  });

  it("rebuilds only when a recorded branch commit differs", () => {
    const stamped = stampOverview("## Current work\n", snapshot);
    expect(overviewIsCurrent(stamped, snapshot)).toBe(true);
    expect(overviewBody(stamped)).toBe("## Current work");

    const moved = structuredClone(snapshot);
    moved.branches.main.commit = "abc";
    expect(overviewIsCurrent(stamped, moved)).toBe(false);
    expect(overviewIsCurrent("", snapshot)).toBe(false);
  });

  it("rejects merged claims and upstream paths in Sachin's section", () => {
    expect(claimsMerged("The branch is not merged into main.")).toBe(false);
    expect(claimsMerged("The branch has not been merged.")).toBe(false);
    expect(claimsMerged("The branch hasn't been merged.")).toBe(false);
    expect(claimsMerged("The branch has been merged into main.")).toBe(true);
    expect(
      mergedBranchClaims(
        "Sachin merged the upstream repository into main. The deepagents-latent-integration branch is not merged.",
        ["deepagents-latent-integration", "smoke-test"],
      ),
    ).toEqual([]);
    expect(
      mergedBranchClaims(
        "The deepagents-latent-integration branch has been merged into main.",
        ["deepagents-latent-integration"],
      ),
    ).toHaveLength(1);
    expect(
      allBranchPathErrors(
        "`train/train_outer.py` is upstream on all branches.",
        snapshot,
      ).join(" "),
    ).toContain("deepagents-latent-integration");
    expect(
      presenceClaimErrors(
        "notebooks/latent_channel_smoke.ipynb is not present on deepagents-latent-integration.",
        snapshot,
      ).join(" "),
    ).toContain("notebooks/latent_channel_smoke.ipynb");
    expect(
      presenceClaimErrors(
        "PLAN.md is extended on deepagents-latent-integration.",
        snapshot,
      ).join(" "),
    ).toContain("PLAN.md");

    expect(
      upstreamPathsCitedAsSachin(
        "He added PROPOSAL.md and did not write train/train_outer.py.",
        snapshot,
      ),
    ).toEqual(["train/train_outer.py"]);
  });

  it("prepares materials without secret-shaped tokens", () => {
    const { text } = buildOverviewMaterials(snapshot);
    expect(text).toContain(
      "PROPOSAL.md from deepagents-latent-integration (attribution: sachin",
    );
    expect(text).toContain("Gate 0.1 GREEN");
    expect(text).toContain("not merged");
    expect(text.length).toBeLessThanOrEqual(OVERVIEW_MATERIAL_CHAR_LIMIT);
    expect(findSecret("overview-prompt.txt", text)).toBeNull();
  });

  it("requires the six sections and the current branch", () => {
    const drafted = OVERVIEW_SECTIONS.map(
      (title) => `## ${title}\nParagraph.`,
    ).join("\n\n");
    const errors = validateOverview(drafted, snapshot);
    expect(
      errors.some((error) => error.includes("deepagents-latent-integration")),
    ).toBe(true);
    expect(projectSourceLabel({ name: "RecursiveMAS-Coding-Agents" })).toBe(
      "Project: RecursiveMAS-Coding-Agents",
    );
  });
});
