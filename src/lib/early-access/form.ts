import type { AnalysisPhase } from "@/contexts/AnalysisContext";
import { normalizeDomainInput } from "@/lib/analysis/domain";
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
}): EarlyAccessCopy {
  const { analyzedHostname } = input;
  const defaultCopy: EarlyAccessCopy = {
    heading: "Tell us a bit about yourself.",
    body: "Join the early access list and help shape what's next. We're building Foundfy with the people who'll use it most.",
    successHeadline: "YOU'RE EARLY.",
    successSubline: "We'll let you know when there's more to discover.",
  };

  if (!analyzedHostname) {
    return defaultCopy;
  }

  const submittedAnalyzedSite =
    input.submittedWebsite.trim().toLowerCase() ===
    analyzedHostname.toLowerCase();

  return {
    heading: `Let's work on ${analyzedHostname}.`,
    body: "Answer a few quick questions and we'll get back to you by email about next steps.",
    successHeadline: defaultCopy.successHeadline,
    successSubline: submittedAnalyzedSite
      ? `We'll email you about ${analyzedHostname}.`
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

export function getWebsiteStepError(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) {
    return null;
  }

  if (normalizeDomainInput(trimmed)) {
    return null;
  }

  return "Enter a valid website, or leave this blank.";
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
