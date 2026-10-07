import {
  findSearchSyncById,
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import {
  findLatestVerificationForAction,
  findLearningByIdempotency,
  insertActionLearningSnapshot,
} from "./db";
import {
  isEligibleComparisonSync,
  LEARN_CALCULATION_VERSION,
  learningUrlKey,
  metricsFromEvidence,
  outcomeFromMetrics,
  selectLearningPageRow,
  urlsShareLearningKey,
} from "./learning";
import type {
  ActionLearningRecord,
  ActionLearningView,
  ActionRecord,
  ActionVerificationRecord,
} from "./types";

function waitingView(pageUrl: string | null): ActionLearningView {
  return {
    state: "waiting_for_data",
    reason: null,
    pageUrl,
    baseline: null,
    comparison: null,
    baselinePeriod: null,
    comparisonPeriod: null,
    baselinePagesTruncated: false,
    comparisonPagesTruncated: false,
  };
}

function insufficientView(
  reason: string,
  pageUrl: string | null,
  extra: Partial<ActionLearningView> = {},
): ActionLearningView {
  return {
    state: "insufficient_data",
    reason,
    pageUrl,
    baseline: extra.baseline ?? null,
    comparison: extra.comparison ?? null,
    baselinePeriod: extra.baselinePeriod ?? null,
    comparisonPeriod: extra.comparisonPeriod ?? null,
    baselinePagesTruncated: extra.baselinePagesTruncated ?? false,
    comparisonPagesTruncated: extra.comparisonPagesTruncated ?? false,
  };
}

function viewFromSnapshot(row: ActionLearningRecord): ActionLearningView {
  const comparison =
    row.outcomeState === "insufficient_data"
      ? null
      : {
          appearances: row.comparisonAppearances,
          visits: row.comparisonVisits,
          ctr: row.comparisonCtr,
          position: row.comparisonPosition,
        };

  return {
    state: row.outcomeState,
    reason: row.insufficientReason,
    pageUrl: row.pageUrl,
    baseline: {
      appearances: row.baselineAppearances,
      visits: row.baselineVisits,
      ctr: row.baselineCtr,
      position: row.baselinePosition,
    },
    comparison,
    baselinePeriod: { start: row.baselinePeriodStart, end: row.baselinePeriodEnd },
    comparisonPeriod: { start: row.comparisonPeriodStart, end: row.comparisonPeriodEnd },
    baselinePagesTruncated: row.baselinePagesTruncated,
    comparisonPagesTruncated: row.comparisonPagesTruncated,
  };
}

export async function learningViewFor(action: ActionRecord): Promise<ActionLearningView | null> {
  if (action.status !== "executed" || action.actionType !== "update_meta_description") {
    return null;
  }

  const verification = await findLatestVerificationForAction(action.id);
  if (!verification || verification.status !== "verified" || !verification.verifiedAt) {
    return null;
  }

  return resolveLearningView(action, verification);
}

async function resolveLearningView(
  action: ActionRecord,
  verification: ActionVerificationRecord,
): Promise<ActionLearningView> {
  const pageUrl = action.targetPageUrl;
  const durableKey = learningUrlKey(pageUrl);
  if (!durableKey) {
    return insufficientView("url_identity_changed", pageUrl);
  }

  const frozenGoogleUrl = action.evidenceRefs.find((ref) => ref.kind === "gsc_evidence")?.snapshot
    .pageUrl;
  if (typeof frozenGoogleUrl === "string" && !urlsShareLearningKey(pageUrl, frozenGoogleUrl)) {
    return insufficientView("url_identity_changed", pageUrl);
  }

  if (!action.gscSyncId) {
    return insufficientView("google_evidence_removed", pageUrl);
  }

  const baselineSync = await findSearchSyncById(action.gscSyncId);
  if (!baselineSync) {
    return insufficientView("google_evidence_removed", pageUrl);
  }

  const baselineEvidence = await listEvidenceForSync(baselineSync.id);
  const baselineRow = selectLearningPageRow(pageUrl, baselineEvidence);
  if (!baselineRow) {
    return insufficientView(
      baselineSync.pagesTruncated ? "truncated_page_dataset" : "missing_baseline_page",
      pageUrl,
      {
        baselinePeriod: { start: baselineSync.periodStart, end: baselineSync.periodEnd },
        baselinePagesTruncated: baselineSync.pagesTruncated,
      },
    );
  }

  const baselineMetrics = metricsFromEvidence(baselineRow);
  if (!baselineMetrics) {
    return insufficientView("missing_baseline_page", pageUrl);
  }

  const syncs = await listCompletedSearchSyncsForWebsite(action.websiteId);
  const eligible = syncs.filter((sync) =>
    isEligibleComparisonSync({
      sync,
      baselineSyncId: baselineSync.id,
      verifiedAt: verification.verifiedAt as string,
    }),
  );
  const comparisonSync = eligible[0] ?? null;
  if (!comparisonSync) {
    return waitingView(pageUrl);
  }

  const existing = await findLearningByIdempotency({
    actionId: action.id,
    verificationId: verification.id,
    comparisonSyncId: comparisonSync.id,
  });
  if (existing) {
    return viewFromSnapshot(existing);
  }

  const comparisonEvidence = await listEvidenceForSync(comparisonSync.id);
  const comparisonRow = selectLearningPageRow(pageUrl, comparisonEvidence);
  if (!comparisonRow) {
    return persistSnapshot({
      action,
      verification,
      pageUrl,
      durableKey,
      baselineSync,
      comparisonSync,
      baselineMetrics,
      comparisonMetrics: {
        appearances: 0,
        visits: 0,
        ctr: null,
        position: null,
      },
      outcomeState: "insufficient_data",
      reason: comparisonSync.pagesTruncated ? "truncated_page_dataset" : "missing_comparison_page",
    });
  }

  const comparisonMetrics = metricsFromEvidence(comparisonRow);
  if (!comparisonMetrics) {
    return persistSnapshot({
      action,
      verification,
      pageUrl,
      durableKey,
      baselineSync,
      comparisonSync,
      baselineMetrics,
      comparisonMetrics: {
        appearances: 0,
        visits: 0,
        ctr: null,
        position: null,
      },
      outcomeState: "insufficient_data",
      reason: "missing_comparison_page",
    });
  }

  return persistSnapshot({
    action,
    verification,
    pageUrl,
    durableKey,
    baselineSync,
    comparisonSync,
    baselineMetrics,
    comparisonMetrics,
    outcomeState: outcomeFromMetrics(baselineMetrics, comparisonMetrics),
    reason: null,
  });
}

async function persistSnapshot(input: {
  action: ActionRecord;
  verification: ActionVerificationRecord;
  pageUrl: string;
  durableKey: string;
  baselineSync: { id: string; periodStart: string; periodEnd: string; pagesTruncated: boolean };
  comparisonSync: { id: string; periodStart: string; periodEnd: string; pagesTruncated: boolean };
  baselineMetrics: { appearances: number; visits: number; ctr: number | null; position: number | null };
  comparisonMetrics: { appearances: number; visits: number; ctr: number | null; position: number | null };
  outcomeState: ActionLearningRecord["outcomeState"];
  reason: string | null;
}): Promise<ActionLearningView> {
  const snapshot = await insertActionLearningSnapshot({
    actionId: input.action.id,
    verificationId: input.verification.id,
    websiteId: input.action.websiteId,
    pageUrl: input.pageUrl,
    pageComparisonKey: input.durableKey,
    baselineSyncId: input.baselineSync.id,
    comparisonSyncId: input.comparisonSync.id,
    baselinePeriodStart: input.baselineSync.periodStart,
    baselinePeriodEnd: input.baselineSync.periodEnd,
    comparisonPeriodStart: input.comparisonSync.periodStart,
    comparisonPeriodEnd: input.comparisonSync.periodEnd,
    baselineAppearances: input.baselineMetrics.appearances,
    baselineVisits: input.baselineMetrics.visits,
    baselineCtr: input.baselineMetrics.ctr,
    baselinePosition: input.baselineMetrics.position,
    comparisonAppearances: input.comparisonMetrics.appearances,
    comparisonVisits: input.comparisonMetrics.visits,
    comparisonCtr: input.comparisonMetrics.ctr,
    comparisonPosition: input.comparisonMetrics.position,
    baselinePagesTruncated: input.baselineSync.pagesTruncated,
    comparisonPagesTruncated: input.comparisonSync.pagesTruncated,
    outcomeState: input.outcomeState,
    insufficientReason: input.reason,
    calculationVersion: LEARN_CALCULATION_VERSION,
  });

  return viewFromSnapshot(snapshot);
}
