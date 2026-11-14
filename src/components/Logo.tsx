"use client";

import styles from "./Logo.module.css";

interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
  href?: string;
  label?: string;
}

export default function Logo({
  variant = "light",
  className = "",
  href = "/",
  label = "Foundfy — refresh page",
}: LogoProps) {
  return (
    <a
      href={href}
      className={`${styles.logo} ${styles.link} ${styles[variant]} ${className}`}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        window.location.reload();
      }}
    >
      foundfy<span className={styles.dot}>.</span>
    </a>
  );
}
