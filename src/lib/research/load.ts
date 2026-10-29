import { withInspectionCurrency } from "@/lib/decisions/inspect-display";
import { listInspectionsForResearchIdeas } from "@/lib/decisions/inspect";
import {
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";
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
  listReadableCompletedResearchRuns,
  listResearchIdeasForRun,
} from "./repository";
import { researchRunRecoveryState } from "./recovery";
import {
  currentCompletedRunForFingerprint,
  currentCompletedRunsByFingerprint,
  researchStaleReasons,
} from "./staleness";
import type {
  ResearchIdeaRecord,
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

function toIdeaViews(input: {
  run: ResearchRunRecord;
  records: ResearchIdeaRecord[];
  staleReasons: ResearchRunView["staleReasons"];
  queryKeys: Set<string> | null;
  inspections: Map<string, NonNullable<ResearchIdeaView["inspection"]>>;
  latestCrawlId: string | null;
}): ResearchIdeaView[] {
  const researchCurrent = input.staleReasons.length === 0 && input.run.status === "completed";
  return input.records.map((idea) => {
    const inspection = input.inspections.get(idea.id) ?? null;
    return {
      id: idea.id,
      runId: idea.runId,
      keyword: idea.keyword,
      estimatedMonthlySearches: idea.estimatedMonthlySearches,
      seedOffering: idea.seedOffering,
      languageCode: idea.languageCode,
      countryKey: input.run.countryKey,
      countryName: input.run.countryName,
      retrievedAt: idea.createdAt,
      initialGscSampleStatus: idea.initialGscSampleStatus,
      currentGscSampleStatus: currentGscSampleStatus({
        keyword: idea.keyword,
        queryKeys: input.queryKeys,
      }),
      canInspect: researchCurrent,
      inspection: inspection
        ? withInspectionCurrency(inspection, {
            researchCurrent,
            latestCrawlId: input.latestCrawlId,
          })
        : null,
    };
  });
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
  const context = await requireObserveOwner(input);
  const env = input.env ?? process.env;
  const model = await findLatestConfirmedSiteModelForWebsite(input.websiteId);
  const gsc = await latestGscQueryState(input.websiteId);
  const readiness = evaluateResearchReadiness({
    model,
    hasCompletedGscSync: gsc.syncId != null,
    websiteId: input.websiteId,
    googleIdentityId: context.owner?.googleIdentityId ?? null,
    htmlLangs: model?.understanding.languages.htmlLangs,
    env,
  });

  const environment = researchReadEnvironment(env);
  if (!environment || !readiness.surfaceVisible) {
    return {
      readiness: { ...readiness, surfaceVisible: false },
      run: null,
      persistedRuns: [],
    };
  }

  const [latest, readableCompleted] = await Promise.all([
    findLatestCompatibleResearchRun({
      websiteId: input.websiteId,
      environment,
    }),
    listReadableCompletedResearchRuns({
      websiteId: input.websiteId,
      environment,
    }),
  ]);
  if (!latest) {
    return { readiness, run: null, persistedRuns: [] };
  }

  const confirmed = model?.confirmed ?? null;
  const hostname = model?.understanding.hostname ?? "";
  const confirmedOffers = confirmed
    ? validConfirmedOfferings(confirmed.offers, hostname)
    : [];
  const currentFingerprintRuns = currentCompletedRunsByFingerprint({
    runs: readableCompleted,
  });
  const extraCurrentRuns = currentFingerprintRuns.filter((run) => run.id !== latest.id);
  const displayRuns = [latest, ...extraCurrentRuns];
  const recordsByRunId = new Map<string, ResearchIdeaRecord[]>();
  for (const run of displayRuns) {
    recordsByRunId.set(run.id, await listResearchIdeasForRun(run.id));
  }
  const inspections = await listInspectionsForResearchIdeas({
    websiteId: input.websiteId,
    ideaIds: [...recordsByRunId.values()].flatMap((records) => records.map((idea) => idea.id)),
  });
  const latestCrawl = await findLatestUsableCrawlRun(input.websiteId);

  const toView = (run: ResearchRunRecord): ResearchRunView => {
    const currentFingerprintRun = currentCompletedRunForFingerprint({
      runs: readableCompleted,
      fingerprint: run.requestFingerprint,
    });
    const staleReasons = researchStaleReasons({
      run,
      confirmedAt: confirmed?.confirmedAt ?? null,
      confirmedOffers,
      currentFingerprintRunId: currentFingerprintRun?.id ?? null,
    });
    return toRunView({
      run,
      ideas: toIdeaViews({
        run,
        records: recordsByRunId.get(run.id) ?? [],
        staleReasons,
        queryKeys: gsc.queryKeys,
        inspections,
        latestCrawlId: latestCrawl?.id ?? null,
      }),
      staleReasons,
      currentGscQueriesTruncated: gsc.truncated,
    });
  };

  return {
    readiness,
    run: toView(latest),
    persistedRuns: extraCurrentRuns.map(toView),
  };
}
