import Logo from "./Logo";
import Reveal from "./Reveal";
import {
  IconFind,
  IconUnderstand,
  IconImprove,
  IconStayAhead,
} from "./WhatWeBuildingIcons";
import styles from "./WhatWeBuilding.module.css";

const features = [
  {
    icon: IconFind,
    label: "Find",
    description: "See what's holding you back.",
  },
  {
    icon: IconUnderstand,
    label: "Understand",
    description: "Know what matters and why.",
  },
  {
    icon: IconImprove,
    label: "Improve",
    description: "Turn insights into action.",
  },
  {
    icon: IconStayAhead,
    label: "Stay ahead",
    description: "Keep up with search as it changes.",
  },
];

export default function WhatWeBuilding() {
  return (
    <section className={styles.section}>
      <Reveal className={styles.grid}>
        <p className={styles.eyebrow}>What we&apos;re building</p>

        <div className={styles.intro}>
          <h2 className={styles.heading}>
            Know what matters.
            <br />
            Know what to do next.
          </h2>
          <p className={styles.supporting}>
            Foundfy understands your search presence, finds what matters, and
            turns it into clear actions — without the SEO overwhelm.
          </p>
        </div>

        <div className={styles.features}>
          {features.map(({ icon: Icon, label, description }) => (
            <div key={label} className={styles.feature}>
              <Icon className={styles.featureIcon} />
              <h3 className={styles.featureLabel}>{label}</h3>
              <p className={styles.featureDesc}>{description}</p>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <Logo variant="dark" />
          <p className={styles.footerText}>
            Search changes.
            <br />
            Foundfy changes with it.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
