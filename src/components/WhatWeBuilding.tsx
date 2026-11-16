import Logo from "./Logo";
import Reveal from "./Reveal";
import { CursorGlowSurface } from "./CursorGlow";
import {
  IconFind,
  IconUnderstand,
  IconImprove,
  IconStayAhead,
} from "./WhatWeBuildingIcons";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./WhatWeBuilding.module.css";

const featureDelays = [0, 100, 160, 240];

const featureIcons = [IconFind, IconUnderstand, IconImprove, IconStayAhead];

export default function WhatWeBuilding({
  copy,
  a11y,
}: {
  copy: LandingCopy["whatWeBuilding"];
  a11y: LandingCopy["a11y"];
}) {
  const features = copy.features.map((feature, index) => ({
    ...feature,
    icon: featureIcons[index],
  }));

  return (
    <section id={copy.sectionId} className={styles.section}>
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 className={styles.heading}>
              {copy.heading[0]}
              <br />
              {copy.heading[1]}
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={100}>
            <p>{copy.supporting}</p>
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
            <Logo variant="dark" href={a11y.logoHref} label={a11y.logoLabel} />
            <p className={styles.footerText}>
              {copy.footer[0]}
              <br />
              {copy.footer[1]}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
