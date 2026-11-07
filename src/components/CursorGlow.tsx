"use client";

import { useEffect } from "react";

const CARD = "[data-cursor-glow-card]";

function place(element: HTMLElement, x: number, y: number) {
  const rect = element.getBoundingClientRect();
  element.style.setProperty("--mx", `${x - rect.left}px`);
  element.style.setProperty("--my", `${y - rect.top}px`);
}

/**
 * Tracks the pointer so cards and the crawl field can paint an orange
 * spotlight at the cursor.
 */
export default function CursorGlow() {
  useEffect(() => {
    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!finePointer || reduceMotion) return;

    let activeCard: HTMLElement | null = null;

    const clear = (element: HTMLElement | null) => {
      element?.classList.remove("is-glowing");
    };

    const onMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const card = event.target.closest(CARD);

      if (card !== activeCard) {
        clear(activeCard);
        activeCard = card instanceof HTMLElement ? card : null;
        activeCard?.classList.add("is-glowing");
      }

      if (activeCard) place(activeCard, event.clientX, event.clientY);
    };

    const onLeave = () => {
      clear(activeCard);
      activeCard = null;
    };

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onLeave();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", onLeave);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", onLeave);
      onLeave();
    };
  }, []);

  return null;
}

export function CursorGlowSurface() {
  return (
    <>
      <span className="cursorGlowFill" aria-hidden="true" />
      <span className="cursorGlowEdge" aria-hidden="true" />
    </>
  );
}
