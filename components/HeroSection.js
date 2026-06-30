import Image from "next/image";
import profilePhoto from "../assets/profile.png";

export function HeroSection() {
  return (
    <section className="hero section">
      <div className="container hero-grid">
        <div className="hero-left">
          <div className="portrait-frame">
            <Image
              src={profilePhoto}
              alt="Portrait of Sachin Ganpule wearing a tan sweater and white collared shirt with autumn trees in the background."
              className="portrait"
              width={384}
              height={384}
              priority
            />
          </div>
          <div>
            <p className="eyebrow">Research archive</p>
            <h1>Sachin Ganpule</h1>
          </div>
        </div>

        <div className="hero-right">
          <p className="lead">
            I am a Master of Applied Data Science candidate at the University of
            Michigan and an AI intern working on applied RAG, forecasting, and
            agent systems.
          </p>
          <p>
            My work bridges production AI engineering with research on agents and
            latent space reasoning. I build retrieval systems, multi-agent
            workflows, and backend infrastructure that can move from prototype to
            reliable deployment.
          </p>
          <blockquote>
            I am especially interested in how agents can coordinate through
            latent representations, recursive decomposition, and measurable
            observability rather than only visible text traces.
          </blockquote>
          <div className="hero-actions">
            <a href="mailto:sachin.s.ganpule@gmail.com" className="cta">
              Get in touch
            </a>
            <a href="/resume.pdf" className="cta cta-secondary">
              Download resume
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
