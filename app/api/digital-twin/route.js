import { NextResponse } from "next/server";
import { answerCareerQuestion } from "../../../lib/digitalTwinRag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json();
    const message = typeof payload?.message === "string" ? payload.message : "";
    const history = Array.isArray(payload?.history) ? payload.history : [];

    if (!message.trim()) {
      return NextResponse.json(
        { error: "A message is required." },
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
