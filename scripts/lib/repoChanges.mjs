function branchFiles(branch) {
  return new Map((branch?.files || []).map((file) => [file.path, file.blobId]));
}

export function filesChangedBetween(beforeBranch, afterBranch) {
  const before = branchFiles(beforeBranch);
  const after = branchFiles(afterBranch);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(
    (left, right) => left.localeCompare(right),
  );
  const files = [];

  for (const filePath of paths) {
    const oldId = before.get(filePath);
    const newId = after.get(filePath);
    if (oldId === undefined) {
      files.push({ path: filePath, status: "added" });
    } else if (newId === undefined) {
      files.push({ path: filePath, status: "removed" });
    } else if (oldId !== newId) {
      files.push({ path: filePath, status: "modified" });
    }
  }

  return files;
}

export function describeRepoChange({
  slug,
  repo,
  beforeSnapshot,
  afterSnapshot,
  beforeOverview,
  afterOverview,
}) {
  const beforeBranches = beforeSnapshot?.branches || {};
  const afterBranches = afterSnapshot?.branches || {};
  const names = [
    ...new Set([...Object.keys(beforeBranches), ...Object.keys(afterBranches)]),
  ].sort((left, right) => left.localeCompare(right));

  const updated = [];
  const added = [];
  const deleted = [];

  for (const name of names) {
    const before = beforeBranches[name];
    const after = afterBranches[name];
    if (!before) {
      added.push({ name, commit: after.commit });
    } else if (!after) {
      deleted.push({ name, commit: before.commit });
    } else if (before.commit !== after.commit) {
      updated.push({
        name,
        oldCommit: before.commit,
        newCommit: after.commit,
        files: filesChangedBetween(before, after),
      });
    }
  }

  return {
    slug,
    repo,
    updated,
    added,
    deleted,
    overviewRegenerated: (beforeOverview || "") !== (afterOverview || ""),
  };
}

export function repoChangeIsEmpty(change) {
  return (
    change.updated.length === 0 &&
    change.added.length === 0 &&
    change.deleted.length === 0 &&
    !change.overviewRegenerated
  );
}

function pushBranchList(lines, heading, branches, format) {
  if (!branches.length) {
    return;
  }

  lines.push(`**${heading}**`, "");
  for (const branch of branches) {
    lines.push(format(branch));
  }
  lines.push("");
}

export function formatRepoChanges(changes) {
  const visible = (changes || []).filter(
    (change) => !repoChangeIsEmpty(change),
  );
  if (!visible.length) {
    return ["- None"];
  }

  const lines = [];
  for (const change of visible) {
    lines.push(`#### ${change.repo}`, "");
    lines.push(
      `- Overview regenerated: ${change.overviewRegenerated ? "yes" : "no"}`,
      "",
    );

    for (const branch of change.updated) {
      lines.push(`**\`${branch.name}\`**`, "");
      lines.push(`- Old commit: \`${branch.oldCommit}\``);
      lines.push(`- New commit: \`${branch.newCommit}\``);
      if (branch.files.length) {
        lines.push("- Files changed:");
        for (const file of branch.files) {
          lines.push(`  - ${file.status} \`${file.path}\``);
        }
      } else {
        lines.push("- Files changed: none in the snapshot.");
      }
      lines.push("");
    }

    pushBranchList(
      lines,
      "Branches added",
      change.added,
      (branch) => `- \`${branch.name}\` at \`${branch.commit}\``,
    );
    pushBranchList(
      lines,
      "Branches deleted",
      change.deleted,
      (branch) => `- \`${branch.name}\` (was \`${branch.commit}\`)`,
    );
  }

  return lines;
}
