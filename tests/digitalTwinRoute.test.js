import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_MESSAGE_CHARS,
  RATE_LIMIT_MAX_REQUESTS,
} from "../lib/digitalTwinConfig";
import { resetRateLimitBuckets } from "../lib/rateLimiter";

vi.mock("../lib/digitalTwinRag", () => ({
  answerCareerQuestion: vi.fn(),
}));

import { POST } from "../app/api/digital-twin/route";
import { answerCareerQuestion } from "../lib/digitalTwinRag";

describe("POST /api/digital-twin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitBuckets();
  });

  it("returns 400 when message is missing", async () => {
    const request = new Request("http://localhost:3000/api/digital-twin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({ message: "   " }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when message exceeds the max length", async () => {
    const request = new Request("http://localhost:3000/api/digital-twin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({ message: "a".repeat(MAX_MESSAGE_CHARS + 1) }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 403 for mismatched origin and host", async () => {
    const request = new Request("http://localhost:3000/api/digital-twin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ message: "Hello" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("calls answerCareerQuestion and returns its payload", async () => {
    answerCareerQuestion.mockResolvedValue({
      answer: "Sample answer",
      sources: ["Resume"],
    });

    const request = new Request("http://localhost:3000/api/digital-twin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        message: "Tell me about your education.",
        history: [{ role: "user", content: "Hi" }],
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(answerCareerQuestion).toHaveBeenCalledWith({
      question: "Tell me about your education.",
      history: [{ role: "user", content: "Hi" }],
    });
    expect(payload).toEqual({
      answer: "Sample answer",
      sources: ["Resume"],
    });
  });

  it("limits clients to five questions per minute", async () => {
    answerCareerQuestion.mockResolvedValue({
      answer: "Sample answer",
      sources: ["Resume"],
    });

    let response;
    for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS + 1; index += 1) {
      const request = new Request("http://localhost:3000/api/digital-twin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          message: `Question ${index}`,
          history: [],
        }),
      });

      response = await POST(request);
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(answerCareerQuestion).toHaveBeenCalledTimes(RATE_LIMIT_MAX_REQUESTS);
  });
});
