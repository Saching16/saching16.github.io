import { chunkText, cosineSimilarity } from "../lib/digitalTwinRag";
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
  });
});
