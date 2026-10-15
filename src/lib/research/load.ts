import {
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { researchReadEnvironment } from "./config";
import {
  isResearchTestData,
  researchEmptyOutcome,
  researchFilterReasonDetails,
  researchReviewedKeptCopy,
  researchRunFilterProvenance,
} from "./display";
import { currentGscSampleStatus, gscQueryCompactSet } from "./gsc-join";
import { validConfirmedOfferings } from "./offerings";
import { evaluateResearchReadiness } from "./readiness";
import {
  findLatestCompatibleResearchRun,
  listResearchIdeasForRun,
} from "./repository";
import { researchRunRecoveryState } from "./recovery";
import { researchStaleReasons } from "./staleness";
import type {
  ResearchIdeaView,
  ResearchOwnerView,
  ResearchRunRecord,
  ResearchRunView,
} from "./types";

async function latestGscQueryState(websiteId: string): Promise<{
  syncId: string | null;
  truncated: boolean;
  queryKeys: Set<string> | null;
}> {
  const syncs = await listCompletedSearchSyncsForWebsite(websiteId);
  const sync = syncs[0] ?? null;
  if (!sync) {
    return { syncId: null, truncated: false, queryKeys: null };
  }

  const evidence = await listEvidenceForSync(sync.id);
  const queries = evidence.flatMap((row) =>
    row.evidenceType === "query" && row.queryText ? [row.queryText] : [],
  );

  return {
    syncId: sync.id,
    truncated: sync.queriesTruncated,
    queryKeys: gscQueryCompactSet(queries),
  };
}

function toRunView(input: {
  run: ResearchRunRecord;
  ideas: ResearchIdeaView[];
  staleReasons: ResearchRunView["staleReasons"];
  currentGscQueriesTruncated: boolean;
}): ResearchRunView {
  const recovery = researchRunRecoveryState(input.run);
  const provenance = researchRunFilterProvenance({
    ideaCount: input.ideas.length,
    ledger: input.run.requestLedger ?? [],
  });
  return {
    id: input.run.id,
    status: input.run.status,
    stale: input.staleReasons.length > 0,
    staleReasons: input.staleReasons,
    providerEnvironment: input.run.providerEnvironment,
    isTestData: isResearchTestData(input.run.providerEnvironment),
    countryKey: input.run.countryKey,
    countryName: input.run.countryName,
    languageCodes: input.run.languageCodes,
    offeringSeeds: input.run.offeringSeeds,
    retrievedAt: input.run.completedAt ?? input.run.createdAt,
    gscQueriesTruncatedAtRetrieval: input.run.gscQueriesTruncated,
    currentGscQueriesTruncated: input.currentGscQueriesTruncated,
    incomplete:
      recovery.displayInterrupted ||
      input.run.status === "partial" ||
      input.run.status === "requested" ||
      input.run.status === "running" ||
      input.run.status === "failed" ||
      input.run.status === "interrupted" ||
      input.run.status === "closed",
    recoveryRequired: recovery.recoveryRequired,
    canResumeUnattempted: recovery.canResumeUnattempted,
    safeUnattemptedCount: recovery.safeUnattemptedCount,
    displayInterrupted: recovery.displayInterrupted,
    displayClosed: recovery.displayClosed,
    canClose: recovery.canClose,
    canStartNewCycle: recovery.canStartNewCycle,
    emptyOutcome: researchEmptyOutcome({
      ideaCount: input.ideas.length,
      ledger: input.run.requestLedger ?? [],
    }),
    reviewedKeptCopy: researchReviewedKeptCopy(
      provenance.providerResultCount,
      input.ideas.length,
    ),
    filterReasonDetails: researchFilterReasonDetails(provenance.filterReasonCounts),
    ideas: input.ideas,
  };
}

export async function loadResearchForOwner(input: {
  websiteId: string;
  sessionToken: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<ResearchOwnerView> {
  await requireObserveOwner(input);
  const env = input.env ?? process.env;
  const model = await findLatestConfirmedSiteModelForWebsite(input.websiteId);
  const gsc = await latestGscQueryState(input.websiteId);
  const readiness = evaluateResearchReadiness({
    model,
    hasCompletedGscSync: gsc.syncId != null,
    htmlLangs: model?.understanding.languages.htmlLangs,
    env,
  });

  const environment = researchReadEnvironment(env);
  if (!environment || !readiness.surfaceVisible) {
    return { readiness: { ...readiness, surfaceVisible: false }, run: null };
  }

  const latest = await findLatestCompatibleResearchRun({
    websiteId: input.websiteId,
    environment,
  });
  if (!latest) {
    return { readiness, run: null };
  }

  const records = await listResearchIdeasForRun(latest.id);
  const confirmed = model?.confirmed ?? null;
  const hostname = model?.understanding.hostname ?? "";
  const staleReasons = researchStaleReasons({
    run: latest,
    confirmedAt: confirmed?.confirmedAt ?? null,
    confirmedOffers: confirmed ? validConfirmedOfferings(confirmed.offers, hostname) : [],
    latestCompatibleRunId: latest.id,
  });

  const ideas: ResearchIdeaView[] = records.map((idea) => ({
    id: idea.id,
    keyword: idea.keyword,
    estimatedMonthlySearches: idea.estimatedMonthlySearches,
    seedOffering: idea.seedOffering,
    languageCode: idea.languageCode,
    countryKey: latest.countryKey,
    countryName: latest.countryName,
    retrievedAt: idea.createdAt,
    initialGscSampleStatus: idea.initialGscSampleStatus,
    currentGscSampleStatus: currentGscSampleStatus({
      keyword: idea.keyword,
      queryKeys: gsc.queryKeys,
    }),
  }));

  return {
    readiness,
    run: toRunView({
      run: latest,
      ideas,
      staleReasons,
      currentGscQueriesTruncated: gsc.truncated,
    }),
  };
}
