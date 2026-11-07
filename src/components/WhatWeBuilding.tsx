import Logo from "./Logo";
import Reveal from "./Reveal";
import { CursorGlowSurface } from "./CursorGlow";
import {
  IconFind,
  IconUnderstand,
  IconImprove,
  IconStayAhead,
} from "./WhatWeBuildingIcons";
import styles from "./WhatWeBuilding.module.css";

const featureDelays = [0, 100, 160, 240];

const features = [
  {
    icon: IconFind,
    label: "Find",
    description: "See what's holding you back.",
    detail: "Crawl your site and uncover what's blocking visibility.",
  },
  {
    icon: IconUnderstand,
    label: "Understand",
    description: "Know what matters and why.",
    detail: "Combine site evidence with search data to see what matters.",
  },
  {
    icon: IconImprove,
    label: "Improve",
    description: "Turn priorities into approved changes.",
    detail: "Preview, approve, and move the right changes forward.",
  },
  {
    icon: IconStayAhead,
    label: "Stay ahead",
    description: "Verify what changed and keep adapting.",
    detail: "Recheck, verify, and keep adapting as search changes.",
  },
];

export default function WhatWeBuilding() {
  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>How Foundfy works</p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 className={styles.heading}>
              Know what matters.
              <br />
              Know what to do next.
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={100}>
            <p>
              Foundfy reviews your website, finds what matters, and turns
              search signals into clear actions you can move forward with.
            </p>
          </Reveal>
        </div>

        <div className={styles.features}>
          {features.map(({ icon: Icon, label, description, detail }, index) => (
            <Reveal
              key={label}
              className={styles.feature}
              delay={featureDelays[index]}
              data-cursor-glow-card
            >
              <CursorGlowSurface />
              <Icon className={styles.featureIcon} />
              <h3 className={styles.featureLabel}>{label}</h3>
              <p className={styles.featureDesc}>{description}</p>
              <p className={styles.featureDetail}>{detail}</p>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className={styles.footer}>
            <Logo variant="dark" />
            <p className={styles.footerText}>
              Search changes.
              <br />
              Foundfy changes with it.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
