export const REPO_SOURCES = [
  {
    slug: "recursivemas-coding-agents",
    owner: "Saching16",
    name: "RecursiveMAS-Coding-Agents",
    defaultBranch: "main",
    excludeBranches: ["cursor/**", "dependabot/**"],
    maxBranches: 10,
    upstream: "RecursiveMAS/RecursiveMAS",
    authorEmails: [
      "sachin.s.ganpule@gmail.com",
      "155867995+Saching16@users.noreply.github.com",
    ],
    include: ["**/*"],
    exclude: [
      "**/*.png",
      "**/*.jpg",
      "**/*.jpeg",
      "**/*.gif",
      "**/*.webp",
      "**/*.pdf",
      "**/*.pyc",
      "inference/dataset/**",
      "inference/assets/**",
      "**/__pycache__/**",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/poetry.lock",
      "**/Pipfile.lock",
      "**/uv.lock",
    ],
    maxFileBytes: 100 * 1024,
  },
];

export function repoFullName(source) {
  return `${source.owner}/${source.name}`;
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern) {
  let expression = "^";
  let index = 0;

  while (index < pattern.length) {
    if (pattern.startsWith("**/", index)) {
      expression += "(?:.*/)?";
      index += 3;
    } else if (
      pattern.startsWith("/**", index) &&
      index + 3 === pattern.length
    ) {
      expression += "(?:/.*)?";
      index += 3;
    } else if (pattern.startsWith("**", index)) {
      expression += ".*";
      index += 2;
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
      index += 1;
    } else {
      expression += escapeRegex(pattern[index]);
      index += 1;
    }
  }

  return new RegExp(`${expression}$`);
}

export function matchesPattern(pattern, value) {
  return globToRegExp(pattern).test(value);
}

export function isBranchExcluded(branch, patterns) {
  return patterns.some((pattern) => matchesPattern(pattern, branch));
}

export function isRepoFileIncluded(filePath, source) {
  const included = source.include.some((pattern) =>
    matchesPattern(pattern, filePath),
  );
  if (!included) {
    return false;
  }

  return !source.exclude.some((pattern) => matchesPattern(pattern, filePath));
}
