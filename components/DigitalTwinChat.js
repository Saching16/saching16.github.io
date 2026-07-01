"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE_CHARS } from "../lib/digitalTwinConfig";

const INITIAL_TWIN_MESSAGE = {
  role: "assistant",
  content:
    "I am your Digital Twin. Ask about education, projects, technical strengths, research interests, or career direction.",
  sources: [],
};

export function DigitalTwinChat() {
  const [messages, setMessages] = useState([INITIAL_TWIN_MESSAGE]);
  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatLogRef = useRef(null);

  useEffect(() => {
    if (!chatLogRef.current) {
      return;
    }
    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, isAsking]);

  async function handleTwinSubmit(event) {
    event.preventDefault();
    if (isAsking) {
      return;
    }

    const question = questionInput.trim();
    if (!question) {
      return;
    }

    setChatError("");
    setQuestionInput("");

    const userMessage = {
      role: "user",
      content: question,
      sources: [],
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsAsking(true);

    try {
      const history = nextMessages.slice(1).map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));

      const response = await fetch("/api/digital-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Could not answer that question.");
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content: payload.answer,
          sources: payload.sources || [],
        },
      ]);
    } catch (error) {
      setChatError(
        error?.message ||
          "Digital Twin is unavailable right now. Please try again in a moment.",
      );
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <section id="digital-twin" className="section section-soft">
      <div className="container">
        <article className="twin-panel">
          <p className="eyebrow">Experimental</p>
          <h2>Project: Digital Twin</h2>
          <p>
            Ask questions about my career. The assistant uses retrieval from
            resume, LinkedIn, and research-interest sources before generating
            answers.
          </p>

          <div className="chat-shell">
            <div ref={chatLogRef} className="chat-log" aria-live="polite">
              {messages.map((message, index) => (
                <article
                  className={`chat-message ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <p>{message.content}</p>
                  {message.sources?.length > 0 && (
                    <p className="chat-sources">
                      Sources: {message.sources.join(", ")}
                    </p>
                  )}
                </article>
              ))}
              {isAsking && (
                <article className="chat-message assistant">
                  <p>Thinking...</p>
                </article>
              )}
            </div>

            <form className="chat-form" onSubmit={handleTwinSubmit}>
              <label htmlFor="twin-question" className="sr-only">
                Ask the Digital Twin a career question
              </label>
              <textarea
                id="twin-question"
                value={questionInput}
                onChange={(event) => setQuestionInput(event.target.value)}
                placeholder="Ask about experience, projects, or career goals..."
                rows={3}
                maxLength={MAX_MESSAGE_CHARS}
                disabled={isAsking}
              />
              <div className="twin-actions">
                <button type="submit" disabled={isAsking}>
                  {isAsking ? "Answering..." : "Ask Digital Twin"}
                </button>
                <span>RAG over resume + LinkedIn + research notes</span>
              </div>
            </form>

            {chatError && (
              <p className="chat-error" role="alert">
                {chatError}
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
