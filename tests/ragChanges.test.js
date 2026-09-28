import {
  buildPrBody,
  describeDriveChanges,
  diffSources,
  parseSourcesFile,
  sanityWarnings,
  summarizeChange,
} from "../scripts/lib/ragChanges.mjs";

const longText = (word, count) =>
  Array.from({ length: count }, () => word).join(" ");

describe("ragChanges", () => {
  it("parses a generated sources.js file", () => {
    const sources = [{ label: "Resume", content: "Line with [brackets]" }];
    const fileText = `// Generated\n\nexport const RAG_SOURCES = ${JSON.stringify(sources, null, 2)};\n`;

    expect(parseSourcesFile(fileText)).toEqual(sources);
    expect(parseSourcesFile("")).toEqual([]);
  });

  it("reports only sources whose content changed", () => {
    const changes = diffSources(
      [
        { label: "Resume", content: "old" },
        { label: "Research Interests", content: "same" },
      ],
      [
        { label: "Resume", content: "new" },
        { label: "Research Interests", content: "same" },
        { label: "LinkedIn", content: "added" },
      ],
    );

    expect(changes).toEqual([
      { label: "Resume", before: "old", after: "new" },
      { label: "LinkedIn", before: "", after: "added" },
    ]);
  });

  it("describes Drive files that differ from the committed manifest", () => {
    const resume = {
      id: "1",
      name: "Resume.pdf",
      modifiedTime: "2026-09-01T00:00:00Z",
    };
    const linkedin = {
      id: "2",
      name: "Profile.pdf",
      modifiedTime: "2026-08-01T00:00:00Z",
    };

    const changes = describeDriveChanges({ linkedin }, { resume, linkedin });

    expect(changes).toEqual([{ label: "Resume", ...resume }]);
  });

  it("warns when text is missing, tiny, or shrinks sharply", () => {
    const warnings = sanityWarnings([
      {
        label: "Resume",
        before: longText("skill", 400),
        after: longText("skill", 100),
      },
      { label: "LinkedIn", before: "x", after: "" },
      {
        label: "Research Interests",
        before: longText("a", 400),
        after: longText("a", 410),
      },
    ]);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/Resume text shrank by 75%/);
    expect(warnings[1]).toMatch(/LinkedIn is no longer present/);
  });

  it("flags very short extracted text", () => {
    expect(
      sanityWarnings([{ label: "Resume", before: "", after: "tiny" }])[0],
    ).toMatch(/only 4 characters/);
  });

  it("builds a PR body with AI summaries and warnings", () => {
    const body = buildPrBody({
      driveChanges: [
        {
          label: "Resume",
          name: "Resume.pdf",
          modifiedTime: "2026-09-01T00:00:00Z",
        },
      ],
      sourceChanges: [
        { label: "Resume", before: "a".repeat(1000), after: "a".repeat(1200) },
      ],
      summaries: new Map([["Resume", "- Added a new role."]]),
      aiNote: "",
      warnings: ["Something looks off."],
    });

    expect(body).toContain(
      '- **Resume:** "Resume.pdf" (modified 2026-09-01T00:00:00Z)',
    );
    expect(body).toContain("Text length: 1,000 to 1,200 characters.");
    expect(body).toContain("- Added a new role.");
    expect(body).toContain("- **Warning:** Something looks off.");
  });

  it("explains missing AI summaries and unchanged text", () => {
    const withoutAi = buildPrBody({
      driveChanges: [],
      sourceChanges: [{ label: "LinkedIn", before: "a", after: "b" }],
      summaries: new Map(),
      aiNote: "OPENAI_API_KEY is not set.",
      warnings: [],
    });
    expect(withoutAi).toContain(
      "_AI summary unavailable: OPENAI_API_KEY is not set._",
    );
    expect(withoutAi).toContain("- No issues found.");

    const unchanged = buildPrBody({
      driveChanges: [],
      sourceChanges: [],
      summaries: new Map(),
      aiNote: "",
      warnings: [],
    });
    expect(unchanged).toContain("The extracted text is unchanged.");
  });

  it("asks the model to compare before and after text", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: " - Added FAISS to skills. " } }],
    }));
    const client = { chat: { completions: { create } } };

    const summary = await summarizeChange(client, {
      label: "LinkedIn",
      before: "Skills: Python",
      after: "Skills: Python, FAISS",
    });

    expect(summary).toBe("- Added FAISS to skills.");
    const userMessage = create.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain("<before>\nSkills: Python\n</before>");
    expect(userMessage).toContain("<after>\nSkills: Python, FAISS\n</after>");
  });
});
