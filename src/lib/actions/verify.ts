import { requireObserveOwner } from "@/lib/gsc/observe";
import {
  findActionById,
  findActiveMissingMetaObservation,
  findLatestCompletedCrawlAfter,
  findLatestVerificationForAction,
  findSuccessfulExecuteAttempt,
  findVerificationByIdempotency,
  insertActionVerification,
  listPagesForCrawlRun,
  type VerificationCrawlSnapshot,
} from "./db";
import { pageWasFetchedSuccessfully, evaluateMetaDescriptionVerification, pageUrlsEquivalent } from "./verification";
import { ActionError, type ActionRecord, type ActionVerificationRecord, type ActionVerificationView } from "./types";

function executionBoundaryIso(attempt: { finishedAt: string | null; createdAt: string }): string {
  return attempt.finishedAt ?? attempt.createdAt;
}

function pageMatchesTarget(
  page: { requestedUrl: string; finalUrl: string },
  targetUrl: string,
): boolean {
  return pageUrlsEquivalent(page.requestedUrl, targetUrl) || pageUrlsEquivalent(page.finalUrl, targetUrl);
}

export async function verificationViewFor(action: ActionRecord): Promise<ActionVerificationView | null> {
  if (action.status !== "executed") {
    return null;
  }

  const attempt = await findSuccessfulExecuteAttempt(action.id);
  if (!attempt) {
    return {
      state: "fresh_crawl_required",
      canCheck: false,
      expectedValue: action.mutationSpec.after,
      observedValue: null,
      verifiedAt: null,
      crawlRunId: null,
      crawlCompletedAt: null,
    };
  }

  const latest = await findLatestVerificationForAction(action.id);
  const qualifyingCrawl = await findLatestCompletedCrawlAfter({
    websiteId: action.websiteId,
    afterIso: executionBoundaryIso(attempt),
  });

  if (!qualifyingCrawl) {
    return {
      state: "fresh_crawl_required",
      canCheck: false,
      expectedValue: action.mutationSpec.after,
      observedValue: latest?.observedValue ?? null,
      verifiedAt: latest?.verifiedAt ?? null,
      crawlRunId: latest?.crawlRunId ?? null,
      crawlCompletedAt: latest?.evidenceSnapshot.crawlCompletedAt ?? null,
    };
  }

  const canCheck = !latest || latest.crawlRunId !== qualifyingCrawl.id;
  if (!latest) {
    return {
      state: "ready",
      canCheck: true,
      expectedValue: action.mutationSpec.after,
      observedValue: null,
      verifiedAt: null,
      crawlRunId: qualifyingCrawl.id,
      crawlCompletedAt: qualifyingCrawl.completedAt,
    };
  }

  return {
    state: latest.status,
    canCheck,
    expectedValue: latest.expectedValue,
    observedValue: latest.observedValue,
    verifiedAt: latest.verifiedAt,
    crawlRunId: latest.crawlRunId,
    crawlCompletedAt: latest.evidenceSnapshot.crawlCompletedAt ?? qualifyingCrawl.completedAt,
  };
}

export async function verifyAction(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<ActionVerificationRecord> {
  await requireObserveOwner(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  if (action.status !== "executed") {
    throw new ActionError("not_executed", "Verify this change after Foundfy has executed it.");
  }

  if (action.actionType !== "update_meta_description" || action.field !== "meta_description") {
    throw new ActionError("unsupported_decision", "Foundfy can only verify a meta description change.");
  }

  const attempt = await findSuccessfulExecuteAttempt(action.id);
  if (!attempt) {
    throw new ActionError("not_executed", "Foundfy has no recorded successful execution for this change.");
  }

  const crawl = await findLatestCompletedCrawlAfter({
    websiteId: action.websiteId,
    afterIso: executionBoundaryIso(attempt),
  });
  if (!crawl) {
    throw new ActionError(
      "fresh_crawl_required",
      "Run a new scan to verify that this change is live.",
    );
  }

  const existing = await findVerificationByIdempotency({
    actionId: action.id,
    executionAttemptId: attempt.id,
    crawlRunId: crawl.id,
  });
  if (existing) {
    return existing;
  }

  return persistVerification({ action, attemptId: attempt.id, crawl });
}

async function persistVerification(input: {
  action: ActionRecord;
  attemptId: string;
  crawl: VerificationCrawlSnapshot;
}): Promise<ActionVerificationRecord> {
  const pages = await listPagesForCrawlRun(input.crawl.id);
  const page = pages.find((candidate) => pageMatchesTarget(candidate, input.action.targetPageUrl)) ?? null;
  const observation = page
    ? await findActiveMissingMetaObservation({ crawlRunId: input.crawl.id, pageId: page.id })
    : null;

  const evaluated = evaluateMetaDescriptionVerification({
    expectedValue: input.action.mutationSpec.after,
    page,
    missingMetaObservation: observation,
  });

  return insertActionVerification({
    actionId: input.action.id,
    websiteId: input.action.websiteId,
    executionAttemptId: input.attemptId,
    crawlRunId: input.crawl.id,
    targetPageId: page?.id ?? null,
    status: evaluated.status,
    expectedValue: input.action.mutationSpec.after,
    observedValue: evaluated.observedValue,
    evidenceSnapshot: {
      crawlRunId: input.crawl.id,
      crawlCompletedAt: input.crawl.completedAt,
      pageId: page?.id ?? null,
      requestedUrl: page?.requestedUrl ?? null,
      finalUrl: page?.finalUrl ?? null,
      statusCode: page?.statusCode ?? null,
      metaDescription: page?.metaDescription ?? null,
      contentHash: page?.contentHash ?? null,
      missingMetaObservationId: observation?.id ?? null,
      missingMetaPresent: evaluated.missingMetaPresent,
      fetchedSuccessfully: page ? pageWasFetchedSuccessfully(page.statusCode) : false,
    },
  });
}
