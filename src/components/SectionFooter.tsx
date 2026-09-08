import Logo from "./Logo";

interface SectionFooterProps {
  variant: "light" | "dark";
  text: string;
}

export default function SectionFooter({ variant, text }: SectionFooterProps) {
  return (
    <div
      className={`section-footer section-footer--${variant === "dark" ? "dark" : "light"}`}
    >
      <Logo variant={variant === "dark" ? "light" : "dark"} />
      <p className="section-footer__text">{text}</p>
    </div>
  );
}
