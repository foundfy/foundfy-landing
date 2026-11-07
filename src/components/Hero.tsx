import Link from "next/link";
import Logo from "./Logo";
import Reveal from "./Reveal";
import WebsiteAnalysisEntry from "./hero/WebsiteAnalysisEntry";
import styles from "./Hero.module.css";

const navLinks = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/resources", label: "Resources" },
];

const proof = [
  "Google search",
  "AI search",
  "Content opportunities",
  "Technical actions",
];

function RollingLabel({ text }: { text: string }) {
  const letters = Array.from(text);

  return (
    <span className={styles.roll}>
      <span className={styles.rollLabel}>{text}</span>
      <span className={styles.rollChars} aria-hidden="true">
        {letters.map((char, index) => (
          <span
            key={`${char}-${index}`}
            className={styles.rollChar}
            style={{ transitionDelay: `${(0.14 / letters.length) * index}s` }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    </span>
  );
}

function HeadlineWords({
  text,
  className,
  start,
}: {
  text: string;
  className: string;
  start: number;
}) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={styles.word}
          style={{ animationDelay: `${start + index * 0.06}s` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function ProofCheck() {
  return (
    <svg
      className={styles.proofIcon}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="#ff5b22" strokeWidth="2" />
      <path
        d="M9 12 11 14 15 10"
        fill="none"
        stroke="#ff5b22"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgImage} />
        <div className={styles.bgGlowPrimary} />
        <div className={styles.bgGlowSecondary} />
        <div className={styles.bgOverlay} />
      </div>

      <div className={styles.grid}>
        <Reveal>
          <header className={styles.header}>
            <Logo variant="light" className={styles.logo} />
            <nav className={styles.nav} aria-label="Primary">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={styles.navLink}>
                  <RollingLabel text={link.label} />
                </Link>
              ))}
            </nav>
            <div className={styles.headerActions}>
              <Link href="/sign-in" className={styles.signIn}>
                <RollingLabel text="Sign in" />
              </Link>
              <a href="#early-access" className={styles.getStarted}>
                <RollingLabel text="Get started" />
              </a>
            </div>
          </header>
        </Reveal>

        <div className={styles.mainReveal}>
          <div className={styles.main}>
            <div className={styles.content}>
              <Reveal delay={100} distance={18}>
                <Link href="/changelog" className={styles.announcement}>
                  <span className={styles.announcementBadge}>New</span>
                  <span className={styles.announcementText}>
                    Execute and verify approved changes
                  </span>
                  <svg
                    className={styles.announcementChevron}
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3.5 10.5 8 6 12.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </Reveal>

              <h1 className={styles.headline}>
                <HeadlineWords
                  text="Be found wherever"
                  className={styles.firstLine}
                  start={0.1}
                />
                <br />
                <HeadlineWords
                  text="people search."
                  className={styles.highlight}
                  start={0.28}
                />
              </h1>

              <Reveal delay={450} distance={18}>
                <p className={styles.description}>
                  A simpler way to understand your search visibility{" "}
                  <br className={styles.descriptionBreak} />
                  and make the right changes happen.
                </p>
              </Reveal>

              <Reveal delay={600} distance={18}>
                <WebsiteAnalysisEntry />
              </Reveal>

              <Reveal delay={720} distance={18}>
                <p className={styles.offer}>
                  Free for one website
                  <span className={styles.offerDot} aria-hidden="true">
                    ·
                  </span>
                  Up to 10 pages
                  <span className={styles.offerDot} aria-hidden="true">
                    ·
                  </span>
                  No credit card required
                </p>
              </Reveal>

              <Reveal delay={800} distance={18}>
                <ul className={styles.proof}>
                  {proof.map((item) => (
                    <li key={item}>
                      <ProofCheck />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>

        <Reveal delay={900} distance={18}>
          <div className={styles.bottom}>
            <div className={styles.scroll}>
              <span>Scroll</span>
              <span className={styles.scrollLine} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
