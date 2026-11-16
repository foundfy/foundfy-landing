import type { AnalysisPhase } from "@/contexts/AnalysisContext";
import { normalizeDomainInput } from "@/lib/analysis/domain";
import { EN_LANDING_COPY } from "@/lib/i18n/landing/en";
import { formatHostTemplate } from "@/lib/i18n/format";
import type { EarlyAccessText } from "@/lib/i18n/landing/types";
import { isValidEarlyAccessEmail } from "./validation";

export function resolveAnalyzedHostname(input: {
  phase: AnalysisPhase;
  hostname: string | null | undefined;
}): string | null {
  if (input.phase !== "completed") {
    return null;
  }

  const hostname = input.hostname?.trim();
  return hostname ? hostname : null;
}

export function resolveWebsitePrefill(input: {
  website: string;
  analyzedHostname: string | null;
}): string {
  if (input.website.trim() || !input.analyzedHostname) {
    return input.website;
  }

  return input.analyzedHostname;
}

export type EarlyAccessCopy = {
  heading: string;
  body: string;
  successHeadline: string;
  successSubline: string;
};

export function getEarlyAccessCopy(input: {
  analyzedHostname: string | null;
  submittedWebsite: string;
  text?: EarlyAccessText;
}): EarlyAccessCopy {
  const { analyzedHostname } = input;
  const text = input.text ?? EN_LANDING_COPY.earlyAccess.text;
  const defaultCopy: EarlyAccessCopy = {
    heading: text.heading,
    body: text.body,
    successHeadline: text.successHeadline,
    successSubline: text.successSubline,
  };

  if (!analyzedHostname) {
    return defaultCopy;
  }

  const submittedAnalyzedSite =
    input.submittedWebsite.trim().toLowerCase() ===
    analyzedHostname.toLowerCase();

  return {
    heading: formatHostTemplate(text.personalizedHeading, analyzedHostname),
    body: text.personalizedBody,
    successHeadline: defaultCopy.successHeadline,
    successSubline: submittedAnalyzedSite
      ? formatHostTemplate(text.personalizedSuccessSubline, analyzedHostname)
      : defaultCopy.successSubline,
  };
}

export function resolveWebsiteStepAdvance(input: {
  website: string;
  isTransitioning: boolean;
}): "advance" | "block" {
  if (input.isTransitioning) {
    return "block";
  }

  const trimmed = input.website.trim();
  if (!trimmed) {
    return "advance";
  }

  return normalizeDomainInput(trimmed) ? "advance" : "block";
}

export function resolveWebsiteStepKeyDown(input: {
  key: string;
  website: string;
  isTransitioning: boolean;
}): "advance" | "block" | "ignore" {
  if (input.key !== "Enter") {
    return "ignore";
  }

  return resolveWebsiteStepAdvance(input);
}

export function getWebsiteStepError(
  website: string,
  message: string = EN_LANDING_COPY.earlyAccess.errors.websiteInvalid,
): string | null {
  const trimmed = website.trim();
  if (!trimmed) {
    return null;
  }

  if (normalizeDomainInput(trimmed)) {
    return null;
  }

  return message;
}

export function resolveEmailStepSubmit(input: {
  email: string;
  isSubmitting: boolean;
  isTransitioning: boolean;
}): "submit" | "ignore" {
  if (input.isSubmitting || input.isTransitioning) {
    return "ignore";
  }

  if (!isValidEarlyAccessEmail(input.email)) {
    return "ignore";
  }

  return "submit";
}
