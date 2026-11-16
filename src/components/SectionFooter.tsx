interface SectionFooterProps {
  variant: "light" | "dark";
  text: string;
}

// Divider plus tagline at the end of a section. It has no logo: the page footer
// right below already shows one, and the free right side keeps the fixed
// "Back to top" button from covering the tagline.
export default function SectionFooter({ variant, text }: SectionFooterProps) {
  return (
    <div
      className={`section-footer section-footer--${variant === "dark" ? "dark" : "light"}`}
    >
      <p className="section-footer__text">{text}</p>
    </div>
  );
}
