import { Fragment } from "react";
import Link from "next/link";
import Logo from "./Logo";
import Reveal from "./Reveal";
import WebsiteAnalysisEntry from "./hero/WebsiteAnalysisEntry";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./Hero.module.css";

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

export default function Hero({
  copy,
  a11y,
}: {
  copy: LandingCopy["hero"];
  a11y: LandingCopy["a11y"];
}) {
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
            <Logo
              variant="light"
              className={styles.logo}
              href={a11y.logoHref}
              label={a11y.logoLabel}
            />
            <nav className={styles.nav} aria-label={a11y.primaryNav}>
              {copy.navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={styles.navLink}>
                  <RollingLabel text={link.label} />
                </Link>
              ))}
            </nav>
            <div className={styles.headerActions}>
              {copy.signIn ? (
                <Link href={copy.signIn.href} className={styles.signIn}>
                  <RollingLabel text={copy.signIn.label} />
                </Link>
              ) : null}
              <a href={copy.getStarted.href} className={styles.getStarted}>
                <RollingLabel text={copy.getStarted.label} />
              </a>
            </div>
          </header>
        </Reveal>

        <div className={styles.mainReveal}>
          <div className={styles.main}>
            <div className={styles.content}>
              <Reveal delay={100} distance={18}>
                <Link href={copy.announcement.href} className={styles.announcement}>
                  <span className={styles.announcementBadge}>{copy.announcement.badge}</span>
                  <span className={styles.announcementText}>
                    {copy.announcement.text}
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
                  text={copy.headline.firstLine}
                  className={styles.firstLine}
                  start={0.1}
                />
                <br />
                <HeadlineWords
                  text={copy.headline.highlight}
                  className={styles.highlight}
                  start={0.28}
                />
              </h1>

              <Reveal delay={450} distance={18}>
                <p className={styles.description}>
                  {copy.description.lead}{" "}
                  <br className={styles.descriptionBreak} />
                  {copy.description.tail}
                </p>
              </Reveal>

              <Reveal delay={600} distance={18}>
                <WebsiteAnalysisEntry />
              </Reveal>

              <Reveal delay={720} distance={18}>
                <p className={styles.offer}>
                  {copy.offer.map((item, index) => (
                    <Fragment key={item}>
                      {index > 0 ? (
                        <span className={styles.offerDot} aria-hidden="true">
                          ·
                        </span>
                      ) : null}
                      {item}
                    </Fragment>
                  ))}
                </p>
              </Reveal>

              <Reveal delay={800} distance={18}>
                <ul className={styles.proof}>
                  {copy.proof.map((item) => (
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
              <span>{copy.scroll}</span>
              <span className={styles.scrollLine} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
