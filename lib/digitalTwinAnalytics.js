import { createHash } from "node:crypto";

function getClientIp(request) {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  return "unknown";
}

function getClientHash(request) {
  const salt = process.env.CHAT_ANALYTICS_SALT || "personal-website";
  return createHash("sha256")
    .update(`${salt}:${getClientIp(request)}`)
    .digest("hex")
    .slice(0, 16);
}

function getUserAgent(request) {
  return (request.headers.get("user-agent") || "unknown").slice(0, 160);
}

export function logDigitalTwinEvent({
  request,
  outcome,
  status,
  startedAt,
  messageLength = 0,
  historyLength = 0,
  sources = [],
  error = "",
}) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const event = {
    event: "digital_twin_chat",
    outcome,
    status,
    latencyMs: Math.max(0, Date.now() - startedAt),
    messageLength,
    historyLength,
    sources,
    clientHash: getClientHash(request),
    userAgent: getUserAgent(request),
    timestamp: new Date().toISOString(),
  };

  if (error) {
    event.error = error.slice(0, 160);
  }

  console.info(JSON.stringify(event));
}
