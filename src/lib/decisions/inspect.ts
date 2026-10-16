import { listEvidenceForSync, listCompletedSearchSyncsForWebsite } from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { gscQueryCompactSet, currentGscSampleStatus } from "@/lib/research/gsc-join";
import { validConfirmedOfferings } from "@/lib/research/offerings";
import { activeConfirmedSiteModel } from "@/lib/research/readiness";
import {
  findLatestCompatibleResearchRun,
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
import {
  findCompletedInspectRun,
  findInspectCrawl,
  listCompletedInspectRunsForIdeas,
  listInspectPagesForCrawl,
  loadInspectDecision,
  persistResearchInspectDecision,
} from "./inspect-db";
import { inspectRelatedDemandPages } from "./inspect-match";
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

  const latestCompatible = await findLatestCompatibleResearchRun({
    websiteId: input.websiteId,
    environment: run.providerEnvironment,
  });
  const staleReasons = researchStaleReasons({
    run,
    confirmedAt: confirmed.confirmed.confirmedAt,
    confirmedOffers: offerings,
    latestCompatibleRunId: latestCompatible?.id ?? null,
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

export const INSPECT_ENGINE_VERSION = INSPECT_RELATED_DEMAND_ENGINE;
