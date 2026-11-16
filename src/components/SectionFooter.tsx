import Logo from "./Logo";

interface SectionFooterProps {
  variant: "light" | "dark";
  text: string;
  logoHref?: string;
  logoLabel?: string;
}

export default function SectionFooter({
  variant,
  text,
  logoHref,
  logoLabel,
}: SectionFooterProps) {
  return (
    <div
      className={`section-footer section-footer--${variant === "dark" ? "dark" : "light"}`}
    >
      <Logo
        variant={variant === "dark" ? "light" : "dark"}
        href={logoHref}
        label={logoLabel}
      />
      <p className="section-footer__text">{text}</p>
    </div>
  );
}
