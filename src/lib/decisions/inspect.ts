import { listEvidenceForSync, listCompletedSearchSyncsForWebsite } from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { gscQueryCompactSet, currentGscSampleStatus } from "@/lib/research/gsc-join";
import { validConfirmedOfferings } from "@/lib/research/offerings";
import { activeConfirmedSiteModel } from "@/lib/research/readiness";
import {
  findLatestReadableCompletedRunForFingerprint,
  findResearchIdeaForWebsite,
  findResearchRunForWebsite,
} from "@/lib/research/repository";
import { researchStaleReasons } from "@/lib/research/staleness";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";
import {
  INSPECT_RELATED_DEMAND_ENGINE,
  INSPECT_RELATED_DEMAND_TYPE,
  inspectDecisionTitle,
  inspectExplanation,
  inspectGscCopy,
  inspectionViewFromDecision,
  type RelatedDemandInspectionView,
} from "./inspect-display";
import { findTargetedObservationForWebsite } from "@/lib/observe/db";
import {
  OBSERVE_NOT_ELIGIBLE_COPY,
  OBSERVE_STALE_SOURCE_COPY,
  OBSERVE_T1_REJECTED_COPY,
} from "@/lib/observe/display";
import {
  findCompletedInspectRun,
  findInspectCrawl,
  findInspectRunById,
  listCompletedInspectRunsForIdeas,
  listInspectPageById,
  listInspectPagesForCrawl,
  loadInspectDecision,
  persistResearchInspectDecision,
} from "./inspect-db";
import { persistResearchInspectDecisionWithObservation } from "./inspect-t1-db";
import {
  inspectionStateAfterTargetedObservation,
  inspectRelatedDemandPages,
} from "./inspect-match";
import type { DecisionEvidenceRef, ResearchInspectDecision } from "./types";

export class RelatedDemandInspectError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = "RelatedDemandInspectError";
    this.code = code;
    this.status = status;
  }
}

export type { RelatedDemandInspectionView };

export async function listInspectionsForResearchIdeas(input: {
  websiteId: string;
  ideaIds: string[];
}): Promise<Map<string, RelatedDemandInspectionView>> {
  const runs = await listCompletedInspectRunsForIdeas(input);
  const views = new Map<string, RelatedDemandInspectionView>();
  for (const run of runs) {
    if (!run.researchIdeaId) {
      continue;
    }
    const decision = await loadInspectDecision(run.id);
    if (!decision) {
      continue;
    }
    views.set(run.researchIdeaId, inspectionViewFromDecision(decision));
  }
  return views;
}

export async function inspectRelatedDemandForOwner(input: {
  websiteId: string;
  ideaId: string;
  sessionToken: string | null;
}): Promise<RelatedDemandInspectionView> {
  await requireObserveOwner(input);

  const idea = await findResearchIdeaForWebsite({
    ideaId: input.ideaId,
    websiteId: input.websiteId,
  });
  if (!idea) {
    throw new RelatedDemandInspectError("idea_not_found", "Foundfy could not find that related search.", 404);
  }

  const run = await findResearchRunForWebsite({
    runId: idea.runId,
    websiteId: input.websiteId,
  });
  if (!run || run.status !== "completed") {
    throw new RelatedDemandInspectError(
      "run_not_completed",
      "Foundfy can inspect related searches only after research has completed.",
    );
  }

  const siteModel = await findLatestConfirmedSiteModelForWebsite(input.websiteId);
  const confirmed = activeConfirmedSiteModel(siteModel);
  if (!confirmed?.confirmed) {
    throw new RelatedDemandInspectError(
      "no_confirmed_site_model",
      "Confirm how Foundfy understands this site before checking existing pages.",
    );
  }

  const offerings = validConfirmedOfferings(
    confirmed.confirmed.offers,
    confirmed.understanding.hostname,
  );
  if (!offerings.includes(idea.seedOffering)) {
    throw new RelatedDemandInspectError(
      "offering_removed",
      "This related search no longer belongs to a confirmed offering.",
    );
  }

  const currentFingerprintRun = await findLatestReadableCompletedRunForFingerprint({
    websiteId: input.websiteId,
    fingerprint: run.requestFingerprint,
  });
  const staleReasons = researchStaleReasons({
    run,
    confirmedAt: confirmed.confirmed.confirmedAt,
    confirmedOffers: offerings,
    currentFingerprintRunId: currentFingerprintRun?.id ?? null,
  });
  if (staleReasons.length > 0) {
    throw new RelatedDemandInspectError(
      "research_stale",
      "This related-demand evidence is out of date. Research again before checking existing pages.",
    );
  }

  const crawl = await findLatestUsableCrawlRun(input.websiteId);
  if (!crawl) {
    throw new RelatedDemandInspectError(
      "no_usable_crawl",
      "Complete a website crawl before Foundfy can check existing pages.",
    );
  }

  const inspectCrawl = await findInspectCrawl(crawl.id);
  const crawlBounded =
    (inspectCrawl?.pagesDiscovered ?? crawl.pagesCrawled) > crawl.pagesCrawled;

  const gscSync = (await listCompletedSearchSyncsForWebsite(input.websiteId))[0] ?? null;
  const existing = await findCompletedInspectRun({
    websiteId: input.websiteId,
    researchIdeaId: idea.id,
    crawlRunId: crawl.id,
    gscSearchSyncId: gscSync?.id ?? null,
  });
  if (existing) {
    const decision = await loadInspectDecision(existing.id);
    if (decision) {
      return inspectionViewFromDecision(decision);
    }
  }

  const pages = await listInspectPagesForCrawl(crawl.id);
  const match = inspectRelatedDemandPages({
    phrase: idea.keyword,
    languageCode: idea.languageCode,
    pages,
  });

  let gscStatus: ReturnType<typeof currentGscSampleStatus> = "gsc_unavailable";
  let gscTruncated = false;
  if (gscSync) {
    const evidence = await listEvidenceForSync(gscSync.id);
    const queries = evidence.flatMap((row) =>
      row.evidenceType === "query" && row.queryText ? [row.queryText] : [],
    );
    gscStatus = currentGscSampleStatus({
      keyword: idea.keyword,
      queryKeys: gscQueryCompactSet(queries),
    });
    gscTruncated = gscSync.pagesTruncated || gscSync.queriesTruncated || gscSync.queryPagesTruncated;
  }
  const gscCopy = inspectGscCopy(gscStatus, gscTruncated);

  const evidenceRefs: DecisionEvidenceRef[] = [
    {
      kind: "research_idea",
      recordId: idea.id,
      snapshot: {
        keyword: idea.keyword,
        compactKey: idea.compactKey,
        languageCode: idea.languageCode,
        seedOffering: idea.seedOffering,
        estimatedMonthlySearches: idea.estimatedMonthlySearches,
        resultState: match.state,
        gscStatus,
        gscCopy,
      },
    },
    {
      kind: "research_run",
      recordId: run.id,
      snapshot: {
        countryKey: run.countryKey,
        countryName: run.countryName,
        languageCodes: run.languageCodes,
        offeringSeeds: run.offeringSeeds,
      },
    },
    {
      kind: "site_model",
      recordId: confirmed.id,
      snapshot: { status: confirmed.status },
    },
    {
      kind: "crawl_run",
      recordId: crawl.id,
      snapshot: {
        bounded: crawlBounded,
        pagesCrawled: crawl.pagesCrawled,
        pagesDiscovered: inspectCrawl?.pagesDiscovered ?? null,
      },
    },
  ];

  if (gscSync) {
    evidenceRefs.push({
      kind: "gsc_sync",
      recordId: gscSync.id,
      snapshot: {
        truncated: gscTruncated,
        gscStatus,
      },
    });
  }

  for (const page of match.candidatePages) {
    evidenceRefs.push({
      kind: "page",
      recordId: page.id,
      snapshot: {
        pageUrl: page.requestedUrl,
        title: page.title,
      },
    });
  }

  const inspect: ResearchInspectDecision = {
    decisionType: INSPECT_RELATED_DEMAND_TYPE,
    title: inspectDecisionTitle(idea.keyword),
    explanation: inspectExplanation({
      state: match.state,
      crawlBounded,
      pagesCrawled: inspectCrawl?.pagesCrawled ?? crawl.pagesCrawled,
      pagesDiscovered: inspectCrawl?.pagesDiscovered ?? null,
      gscCopy,
    }),
    pageUrl: match.candidatePages.length === 1 ? match.candidatePages[0]!.requestedUrl : null,
    pageId: match.state === "clear_existing_page_evidence" ? match.candidatePages[0]?.id ?? null : null,
    priorityBand: null,
    rank: null,
    scoring: null,
    confidence: null,
    inspectionState: match.state,
    evidenceRefs,
  };

  const persisted = await persistResearchInspectDecision({
    researchIdeaId: idea.id,
    siteModelId: confirmed.id,
    crawlRunId: crawl.id,
    gscSearchSyncId: gscSync?.id ?? null,
    title: inspect.title,
    explanation: inspect.explanation,
    pageUrl: inspect.pageUrl,
    pageId: inspect.pageId,
    inspectionState: inspect.inspectionState,
    gscTruncated,
    evidenceRefs: inspect.evidenceRefs,
  });
  const decision = await loadInspectDecision(persisted.runId);
  if (!decision) {
    throw new RelatedDemandInspectError(
      "unavailable",
      "Foundfy could not load the related-demand inspection.",
      500,
    );
  }
  return inspectionViewFromDecision(decision);
}

export async function inspectRelatedDemandAfterObservationForOwner(input: {
  websiteId: string;
  ideaId: string;
  sessionToken: string | null;
  targetedObservationId: string;
}): Promise<RelatedDemandInspectionView> {
  await requireObserveOwner(input);

  const idea = await findResearchIdeaForWebsite({
    ideaId: input.ideaId,
    websiteId: input.websiteId,
  });
  if (!idea) {
    throw new RelatedDemandInspectError("idea_not_found", "Foundfy could not find that related search.", 404);
  }

  const observation = await findTargetedObservationForWebsite({
    websiteId: input.websiteId,
    observationId: input.targetedObservationId,
  });
  if (!observation || observation.status !== "analyzed" || !observation.resultPageId) {
    throw new RelatedDemandInspectError(
      "observation_not_ready",
      "Foundfy can check again only after a page has been observed.",
    );
  }

  if (observation.sourceResearchIdeaId !== idea.id) {
    throw new RelatedDemandInspectError("idea_mismatch", OBSERVE_NOT_ELIGIBLE_COPY);
  }

  const sourceInspect = await findInspectRunById({
    websiteId: input.websiteId,
    runId: observation.sourceInspectRunId,
  });
  if (
    !sourceInspect ||
    sourceInspect.researchIdeaId !== idea.id ||
    sourceInspect.crawlRunId !== observation.sourceCrawlRunId ||
    sourceInspect.targetedObservationId
  ) {
    throw new RelatedDemandInspectError("t0_not_eligible", OBSERVE_NOT_ELIGIBLE_COPY);
  }

  const sourceDecision = await loadInspectDecision(sourceInspect.id);
  if (sourceDecision?.inspectionState !== "no_obvious_match_in_current_crawl") {
    throw new RelatedDemandInspectError("t0_not_eligible", OBSERVE_NOT_ELIGIBLE_COPY);
  }

  const latestCrawl = await findLatestUsableCrawlRun(input.websiteId);
  if (!latestCrawl || latestCrawl.id !== observation.sourceCrawlRunId) {
    throw new RelatedDemandInspectError("t0_stale", OBSERVE_STALE_SOURCE_COPY);
  }

  const run = await findResearchRunForWebsite({
    runId: idea.runId,
    websiteId: input.websiteId,
  });
  if (!run || run.status !== "completed") {
    throw new RelatedDemandInspectError(
      "run_not_completed",
      "Foundfy can inspect related searches only after research has completed.",
    );
  }

  const inspectCrawl = await findInspectCrawl(observation.sourceCrawlRunId);
  const crawlBounded =
    (inspectCrawl?.pagesDiscovered ?? latestCrawl.pagesCrawled) > latestCrawl.pagesCrawled;

  const basePages = await listInspectPagesForCrawl(observation.sourceCrawlRunId);
  const targetedPage = await listInspectPageById(observation.resultPageId);
  if (!targetedPage) {
    throw new RelatedDemandInspectError("observation_not_ready", OBSERVE_T1_REJECTED_COPY, 500);
  }

  const pages = [...basePages, targetedPage];
  const match = inspectRelatedDemandPages({
    phrase: idea.keyword,
    languageCode: idea.languageCode,
    pages,
  });
  const inspectionState = inspectionStateAfterTargetedObservation(match.state);

  const ideaRef = sourceDecision.evidenceRefs.find((ref) => ref.kind === "research_idea");
  const gscCopy =
    typeof ideaRef?.snapshot.gscCopy === "string"
      ? ideaRef.snapshot.gscCopy
      : inspectGscCopy("gsc_unavailable", false);
  const gscTruncated = sourceInspect.gscTruncated;

  const evidenceRefs: DecisionEvidenceRef[] = [
    {
      kind: "research_idea",
      recordId: idea.id,
      snapshot: {
        keyword: idea.keyword,
        compactKey: idea.compactKey,
        languageCode: idea.languageCode,
        seedOffering: idea.seedOffering,
        estimatedMonthlySearches: idea.estimatedMonthlySearches,
        resultState: inspectionState,
        gscCopy,
      },
    },
    {
      kind: "research_run",
      recordId: run.id,
      snapshot: {
        countryKey: run.countryKey,
        countryName: run.countryName,
        languageCodes: run.languageCodes,
        offeringSeeds: run.offeringSeeds,
      },
    },
    {
      kind: "site_model",
      recordId: sourceInspect.siteModelId,
      snapshot: { status: "confirmed" },
    },
    {
      kind: "crawl_run",
      recordId: observation.sourceCrawlRunId,
      snapshot: {
        bounded: crawlBounded,
        pagesCrawled: inspectCrawl?.pagesCrawled ?? latestCrawl.pagesCrawled,
        pagesDiscovered: inspectCrawl?.pagesDiscovered ?? null,
      },
    },
    {
      kind: "targeted_observation",
      recordId: observation.id,
      snapshot: {},
    },
  ];

  if (sourceInspect.gscSearchSyncId) {
    evidenceRefs.push({
      kind: "gsc_sync",
      recordId: sourceInspect.gscSearchSyncId,
      snapshot: { truncated: gscTruncated },
    });
  }

  for (const page of match.candidatePages) {
    evidenceRefs.push({
      kind: "page",
      recordId: page.id,
      snapshot: {
        pageUrl: page.requestedUrl,
        title: page.title,
      },
    });
  }

  const inspect: ResearchInspectDecision = {
    decisionType: INSPECT_RELATED_DEMAND_TYPE,
    title: inspectDecisionTitle(idea.keyword),
    explanation: inspectExplanation({
      state: inspectionState,
      crawlBounded,
      pagesCrawled: inspectCrawl?.pagesCrawled ?? latestCrawl.pagesCrawled,
      pagesDiscovered: inspectCrawl?.pagesDiscovered ?? null,
      gscCopy,
    }),
    pageUrl: match.candidatePages.length === 1 ? match.candidatePages[0]!.requestedUrl : null,
    pageId:
      inspectionState === "clear_existing_page_evidence"
        ? match.candidatePages[0]?.id ?? null
        : null,
    priorityBand: null,
    rank: null,
    scoring: null,
    confidence: null,
    inspectionState,
    evidenceRefs,
  };

  try {
    const persisted = await persistResearchInspectDecisionWithObservation({
      researchIdeaId: idea.id,
      siteModelId: sourceInspect.siteModelId,
      crawlRunId: observation.sourceCrawlRunId,
      gscSearchSyncId: sourceInspect.gscSearchSyncId,
      targetedObservationId: observation.id,
      title: inspect.title,
      explanation: inspect.explanation,
      pageUrl: inspect.pageUrl,
      pageId: inspect.pageId,
      inspectionState: inspect.inspectionState,
      gscTruncated,
      evidenceRefs: inspect.evidenceRefs,
    });
    const decision = await loadInspectDecision(persisted.runId);
    if (!decision) {
      throw new RelatedDemandInspectError(
        "unavailable",
        "Foundfy could not load the related-demand inspection.",
        500,
      );
    }
    return inspectionViewFromDecision(decision);
  } catch (error) {
    if (error instanceof RelatedDemandInspectError) {
      throw error;
    }
    throw new RelatedDemandInspectError("persist_rejected", OBSERVE_T1_REJECTED_COPY);
  }
}

export const INSPECT_ENGINE_VERSION = INSPECT_RELATED_DEMAND_ENGINE;
