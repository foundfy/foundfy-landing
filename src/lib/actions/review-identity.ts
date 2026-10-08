import {
  CANONICAL_ELSEWHERE_RULE_KEY,
  supportedReviewTypeForDecision,
} from "@/lib/decisions/supported-action";
import type { DecisionRecord } from "@/lib/decisions/types";
import type { CanonicalReviewIdentity, CanonicalReviewRecord } from "./review-types";
import type { ReviewCurrency } from "./review-types";

export type CanonicalReviewObservation = {
  id: string;
  pageId: string | null;
  pageUrl: string | null;
  crawlRunId: string;
  ruleKey: string;
  status: string;
  evidence: Record<string, unknown>;
};

export type CanonicalReviewPage = {
  id: string;
  crawlRunId: string;
  requestedUrl: string;
  finalUrl: string;
  canonical: string | null;
};

function evidenceString(evidence: Record<string, unknown>, key: string): string | null {
  const value = evidence[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

export function canonicalObservationRefs(
  decision: Pick<DecisionRecord, "evidenceRefs">,
): Array<{ recordId: string; snapshot: Record<string, unknown> }> {
  return decision.evidenceRefs
    .filter((ref) => ref.kind === "observation")
    .filter((ref) => ref.snapshot.ruleKey === CANONICAL_ELSEWHERE_RULE_KEY)
    .map((ref) => ({ recordId: ref.recordId, snapshot: ref.snapshot }))
    .sort((a, b) => a.recordId.localeCompare(b.recordId));
}

export function resolveCanonicalReviewIdentity(input: {
  observation: CanonicalReviewObservation;
  page: CanonicalReviewPage | null;
}): CanonicalReviewIdentity | null {
  if (input.observation.status !== "active") {
    return null;
  }

  if (input.observation.ruleKey !== CANONICAL_ELSEWHERE_RULE_KEY) {
    return null;
  }

  const requestedUrl =
    nonEmpty(input.page?.requestedUrl) ?? evidenceString(input.observation.evidence, "requestedUrl");
  const finalUrl =
    nonEmpty(input.page?.finalUrl) ?? evidenceString(input.observation.evidence, "finalUrl");
  const canonicalUrl =
    evidenceString(input.observation.evidence, "canonical") ?? nonEmpty(input.page?.canonical);
  const pageUrl = nonEmpty(input.observation.pageUrl) ?? finalUrl ?? requestedUrl;
  const crawlRunId = nonEmpty(input.page?.crawlRunId) ?? nonEmpty(input.observation.crawlRunId);

  if (!requestedUrl || !finalUrl || !canonicalUrl || !pageUrl || !crawlRunId) {
    return null;
  }

  return {
    observationId: input.observation.id,
    pageId: input.page?.id ?? input.observation.pageId,
    crawlRunId,
    pageUrl,
    requestedUrl,
    finalUrl,
    canonicalUrl,
  };
}

export function reviewMatchesRelationship(
  review: Pick<CanonicalReviewRecord, "pageUrl" | "requestedUrl" | "finalUrl" | "canonicalUrl">,
  identity: CanonicalReviewIdentity,
): boolean {
  return (
    review.pageUrl === identity.pageUrl &&
    review.requestedUrl === identity.requestedUrl &&
    review.finalUrl === identity.finalUrl &&
    review.canonicalUrl === identity.canonicalUrl
  );
}

export function reviewMatchesPageIdentity(
  review: Pick<CanonicalReviewRecord, "pageUrl" | "requestedUrl" | "finalUrl">,
  identity: CanonicalReviewIdentity,
): boolean {
  return (
    review.pageUrl === identity.pageUrl &&
    review.requestedUrl === identity.requestedUrl &&
    review.finalUrl === identity.finalUrl
  );
}

export function reviewCurrencyForIdentity(
  review: Pick<CanonicalReviewRecord, "pageUrl" | "requestedUrl" | "finalUrl" | "canonicalUrl">,
  identity: CanonicalReviewIdentity | null,
): ReviewCurrency {
  if (!identity || !reviewMatchesRelationship(review, identity)) {
    return "stale";
  }

  return "current";
}

export function liveIdentityForReview(
  review: Pick<CanonicalReviewRecord, "pageUrl" | "requestedUrl" | "finalUrl" | "canonicalUrl">,
  identities: CanonicalReviewIdentity[],
): CanonicalReviewIdentity | null {
  return identities.find((identity) => reviewMatchesRelationship(review, identity)) ?? null;
}

export function latestReviewForIdentity(
  reviews: CanonicalReviewRecord[],
  identity: CanonicalReviewIdentity,
  decisionId: string,
): CanonicalReviewRecord | null {
  const current = reviews.find((review) => reviewMatchesRelationship(review, identity));
  if (current) {
    return current;
  }

  return (
    reviews.find((review) => reviewMatchesPageIdentity(review, identity)) ??
    reviews.find((review) => review.decisionId === decisionId) ??
    null
  );
}

export function decisionSupportsCanonicalReview(
  decision: Pick<DecisionRecord, "decisionType" | "evidenceRefs">,
): boolean {
  return supportedReviewTypeForDecision(decision) === "review_canonical_target";
}
