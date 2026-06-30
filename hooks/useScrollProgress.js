"use client";

import { useEffect, useState } from "react";

function computeProgress() {
  const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (pageHeight <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, window.scrollY / pageHeight));
}

export function useScrollProgress() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let rafId = null;

    const update = () => {
      setScrollProgress(computeProgress());
      rafId = null;
    };

    const onScroll = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return scrollProgress;
}
