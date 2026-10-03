import { describe, expect, it } from "vitest";
import { REPO_SOURCES } from "../data/repos/config.mjs";
import {
  assembleSnapshot,
  assertNoSecrets,
  attributionForEmails,
  branchChanges,
  filterTreeEntries,
  findSecret,
  redactSecrets,
  selectBranches,
  stripNotebook,
} from "../scripts/lib/repoSnapshot.mjs";

const source = REPO_SOURCES[0];

describe("repo snapshot", () => {
  it("keeps research branches and drops tooling branches", () => {
    expect(
      selectBranches(
        [
          "main",
          "cursor/setup-dev-environment-effd",
          "smoke-test",
          "deepagents-latent-integration",
          "dependabot/npm/next",
        ],
        source,
      ),
    ).toEqual(["deepagents-latent-integration", "main", "smoke-test"]);
  });

  it("fails when too many branches remain", () => {
    const limited = { ...source, maxBranches: 1 };
    expect(() => selectBranches(["main", "smoke-test"], limited)).toThrow(
      /above the limit/,
    );
  });

  it("drops images, datasets, bytecode, and oversized files", () => {
    const kept = filterTreeEntries(
      [
        { path: "train/model.py", size: 100, type: "blob" },
        { path: ".env", size: 40, type: "blob" },
        { path: "assets/logo.png", size: 100, type: "blob" },
        { path: "inference/dataset/medqa.json", size: 100, type: "blob" },
        {
          path: "inference/__pycache__/inference_mas.cpython-313.pyc",
          size: 100,
          type: "blob",
        },
        { path: "big.py", size: source.maxFileBytes + 1, type: "blob" },
        {
          path: "notebooks/latent_channel_smoke.ipynb",
          size: source.maxFileBytes + 1,
          type: "blob",
        },
      ],
      source,
    ).map((entry) => entry.path);

    expect(kept).toEqual([
      "train/model.py",
      "notebooks/latent_channel_smoke.ipynb",
    ]);
  });

  it("attributes files as sachin, mixed, or upstream", () => {
    expect(
      attributionForEmails(["sachin.s.ganpule@gmail.com"], source.authorEmails),
    ).toBe("sachin");
    expect(
      attributionForEmails(
        ["sachin.s.ganpule@gmail.com", "upstream@example.com"],
        source.authorEmails,
      ),
    ).toBe("mixed");
    expect(
      attributionForEmails(["upstream@example.com"], source.authorEmails),
    ).toBe("upstream");
  });

  it("strips notebook outputs and keeps cell sources", () => {
    const stripped = JSON.parse(
      stripNotebook(
        JSON.stringify({
          nbformat: 4,
          cells: [
            {
              cell_type: "code",
              source: ["print(1)"],
              outputs: [{ text: "1" }],
              execution_count: 3,
            },
          ],
        }),
      ),
    );

    expect(stripped.cells).toEqual([
      { cell_type: "code", source: ["print(1)"] },
    ]);
    expect(JSON.stringify(stripped)).not.toContain("outputs");
  });

  it("rejects a secret on a non-default branch and redacts tokens in published text", () => {
    expect(findSecret("train/model.py", "const sketch = 1")).toBeNull();
    const token = `sk-${"a".repeat(20)}`;
    expect(() =>
      assertNoSecrets([
        {
          branch: "smoke-test",
          path: "notes.py",
          content: `token = "${token}"`,
        },
      ]),
    ).toThrow(/smoke-test/);

    const redacted = redactSecrets(`token = "${token}"`);
    expect(redacted.labels).toEqual(["OpenAI-style key"]);
    expect(redacted.content).toBe('token = "[redacted]"');
    expect(redacted.content).not.toContain(token);
  });

  it("stores one blob when two branches share it", () => {
    const snapshot = assembleSnapshot({
      source,
      fetchedAt: "2026-09-30T00:00:00.000Z",
      branchRecords: {
        main: {
          commit: "aaa",
          committedAt: "2026-08-04T00:00:00.000Z",
          ahead: 0,
          behind: 0,
          files: [
            {
              path: "README.md",
              blobId: "same",
              attribution: "upstream",
              size: 4,
            },
          ],
          commits: [],
          diffFromMain: [],
        },
        "smoke-test": {
          commit: "bbb",
          committedAt: "2026-08-04T00:00:00.000Z",
          ahead: 1,
          behind: 0,
          files: [
            {
              path: "README.md",
              blobId: "same",
              attribution: "upstream",
              size: 4,
            },
          ],
          commits: [],
          diffFromMain: [],
        },
      },
      blobEntries: { same: "# hi" },
    });

    expect(Object.keys(snapshot.blobs)).toEqual(["same"]);
    expect(snapshot.branches.main.files[0].blobId).toBe("same");
    expect(snapshot.branches["smoke-test"].files[0].blobId).toBe("same");
  });

  it("reports a branch that disappeared from the remote", () => {
    const changes = branchChanges(
      { main: "aaa", "smoke-test": "bbb" },
      { main: "aaa" },
    );

    expect(changes.unchanged).toBe(false);
    expect(changes.removed).toEqual(["smoke-test"]);
  });
});
