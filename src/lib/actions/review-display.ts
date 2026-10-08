import type { CanonicalReviewOutcome, ReviewCurrency } from "./review-types";

export const CANONICAL_REVIEW_LABEL = "Review canonical";
export const CANONICAL_REVIEW_PAGE_HEADING = "Page being reviewed";
export const CANONICAL_REVIEW_CANONICAL_HEADING = "Current canonical";
export const CANONICAL_REVIEW_WHY_HEADING = "Why Foundfy flagged it";
export const CANONICAL_REVIEW_WHY_COPY =
  "Google may treat the canonical target as the preferred version of this page.";
export const CANONICAL_REVIEW_DECIDE_HEADING = "What to decide";
export const CANONICAL_REVIEW_DECIDE_COPY =
  "Confirm whether this canonical target is intentional.";
export const CANONICAL_REVIEW_ERROR_COPY = "Foundfy couldn't save this review right now.";
export const CANONICAL_REVIEW_STALE_COPY =
  "This review applied to a previous canonical relationship. The current evidence needs a new review.";

export const CANONICAL_REVIEW_OUTCOME_LABELS: Record<CanonicalReviewOutcome, string> = {
  intentional: "Looks intentional",
  needs_change: "Needs changing",
  unsure: "Not sure",
};

export const CANONICAL_REVIEW_STATUS_LABELS: Record<CanonicalReviewOutcome, string> = {
  intentional: "Reviewed: intentional",
  needs_change: "Reviewed: needs changing",
  unsure: "Reviewed: not sure",
};

export function canonicalReviewStatusLabel(
  outcome: CanonicalReviewOutcome,
  currency: ReviewCurrency,
): string {
  const status = CANONICAL_REVIEW_STATUS_LABELS[outcome];
  return currency === "stale" ? `${status} (previous evidence)` : status;
}
