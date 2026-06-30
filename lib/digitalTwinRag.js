import OpenAI from "openai";
import { RAG_SOURCES } from "../data/rag/sources";
import { MAX_HISTORY_MESSAGES } from "./digitalTwinConfig";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";
const MAX_CHUNK_LENGTH = 900;
const CHUNK_OVERLAP = 160;
const TOP_K = 6;
const CHUNK_BOUNDARY_WINDOW = 120;

let cachedIndexPromise = null;
let cachedClient = null;

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function cleanText(rawText) {
  return rawText
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function findChunkBoundary(text, start, targetEnd) {
  if (targetEnd >= text.length) {
    return text.length;
  }

  const forwardSlice = text.slice(
    targetEnd,
    Math.min(text.length, targetEnd + CHUNK_BOUNDARY_WINDOW),
  );
  const punctuationMatch = forwardSlice.match(/[.!?]\s/);
  if (punctuationMatch && punctuationMatch.index !== undefined) {
    return targetEnd + punctuationMatch.index + 1;
  }

  const forwardWhitespace = forwardSlice.search(/\s/);
  if (forwardWhitespace !== -1) {
    return targetEnd + forwardWhitespace;
  }

  const backwardStart = Math.max(start, targetEnd - CHUNK_BOUNDARY_WINDOW);
  const backwardSlice = text.slice(backwardStart, targetEnd);
  const backwardWhitespace = backwardSlice.lastIndexOf(" ");
  if (backwardWhitespace > 0) {
    return backwardStart + backwardWhitespace;
  }

  return targetEnd;
}

export function chunkText(text, source) {
  const chunks = [];
  let start = 0;
  let chunkId = 0;

  while (start < text.length) {
    const targetEnd = Math.min(text.length, start + MAX_CHUNK_LENGTH);
    const end = Math.max(start + 1, findChunkBoundary(text, start, targetEnd));
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

    let nextStart = Math.max(end - CHUNK_OVERLAP, start + 1);
    if (nextStart < text.length) {
      const nextSpace = text.indexOf(" ", nextStart);
      if (nextSpace !== -1 && nextSpace - nextStart < CHUNK_BOUNDARY_WINDOW) {
        nextStart = nextSpace + 1;
      }
    }

    start = nextStart;
  }

  return chunks;
}

export function cosineSimilarity(a, b) {
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
    // This cache persists only for the lifetime of the warm serverless instance.
    // Source updates in data/rag/sources.js still require a redeploy.
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
    .slice(-MAX_HISTORY_MESSAGES)
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
  const historyMessages = toHistoryMessages(history);
  const lastHistoryMessage = historyMessages[historyMessages.length - 1];
  if (
    lastHistoryMessage?.role === "user" &&
    lastHistoryMessage.content === trimmedQuestion
  ) {
    historyMessages.pop();
  }

  const messages = [
    {
      role: "system",
      content:
        "You are Sachin Ganpule's Digital Twin career and research assistant. Answer questions about Sachin's background, skills, projects, education, experience, and research interests using only the provided context. Pay special attention to sources about agents, latent space reasoning, LatentMAS, and RecursiveMAS when relevant. If context is insufficient, clearly say you do not have enough information and ask a clarifying follow-up. Keep answers concise and specific, and do not fabricate details.",
    },
    ...historyMessages,
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
