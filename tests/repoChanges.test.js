import {
  describeRepoChange,
  filesChangedBetween,
  formatRepoChanges,
} from "../scripts/lib/repoChanges.mjs";
import { buildPrBody } from "../scripts/lib/ragChanges.mjs";

const file = (path, blobId) => ({ path, blobId, attribution: "sachin" });

describe("repoChanges", () => {
  it("treats a missing previous snapshot as added branches", () => {
    const change = describeRepoChange({
      slug: "recursivemas-coding-agents",
      repo: "Saching16/RecursiveMAS-Coding-Agents",
      beforeSnapshot: null,
      afterSnapshot: {
        branches: { main: { commit: "abc", files: [] } },
      },
      beforeOverview: "",
      afterOverview: "# overview",
    });

    expect(change.added).toEqual([{ name: "main", commit: "abc" }]);
    expect(change.updated).toEqual([]);
    expect(change.overviewRegenerated).toBe(true);
  });

  it("lists files whose blob id changed, plus additions and removals", () => {
    const files = filesChangedBetween(
      {
        files: [
          file("PLAN.md", "aaa"),
          file("old.py", "bbb"),
          file("same.py", "ccc"),
        ],
      },
      {
        files: [
          file("PLAN.md", "ddd"),
          file("new.py", "eee"),
          file("same.py", "ccc"),
        ],
      },
    );

    expect(files).toEqual([
      { path: "new.py", status: "added" },
      { path: "old.py", status: "removed" },
      { path: "PLAN.md", status: "modified" },
    ]);
  });

  it("reports updated, added, and deleted branches and whether the overview changed", () => {
    const change = describeRepoChange({
      slug: "recursivemas-coding-agents",
      repo: "Saching16/RecursiveMAS-Coding-Agents",
      beforeSnapshot: {
        branches: {
          main: { commit: "main1", files: [file("README.md", "r1")] },
          "deepagents-latent-integration": {
            commit: "old",
            files: [file("PLAN.md", "p1")],
          },
          "smoke-test": { commit: "smoke", files: [] },
          throwaway: { commit: "gone", files: [file("note.md", "n1")] },
        },
      },
      afterSnapshot: {
        branches: {
          main: { commit: "main1", files: [file("README.md", "r1")] },
          "deepagents-latent-integration": {
            commit: "new",
            files: [file("PLAN.md", "p2"), file("extra.md", "e1")],
          },
          "smoke-test": { commit: "smoke", files: [] },
          "fresh-branch": { commit: "added", files: [file("a.md", "a1")] },
        },
      },
      beforeOverview: "old overview",
      afterOverview: "new overview",
    });

    expect(change.updated).toEqual([
      {
        name: "deepagents-latent-integration",
        oldCommit: "old",
        newCommit: "new",
        files: [
          { path: "extra.md", status: "added" },
          { path: "PLAN.md", status: "modified" },
        ],
      },
    ]);
    expect(change.added).toEqual([{ name: "fresh-branch", commit: "added" }]);
    expect(change.deleted).toEqual([{ name: "throwaway", commit: "gone" }]);
    expect(change.overviewRegenerated).toBe(true);
  });

  it("formats a repo section and treats an unchanged repo as none", () => {
    const formatted = formatRepoChanges([
      describeRepoChange({
        slug: "recursivemas-coding-agents",
        repo: "Saching16/RecursiveMAS-Coding-Agents",
        beforeSnapshot: {
          branches: {
            main: { commit: "same", files: [file("README.md", "r1")] },
          },
        },
        afterSnapshot: {
          branches: {
            main: { commit: "same", files: [file("README.md", "r1")] },
            "cursor-like": { commit: "abc", files: [] },
          },
        },
        beforeOverview: "overview",
        afterOverview: "overview",
      }),
    ]);

    expect(formatted.join("\n")).toContain("**Branches added**");
    expect(formatted.join("\n")).toContain("- `cursor-like` at `abc`");
    expect(formatted.join("\n")).toContain("- Overview regenerated: no");

    const empty = formatRepoChanges([
      describeRepoChange({
        slug: "recursivemas-coding-agents",
        repo: "Saching16/RecursiveMAS-Coding-Agents",
        beforeSnapshot: { branches: { main: { commit: "same", files: [] } } },
        afterSnapshot: { branches: { main: { commit: "same", files: [] } } },
        beforeOverview: "overview",
        afterOverview: "overview",
      }),
    ]);
    expect(empty).toEqual(["- None"]);
  });

  it("names a changed branch with both commit ids in the pull request body", () => {
    const body = buildPrBody({
      driveChanges: [],
      sourceChanges: [],
      summaries: new Map(),
      aiNote: "",
      warnings: [],
      repoChanges: [
        {
          slug: "recursivemas-coding-agents",
          repo: "Saching16/RecursiveMAS-Coding-Agents",
          updated: [
            {
              name: "deepagents-latent-integration",
              oldCommit: "aaa",
              newCommit: "bbb",
              files: [{ path: "PLAN.md", status: "modified" }],
            },
          ],
          added: [],
          deleted: [{ name: "throwaway", commit: "ccc" }],
          overviewRegenerated: true,
        },
      ],
    });

    expect(body).toContain("### Repo changes");
    expect(body).toContain("#### Saching16/RecursiveMAS-Coding-Agents");
    expect(body).toContain("- Overview regenerated: yes");
    expect(body).toContain("**`deepagents-latent-integration`**");
    expect(body).toContain("- Old commit: `aaa`");
    expect(body).toContain("- New commit: `bbb`");
    expect(body).toContain("- modified `PLAN.md`");
    expect(body).toContain("**Branches deleted**");
    expect(body).toContain("- `throwaway` (was `ccc`)");
  });
});
