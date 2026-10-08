import type { DecisionEvidenceKind } from "@/lib/decisions/types";
import type { SupportedReviewType } from "@/lib/decisions/supported-action";

export const CANONICAL_REVIEW_OUTCOMES = ["intentional", "needs_change", "unsure"] as const;
export type CanonicalReviewOutcome = (typeof CANONICAL_REVIEW_OUTCOMES)[number];

export const REVIEW_CURRENCIES = ["current", "stale"] as const;
export type ReviewCurrency = (typeof REVIEW_CURRENCIES)[number];

export type CanonicalReviewEvidenceRef = {
  kind: DecisionEvidenceKind;
  recordId: string;
  snapshot: Record<string, unknown>;
};

export type CanonicalReviewIdentity = {
  observationId: string;
  pageId: string | null;
  crawlRunId: string;
  pageUrl: string;
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
};

export type CanonicalReviewRecord = {
  id: string;
  websiteId: string;
  reviewType: SupportedReviewType;
  outcome: CanonicalReviewOutcome;
  ownerId: string;
  reviewedAt: string;
  decisionId: string | null;
  decisionRunId: string | null;
  observationId: string;
  pageId: string | null;
  crawlRunId: string;
  gscSyncId: string | null;
  siteModelId: string;
  goalId: string;
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  pageUrl: string;
  createdAt: string;
  evidenceRefs: CanonicalReviewEvidenceRef[];
};

export type CanonicalReviewView = {
  id: string;
  reviewType: SupportedReviewType;
  outcome: CanonicalReviewOutcome;
  currency: ReviewCurrency;
  pageUrl: string;
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  observationId: string;
  pageId: string | null;
  crawlRunId: string;
  decisionId: string | null;
  decisionRunId: string | null;
  reviewedAt: string;
  createdAt: string;
};

export type CanonicalReviewTargetView = {
  decisionId: string;
  identity: CanonicalReviewIdentity;
  review: CanonicalReviewView | null;
};

export function isCanonicalReviewOutcome(value: unknown): value is CanonicalReviewOutcome {
  return (
    value === "intentional" ||
    value === "needs_change" ||
    value === "unsure"
  );
}
