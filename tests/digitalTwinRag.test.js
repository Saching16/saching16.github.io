import {
  chunkText,
  cosineSimilarity,
  DIGITAL_TWIN_SYSTEM_PROMPT,
} from "../lib/digitalTwinRag";
import { RAG_SOURCES } from "../data/rag/sources";

describe("digitalTwinRag helpers", () => {
  it("creates chunks that begin and end on word boundaries", () => {
    const source = { label: "Resume" };
    const words = Array.from(
      { length: 500 },
      (_, index) => `token${String(index).padStart(3, "0")}`,
    );
    const text = words.join(" ");

    const chunks = chunkText(text, source);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content).toMatch(/^token\d{3}/);
      expect(chunk.content).toMatch(/token\d{3}$/);
    }
  });

  it("computes cosine similarity correctly", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(cosineSimilarity([1, 1], [1, 1])).toBeCloseTo(1, 5);
  });

  it("includes generated resume, LinkedIn, and research-interest sources", () => {
    const sourcesByLabel = new Map(
      RAG_SOURCES.map((source) => [source.label, source.content]),
    );

    expect(sourcesByLabel.get("Resume")).toContain("SACHIN GANPULE");
    expect(sourcesByLabel.get("LinkedIn")).toContain("linkedin.com");
    expect(sourcesByLabel.get("Research Interests")).toContain("LatentMAS");
    expect(sourcesByLabel.get("Research Interests")).toContain("RecursiveMAS");
    expect(sourcesByLabel.get("Project: RecursiveMAS-Coding-Agents")).toContain(
      "deepagents-latent-integration",
    );
    expect(sourcesByLabel.get("Project: RecursiveMAS-Coding-Agents")).toContain(
      "What Sachin's research adds",
    );
    expect(
      sourcesByLabel.get("Project: RecursiveMAS-Coding-Agents"),
    ).not.toContain("overview-commits");
  });

  it("keeps attribution and branch status in the system prompt", () => {
    expect(DIGITAL_TWIN_SYSTEM_PROMPT).toContain("only the provided context");
    expect(DIGITAL_TWIN_SYSTEM_PROMPT).toContain("do not fabricate details");
    expect(DIGITAL_TWIN_SYSTEM_PROMPT).toContain(
      "Credit upstream authors for upstream work",
    );
    expect(DIGITAL_TWIN_SYSTEM_PROMPT).toContain(
      "do not imply it has been merged",
    );
  });
});
