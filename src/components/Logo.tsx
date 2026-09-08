"use client";

import styles from "./Logo.module.css";

interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
}

export default function Logo({ variant = "light", className = "" }: LogoProps) {
  return (
    <a
      href="/"
      className={`${styles.logo} ${styles.link} ${styles[variant]} ${className}`}
      aria-label="Foundfy — refresh page"
      onClick={(event) => {
        event.preventDefault();
        window.location.reload();
      }}
    >
      foundfy<span className={styles.dot}>.</span>
    </a>
  );
}
