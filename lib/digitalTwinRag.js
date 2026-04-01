import OpenAI from "openai";
import { RAG_SOURCES } from "../data/rag/sources";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";
const MAX_CHUNK_LENGTH = 900;
const CHUNK_OVERLAP = 160;
const TOP_K = 6;

let cachedIndexPromise = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }
  return new OpenAI({ apiKey });
}

function cleanText(rawText) {
  return rawText
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function chunkText(text, source) {
  const chunks = [];
  let start = 0;
  let chunkId = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + MAX_CHUNK_LENGTH);
    const content = text.slice(start, end).trim();
    if (content.length > 60) {
      chunks.push({
        id: `${source.label}-${chunkId}`,
        source: source.label,
        content,
      });
      chunkId += 1;
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denominator) {
    return 0;
  }
  return dot / denominator;
}

async function embedTexts(client, texts) {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

async function buildIndex() {
  const client = getClient();
  const allChunks = [];

  for (const source of RAG_SOURCES) {
    const text = cleanText(source.content || "");
    allChunks.push(...chunkText(text, source));
  }

  if (!allChunks.length) {
    throw new Error("No text extracted from source PDFs.");
  }

  const batchSize = 40;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(
      client,
      batch.map((chunk) => chunk.content),
    );
    embeddings.forEach((embedding, index) => {
      batch[index].embedding = embedding;
    });
  }

  return allChunks;
}

async function getIndex() {
  if (!cachedIndexPromise) {
    cachedIndexPromise = buildIndex();
  }
  return cachedIndexPromise;
}

function formatContext(chunks) {
  return chunks
    .map((chunk, index) => {
      return `[Source ${index + 1} | ${chunk.source}]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

function toHistoryMessages(history) {
  const validRoles = new Set(["user", "assistant"]);
  return history
    .filter((entry) => validRoles.has(entry.role) && typeof entry.content === "string")
    .slice(-8)
    .map((entry) => ({ role: entry.role, content: entry.content.trim() }))
    .filter((entry) => entry.content.length > 0);
}

export async function answerCareerQuestion({ question, history = [] }) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question is empty.");
  }

  const client = getClient();
  const index = await getIndex();
  const [queryEmbedding] = await embedTexts(client, [trimmedQuestion]);

  const ranked = index
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  const context = formatContext(ranked);
  const messages = [
    {
      role: "system",
      content:
        "You are Sachin Ganpule's Digital Twin career assistant. Answer questions about Sachin's background, skills, projects, education, and experience using only the provided context. If context is insufficient, clearly say you do not have enough information and ask a clarifying follow-up. Keep answers concise and specific, and do not fabricate details.",
    },
    ...toHistoryMessages(history),
    {
      role: "user",
      content: `Question: ${trimmedQuestion}\n\nContext:\n${context}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages,
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() ||
    "I could not produce a response for that question.";

  const sources = [...new Set(ranked.map((chunk) => chunk.source))];
  return { answer, sources };
}
