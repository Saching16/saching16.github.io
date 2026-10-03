import { describe, expect, it } from "vitest";
import { PROJECTS } from "../data/projects";
import {
  isBranchExcluded,
  isRepoFileIncluded,
  REPO_SOURCES,
  repoFullName,
} from "../data/repos/config.mjs";

describe("repo sources", () => {
  it("links every project repo to a source, and every source to a project", () => {
    const projectRepos = PROJECTS.map((project) => project.repo).filter(
      Boolean,
    );
    const sourceRepos = REPO_SOURCES.map(repoFullName);

    expect(projectRepos.length).toBeGreaterThan(0);
    for (const repo of projectRepos) {
      expect(sourceRepos).toContain(repo);
    }
    for (const repo of sourceRepos) {
      expect(projectRepos).toContain(repo);
    }
  });

  it("keeps the research branches and drops tooling branches", () => {
    const { excludeBranches } = REPO_SOURCES[0];

    expect(
      isBranchExcluded("cursor/setup-dev-environment-effd", excludeBranches),
    ).toBe(true);
    expect(isBranchExcluded("dependabot/npm/next", excludeBranches)).toBe(true);
    expect(isBranchExcluded("main", excludeBranches)).toBe(false);
    expect(
      isBranchExcluded("deepagents-latent-integration", excludeBranches),
    ).toBe(false);
    expect(isBranchExcluded("smoke-test", excludeBranches)).toBe(false);
  });

  it("drops images, datasets, bytecode, and lockfiles", () => {
    const source = REPO_SOURCES[0];

    expect(isRepoFileIncluded("train/model.py", source)).toBe(true);
    expect(
      isRepoFileIncluded("experiments/exp0-harness-spike.md", source),
    ).toBe(true);
    expect(isRepoFileIncluded("assets/logo.png", source)).toBe(false);
    expect(isRepoFileIncluded("inference/dataset/medqa.json", source)).toBe(
      false,
    );
    expect(isRepoFileIncluded("inference/assets/logo.png", source)).toBe(false);
    expect(
      isRepoFileIncluded(
        "inference/__pycache__/inference_mas.cpython-313.pyc",
        source,
      ),
    ).toBe(false);
    expect(isRepoFileIncluded("package-lock.json", source)).toBe(false);
  });
});
