"use client";

import { useEffect, useMemo, useState } from "react";
import profilePhoto from "../assets/profile.png";

const readingArchive = [
  {
    date: "2023 / ICLR",
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    description:
      "A framework for language models to generate reasoning traces and task-specific actions in an interleaved manner.",
    status: "Verified",
  },
  {
    date: "2023 / NeurIPS",
    title: "Reflexion: Language Agents with Iterative Self-Reflection",
    description:
      "An architecture that endows agentic workflows with dynamic memory and self-reflection to improve decision-making.",
    status: "In practice",
  },
  {
    date: "2017 / NIPS",
    title: "Attention is All You Need",
    description:
      "The foundational architecture for modern LLMs. Maintaining a solid understanding of the core attention mechanism mechanics.",
    status: "Verified",
  },
];

const projects = [
  {
    title: "Multi-Agent Researcher System",
    description:
      "Designing a pipeline with CrewAI + LangGraph featuring planner, researcher, writer, and validator agents with persistent memory.",
    tags: ["CrewAI", "LangGraph"],
  },
  {
    title: "High-Performance Code Optimizer",
    description:
      "LLM-driven tool translating Python to optimized C++, achieving a performance increase of 60,000x with a self-correction loop.",
    tags: ["C++", "LLM fine-tuning"],
  },
  {
    title: "Autonomous Trading Floor",
    description:
      "Multi-agent system with four autonomous agents powered by six MCP servers and specialized tools on AWS architecture.",
    tags: ["AWS", "LangFuse"],
  },
  {
    title: "GrAldient",
    description:
      "AI-powered grading tool leveraging YOLOv8 and Tesseract 5 for OCR to automate test evaluations from scanned PDFs.",
    tags: ["YOLOv8", "OCR"],
  },
];

const INITIAL_TWIN_MESSAGE = {
  role: "assistant",
  content:
    "I am your Digital Twin. Ask about education, projects, technical strengths, or career direction.",
  sources: [],
};

export default function HomePage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [messages, setMessages] = useState([INITIAL_TWIN_MESSAGE]);
  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    const updateScrollProgress = () => {
      const pageHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (pageHeight <= 0) {
        setScrollProgress(0);
        return;
      }

      const progress = Math.min(1, Math.max(0, window.scrollY / pageHeight));
      setScrollProgress(progress);
    };

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);

    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  const backgroundStyle = useMemo(() => {
    const depth = 1 - scrollProgress;
    const topBase = Math.round(16 + 62 * depth);
    const midBase = Math.round(6 + 34 * depth);
    const cyanLift = Math.round(28 * depth);
    const violetLift = Math.round(22 * depth);
    const meshOpacity = (0.06 + depth * 0.22).toFixed(3);
    const grainOpacity = (0.02 + depth * 0.06).toFixed(3);

    return {
      background: `
        radial-gradient(1150px 680px at 84% -10%, rgba(83, 157, 255, 0.32), transparent 62%),
        radial-gradient(980px 620px at 8% 18%, rgba(123, 82, 255, 0.22), transparent 58%),
        radial-gradient(720px 420px at 45% 120%, rgba(12, 210, 238, 0.08), transparent 66%),
        linear-gradient(
          180deg,
          rgb(${topBase}, ${topBase + Math.round(cyanLift * 0.55)}, ${topBase + cyanLift}) 0%,
          rgb(${midBase}, ${midBase + Math.round(violetLift * 0.35)}, ${midBase + Math.round(violetLift * 0.9)}) 55%,
          rgb(0, 0, 0) 100%
        )
      `,
      "--mesh-opacity": meshOpacity,
      "--grain-opacity": grainOpacity,
    };
  }, [scrollProgress]);

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
      const history = messages
        .slice(1)
        .map((entry) => ({
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
    <div className="site-shell" style={backgroundStyle}>
      <header className="site-header">
        <div className="container nav-row">
          <a href="#" className="brand">
            Sachin Ganpule
          </a>
          <nav className="nav-links">
            <a href="#inquiry">Areas of inquiry</a>
            <a href="#reading">Reading archive</a>
            <a href="#projects">Projects</a>
            <a href="mailto:sachin.s.ganpule@gmail.com">Contact</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero section">
          <div className="container hero-grid">
            <div className="hero-left">
              <div className="portrait-frame">
                <img
                  src={profilePhoto.src}
                  alt="Portrait of Sachin Ganpule wearing a tan sweater and white collared shirt with autumn trees in the background."
                  className="portrait"
                  width="384"
                  height="384"
                />
              </div>
              <div>
                <p className="eyebrow">Research archive</p>
                <h1>Sachin Ganpule</h1>
              </div>
            </div>

            <div className="hero-right">
              <p className="lead">
                I am a Master of Applied Data Science candidate at the
                University of Michigan, Ann Arbor, and hold a BS in Electrical
                and Computer Engineering from Rutgers University.
              </p>
              <p>
                My journey involves bridging the gap between high-performance
                systems engineering and cutting-edge deep learning research. I
                specialize in developing scalable AI architectures and
                multi-agent systems.
              </p>
              <blockquote>
                The transition from optimizing high-performance engineering
                systems to questioning the fundamental mechanics of AI agents
                represents my current intellectual trajectory.
              </blockquote>
              <a href="mailto:sachin.s.ganpule@gmail.com" className="cta">
                Get in touch
              </a>
            </div>
          </div>
        </section>

        <section className="status-bar">
          <div className="container status-content">
            <p className="eyebrow">Status</p>
            <p>Developing multi-agent research pipelines at scale.</p>
          </div>
        </section>

        <section id="inquiry" className="section">
          <div className="container">
            <p className="eyebrow">01</p>
            <h2>Areas of inquiry</h2>
            <div className="inquiry-grid">
              <article className="panel">
                <h3>Core skills and focus</h3>
                <div className="chip-grid">
                  <span>PyTorch</span>
                  <span>HuggingFace Transformers</span>
                  <span>RAG</span>
                  <span>Vector DBs (FAISS)</span>
                  <span>QLoRA</span>
                  <span>CrewAI</span>
                  <span>LangGraph</span>
                  <span>Kubernetes</span>
                </div>
                <p>
                  Focusing on the convergence of multi-agent systems, LLM
                  optimization (quantization and fine-tuning), and robust MLOps
                  infrastructure.
                </p>
              </article>
              <article className="panel">
                <h3>Interests</h3>
                <ul className="interest-list">
                  <li>Agentic workflows</li>
                  <li>Alignment and AI safety</li>
                  <li>AI inspired by biology</li>
                  <li>Inference engineering</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="reading" className="section section-soft">
          <div className="container">
            <p className="eyebrow">02</p>
            <h2>Reading archive</h2>
            <div className="stack">
              {readingArchive.map((item) => (
                <article className="reading-item" key={item.title}>
                  <p className="reading-date">{item.date}</p>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="chip">{item.status}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="projects" className="section">
          <div className="container">
            <p className="eyebrow">03</p>
            <h2>Selected projects</h2>
            <div className="project-grid">
              {projects.map((project) => (
                <article className="project-card" key={project.title}>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <div className="chip-grid">
                    {project.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft">
          <div className="container">
            <article className="twin-panel">
              <p className="eyebrow">Experimental</p>
              <h2>Project: Digital Twin</h2>
              <p>
                Ask questions about my career. The assistant uses retrieval
                from resume and LinkedIn documents before generating answers.
              </p>

              <div className="chat-shell">
                <div className="chat-log" aria-live="polite">
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
                  <textarea
                    value={questionInput}
                    onChange={(event) => setQuestionInput(event.target.value)}
                    placeholder="Ask about experience, projects, or career goals..."
                    rows={3}
                    disabled={isAsking}
                  />
                  <div className="twin-actions">
                    <button type="submit" disabled={isAsking}>
                      {isAsking ? "Answering..." : "Ask Digital Twin"}
                    </button>
                    <span>RAG over resume + LinkedIn</span>
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
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <p>Sachin Ganpule</p>
          <a href="mailto:sachin.s.ganpule@gmail.com">
            sachin.s.ganpule@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
