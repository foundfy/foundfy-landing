import type { Locale } from "@/lib/i18n/locales";
import { EN_LANDING_COPY } from "./en";
import { ES_LANDING_COPY } from "./es";
import type { LandingCopy } from "./types";

const LANDING_COPY: Record<Locale, LandingCopy> = {
  en: EN_LANDING_COPY,
  es: ES_LANDING_COPY,
};

export function getLandingCopy(locale: Locale): LandingCopy {
  return LANDING_COPY[locale];
}

export type { LandingCopy, EarlyAccessFormCopy, EarlyAccessText } from "./types";
