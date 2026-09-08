import styles from "./Logo.module.css";

interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
}

export default function Logo({ variant = "light", className = "" }: LogoProps) {
  return (
    <span
      className={`${styles.logo} ${styles[variant]} ${className}`}
      aria-label="Foundfy"
    >
      foundfy<span className={styles.dot}>.</span>
    </span>
  );
}
