import { findDecisionById, findDecisionRunById, findLatestCompletedDecisionRun, listDecisionsForRun } from "@/lib/decisions/db";
import type { DecisionRecord } from "@/lib/decisions/types";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { ActionError } from "./types";
import {
  canonicalObservationRefs,
  decisionSupportsCanonicalReview,
  latestReviewForIdentity,
  liveIdentityForReview,
  resolveCanonicalReviewIdentity,
  reviewCurrencyForIdentity,
  type CanonicalReviewObservation,
  type CanonicalReviewPage,
} from "./review-identity";
import {
  findCanonicalReviewObservation,
  findCanonicalReviewPage,
  insertCanonicalReview,
  listCanonicalReviewsForWebsite,
} from "./review-db";
import {
  isCanonicalReviewOutcome,
  type CanonicalReviewIdentity,
  type CanonicalReviewRecord,
  type CanonicalReviewTargetView,
  type CanonicalReviewView,
} from "./review-types";

async function resolveLiveIdentity(
  decision: DecisionRecord,
): Promise<CanonicalReviewIdentity | null> {
  const refs = canonicalObservationRefs(decision);
  const observations: Array<{
    observation: CanonicalReviewObservation;
    page: CanonicalReviewPage | null;
  }> = [];

  for (const ref of refs) {
    const observation = await findCanonicalReviewObservation(ref.recordId);
    if (!observation) {
      continue;
    }
    const page = observation.pageId ? await findCanonicalReviewPage(observation.pageId) : null;
    observations.push({ observation, page });
  }

  for (const item of observations) {
    const identity = resolveCanonicalReviewIdentity(item);
    if (identity) {
      return identity;
    }
  }

  return null;
}

function toReviewView(
  review: CanonicalReviewRecord,
  identity: CanonicalReviewIdentity | null,
): CanonicalReviewView {
  return {
    id: review.id,
    reviewType: review.reviewType,
    outcome: review.outcome,
    currency: reviewCurrencyForIdentity(review, identity),
    pageUrl: review.pageUrl,
    requestedUrl: review.requestedUrl,
    finalUrl: review.finalUrl,
    canonicalUrl: review.canonicalUrl,
    observationId: review.observationId,
    pageId: review.pageId,
    crawlRunId: review.crawlRunId,
    decisionId: review.decisionId,
    decisionRunId: review.decisionRunId,
    reviewedAt: review.reviewedAt,
    createdAt: review.createdAt,
  };
}

function freezeEvidence(decision: DecisionRecord, identity: CanonicalReviewIdentity) {
  return decision.evidenceRefs.map((ref) => {
    if (ref.kind !== "observation" || ref.recordId !== identity.observationId) {
      return ref;
    }

    return {
      ...ref,
      snapshot: {
        ...ref.snapshot,
        ruleKey: "indexability.canonical_points_elsewhere",
        pageUrl: identity.pageUrl,
        requestedUrl: identity.requestedUrl,
        finalUrl: identity.finalUrl,
        canonical: identity.canonicalUrl,
      },
    };
  });
}

export async function submitCanonicalReview(input: {
  websiteId: string;
  sessionToken: string | null;
  decisionId: string;
  outcome: unknown;
}): Promise<CanonicalReviewView> {
  if (!isCanonicalReviewOutcome(input.outcome)) {
    throw new ActionError("invalid_review_outcome", "Choose whether this canonical looks intentional, needs changing, or you are not sure.");
  }

  const context = await requireObserveOwner(input);
  const decision = await findDecisionById(input.websiteId, input.decisionId);
  if (!decision) {
    throw new ActionError("decision_not_found", "Decision not found.", 404);
  }

  if (!decisionSupportsCanonicalReview(decision)) {
    throw new ActionError(
      "unsupported_decision",
      "Foundfy can only record a canonical review from a current canonical-points-elsewhere Decision.",
    );
  }

  const run = await findDecisionRunById(decision.websiteId, decision.decisionRunId);
  if (!run) {
    throw new ActionError("decision_not_found", "Decision not found.", 404);
  }

  const identity = await resolveLiveIdentity(decision);
  if (!identity) {
    throw new ActionError(
      "observation_no_longer_supports",
      "Current observation evidence no longer supports a canonical review.",
    );
  }

  const review = await insertCanonicalReview({
    websiteId: input.websiteId,
    ownerId: context.owner.id,
    decisionId: decision.id,
    decisionRunId: run.id,
    observationId: identity.observationId,
    pageId: identity.pageId,
    crawlRunId: identity.crawlRunId,
    gscSyncId: run.gscSearchSyncId,
    siteModelId: run.siteModelId,
    goalId: run.goalId,
    requestedUrl: identity.requestedUrl,
    finalUrl: identity.finalUrl,
    canonicalUrl: identity.canonicalUrl,
    pageUrl: identity.pageUrl,
    outcome: input.outcome,
    evidenceRefs: freezeEvidence(decision, identity),
  });

  return toReviewView(review, identity);
}

export async function listCanonicalReviewsForOwner(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{ reviews: CanonicalReviewView[]; targets: CanonicalReviewTargetView[] }> {
  await requireObserveOwner(input);

  const reviews = await listCanonicalReviewsForWebsite(input.websiteId);
  const run = await findLatestCompletedDecisionRun(input.websiteId);
  const decisions = run ? await listDecisionsForRun(run.id) : [];
  const identities = new Map<string, CanonicalReviewIdentity>();

  for (const decision of decisions) {
    if (!decisionSupportsCanonicalReview(decision)) {
      continue;
    }
    const identity = await resolveLiveIdentity(decision);
    if (identity) {
      identities.set(decision.id, identity);
    }
  }

  const targets: CanonicalReviewTargetView[] = [];
  for (const [decisionId, identity] of identities) {
    const match = latestReviewForIdentity(reviews, identity, decisionId);
    targets.push({
      decisionId,
      identity,
      review: match ? toReviewView(match, identity) : null,
    });
  }

  const liveIdentities = [...identities.values()];

  return {
    reviews: reviews.map((review) =>
      toReviewView(review, liveIdentityForReview(review, liveIdentities)),
    ),
    targets,
  };
}
