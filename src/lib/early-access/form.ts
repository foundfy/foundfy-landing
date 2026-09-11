import { normalizeDomainInput } from "@/lib/analysis/domain";
import { isValidEarlyAccessEmail } from "./validation";

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
