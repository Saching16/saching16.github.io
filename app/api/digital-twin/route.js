import { NextResponse } from "next/server";
import {
  MAX_MESSAGE_CHARS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../../../lib/digitalTwinConfig";
import { answerCareerQuestion } from "../../../lib/digitalTwinRag";
import { checkRateLimit, getRateLimitKey } from "../../../lib/rateLimiter";

export const runtime = "nodejs";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Digital Twin route started without OPENAI_API_KEY.");
}

function getRequestHost(request) {
  return (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  ).toLowerCase();
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = getRequestHost(request);
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { error: "Origin is not allowed." },
        { status: 403 },
      );
    }

    const rateLimit = checkRateLimit({
      key: getRateLimitKey(request),
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const payload = await request.json();
    const message =
      typeof payload?.message === "string" ? payload.message.trim() : "";
    const history = Array.isArray(payload?.history) ? payload.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "A message is required." },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        {
          error: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`,
        },
        { status: 400 },
      );
    }

    const result = await answerCareerQuestion({
      question: message,
      history,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Digital Twin is unavailable right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
