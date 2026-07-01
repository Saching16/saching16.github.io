import { NextResponse } from "next/server";
import {
  MAX_MESSAGE_CHARS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../../../lib/digitalTwinConfig";
import { logDigitalTwinEvent } from "../../../lib/digitalTwinAnalytics";
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
  const startedAt = Date.now();
  let messageLength = 0;
  let historyLength = 0;

  try {
    if (!isAllowedOrigin(request)) {
      logDigitalTwinEvent({
        request,
        outcome: "blocked_origin",
        status: 403,
        startedAt,
      });
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
      logDigitalTwinEvent({
        request,
        outcome: "rate_limited",
        status: 429,
        startedAt,
      });
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
    messageLength = message.length;
    historyLength = history.length;

    if (!message) {
      logDigitalTwinEvent({
        request,
        outcome: "validation_error",
        status: 400,
        startedAt,
        messageLength,
        historyLength,
        error: "A message is required.",
      });
      return NextResponse.json(
        { error: "A message is required." },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      logDigitalTwinEvent({
        request,
        outcome: "validation_error",
        status: 400,
        startedAt,
        messageLength,
        historyLength,
        error: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`,
      });
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

    logDigitalTwinEvent({
      request,
      outcome: "success",
      status: 200,
      startedAt,
      messageLength,
      historyLength,
      sources: result.sources || [],
    });

    return NextResponse.json(result);
  } catch (error) {
    logDigitalTwinEvent({
      request,
      outcome: "error",
      status: 500,
      startedAt,
      messageLength,
      historyLength,
      error: error?.message || "Digital Twin route error.",
    });
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
