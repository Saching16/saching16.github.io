"use client";

import { useState } from "react";

const NAV_ITEMS = [
  { href: "#inquiry", label: "Areas of inquiry" },
  { href: "#reading", label: "Reading archive" },
  { href: "#projects", label: "Projects" },
  { href: "/resume.pdf", label: "Resume" },
  { href: "mailto:sachin.s.ganpule@gmail.com", label: "Contact" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  function handleNavClick() {
    setIsOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container nav-row">
        <a href="#" className="brand">
          Sachin Ganpule
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="sr-only">Toggle navigation menu</span>
          {isOpen ? "Close" : "Menu"}
        </button>

        <nav
          id="primary-navigation"
          className={`nav-links ${isOpen ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={handleNavClick}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
