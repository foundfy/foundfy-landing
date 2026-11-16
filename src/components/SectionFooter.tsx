import Logo from "./Logo";

interface SectionFooterProps {
  variant: "light" | "dark";
  text: string;
  /** false: tagline only, left-aligned (no logo right above the page footer's logo). */
  showLogo?: boolean;
  logoHref?: string;
  logoLabel?: string;
}

export default function SectionFooter({
  variant,
  text,
  showLogo = true,
  logoHref,
  logoLabel,
}: SectionFooterProps) {
  return (
    <div
      className={`section-footer section-footer--${variant === "dark" ? "dark" : "light"}${
        showLogo ? "" : " section-footer--text-only"
      }`}
    >
      {showLogo ? (
        <Logo
          variant={variant === "dark" ? "light" : "dark"}
          href={logoHref}
          label={logoLabel}
        />
      ) : null}
      <p className="section-footer__text">{text}</p>
    </div>
  );
}
