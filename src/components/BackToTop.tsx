"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./BackToTop.module.css";

const BOTTOM_THRESHOLD = 96;

// The button only makes sense when the page scrolls further than the threshold.
// On short pages it would show immediately and sit over the footer links.
function isScrollablePage(): boolean {
  return document.documentElement.scrollHeight - window.innerHeight > BOTTOM_THRESHOLD;
}

export default function BackToTop({ label = "Back to top" }: { label?: string }) {
  const [visible, setVisible] = useState(false);
  // Re-check after client-side navigation: the new page may be shorter or longer.
  const pathname = usePathname();

  useEffect(() => {
    const updateVisibility = () => {
      const scrollBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - BOTTOM_THRESHOLD;

      setVisible(isScrollablePage() && scrollBottom);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [pathname]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      className={`${styles.backToTop} ${visible ? styles.visible : ""}`}
      onClick={scrollToTop}
      aria-label={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      {label} ↑
    </button>
  );
}
