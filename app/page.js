"use client";

import { useMemo } from "react";
import { DigitalTwinChat } from "../components/DigitalTwinChat";
import { HeroSection } from "../components/HeroSection";
import { SiteHeader } from "../components/SiteHeader";
import { PROJECTS } from "../data/projects";
import { READING_ARCHIVE } from "../data/readingArchive";
import { useScrollProgress } from "../hooks/useScrollProgress";

export default function HomePage() {
  const scrollProgress = useScrollProgress();

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

  return (
    <div className="site-shell" style={backgroundStyle}>
      <SiteHeader />

      <main id="main-content">
        <HeroSection />

        <section className="status-bar">
          <div className="container status-content">
            <p className="eyebrow">Status</p>
            <p>
              Building applied RAG and forecasting systems while researching
              latent delegation in recursive agent harnesses.
            </p>
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
                  <span>HuggingFace</span>
                  <span>RAG</span>
                  <span>Azure AI Search</span>
                  <span>pgvector / HNSW</span>
                  <span>QLoRA</span>
                  <span>OpenAI Agents SDK</span>
                  <span>LangGraph</span>
                  <span>LangFuse</span>
                  <span>Kubernetes</span>
                </div>
                <p>
                  Focusing on production-grade AI systems: hybrid retrieval,
                  semantic caching, multi-agent orchestration, observability,
                  and infrastructure that can support research experiments.
                </p>
              </article>
              <article className="panel">
                <h3>Interests</h3>
                <ul className="interest-list">
                  <li>Latent space reasoning</li>
                  <li>LatentMAS</li>
                  <li>RecursiveMAS</li>
                  <li>Agent observability</li>
                  <li>Retrieval and memory systems</li>
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
              {READING_ARCHIVE.map((item) => (
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
            <h2>Featured projects</h2>
            <div className="project-grid">
              {PROJECTS.map((project) => (
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
        <DigitalTwinChat />
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
