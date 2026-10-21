import { listEvidenceForSync } from "@/lib/gsc/db-search";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import { requireObserveOwner } from "@/lib/gsc/observe";
import {
  findResearchIdeaForWebsite,
  findResearchRunForWebsite,
} from "@/lib/research/repository";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";
import {
  findInspectCrawl,
  findLatestT0InspectRunForIdeaAndCrawl,
  loadInspectDecision,
} from "@/lib/decisions/inspect-db";
import {
  OBSERVE_ALREADY_RUNNING_COPY,
  OBSERVE_CANDIDATE_INVALID_COPY,
  OBSERVE_FAILURE_REASONS,
  OBSERVE_NO_CANDIDATES_COPY,
  OBSERVE_NOT_ELIGIBLE_COPY,
  OBSERVE_OBSERVED_COPY,
  OBSERVE_STALE_SOURCE_COPY,
  observeFailureCopy,
} from "./display";
import { selectObserveCandidates } from "./candidates";
import {
  claimTargetedObservation,
  findAnalyzedObservationForIdeaCrawl,
  findRunningTargetedObservation,
  findTargetedObservationForWebsite,
  finalizeTargetedObservation,
  listObserveLinks,
  listObservePages,
  listObserveQueueItems,
  loadSourceRobotsArtifact,
} from "./db";
import { fetchAndSaveTargetedPage, TargetedObserveFetchError } from "./fetch-page";
import {
  OBSERVE_STALE_RUNNING_MS,
  type ObserveCandidatesView,
  type TargetedObservation,
} from "./types";

export class ObserveError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = "ObserveError";
    this.code = code;
    this.status = status;
  }
}

async function requireEligibleT0(input: {
  websiteId: string;
  ideaId: string;
  sessionToken: string | null;
}) {
  const context = await requireObserveOwner(input);
  const idea = await findResearchIdeaForWebsite({
    ideaId: input.ideaId,
    websiteId: input.websiteId,
  });
  if (!idea) {
    throw new ObserveError("idea_not_found", "Foundfy could not find that related search.", 404);
  }

  const run = await findResearchRunForWebsite({
    runId: idea.runId,
    websiteId: input.websiteId,
  });
  if (!run || run.status !== "completed") {
    throw new ObserveError(
      "run_not_completed",
      "Foundfy can inspect related searches only after research has completed.",
    );
  }

  const latestCrawl = await findLatestUsableCrawlRun(input.websiteId);
  if (!latestCrawl) {
    throw new ObserveError(
      "no_usable_crawl",
      "Complete a website crawl before Foundfy can check existing pages.",
    );
  }

  const t0 = await findLatestT0InspectRunForIdeaAndCrawl({
    websiteId: input.websiteId,
    researchIdeaId: idea.id,
    crawlRunId: latestCrawl.id,
  });
  if (!t0) {
    throw new ObserveError("t0_stale", OBSERVE_STALE_SOURCE_COPY);
  }

  if (t0.crawlRunId !== latestCrawl.id) {
    throw new ObserveError("t0_stale", OBSERVE_STALE_SOURCE_COPY);
  }

  const decision = await loadInspectDecision(t0.id);
  if (!decision || decision.inspectionState !== "no_obvious_match_in_current_crawl") {
    throw new ObserveError("t0_not_eligible", OBSERVE_NOT_ELIGIBLE_COPY);
  }

  const inspectCrawl = await findInspectCrawl(latestCrawl.id);
  if (!inspectCrawl) {
    throw new ObserveError("t0_stale", OBSERVE_STALE_SOURCE_COPY);
  }

  return { context, idea, latestCrawl, t0, decision };
}

export async function listObserveCandidatesForOwner(input: {
  websiteId: string;
  ideaId: string;
  sessionToken: string | null;
}): Promise<ObserveCandidatesView> {
  try {
    const { context, idea, latestCrawl, t0 } = await requireEligibleT0(input);
    const running = await findRunningTargetedObservation(input.websiteId);
    if (running) {
      return {
        status: "already_running",
        copy: OBSERVE_ALREADY_RUNNING_COPY,
        observation: running,
      };
    }

    const analyzed = await findAnalyzedObservationForIdeaCrawl({
      websiteId: input.websiteId,
      sourceCrawlRunId: latestCrawl.id,
      sourceResearchIdeaId: idea.id,
    });
    if (analyzed) {
      return {
        status: "observed",
        copy: OBSERVE_OBSERVED_COPY,
        observation: analyzed,
      };
    }

    const [queue, pages, links, robots] = await Promise.all([
      listObserveQueueItems(t0.crawlRunId),
      listObservePages(t0.crawlRunId),
      listObserveLinks(t0.crawlRunId),
      loadSourceRobotsArtifact(t0.crawlRunId),
    ]);

    const gscRows = t0.gscSearchSyncId
      ? (await listEvidenceForSync(t0.gscSearchSyncId))
          .filter((row) => row.evidenceType === "query_page")
          .map((row) => ({ pageUrl: row.pageUrl, queryText: row.queryText }))
      : [];

    const candidates = selectObserveCandidates({
      hostname: context.website.hostname,
      keyword: idea.keyword,
      seedOffering: idea.seedOffering,
      languageCode: idea.languageCode,
      queue,
      pages,
      links,
      gscRows,
      robots,
    });

    return {
      status: "candidates",
      copy: candidates.length === 0 ? OBSERVE_NO_CANDIDATES_COPY : null,
      candidates,
    };
  } catch (error) {
    if (error instanceof ObserveError && error.code === "t0_stale") {
      return { status: "stale_source", copy: OBSERVE_STALE_SOURCE_COPY };
    }
    if (error instanceof ObserveError && error.code === "t0_not_eligible") {
      return { status: "t0_not_eligible", copy: OBSERVE_NOT_ELIGIBLE_COPY };
    }
    throw error;
  }
}

function isStaleRunning(observation: TargetedObservation): boolean {
  const started = Date.parse(observation.startedAt);
  if (!Number.isFinite(started)) {
    return true;
  }
  return Date.now() - started > OBSERVE_STALE_RUNNING_MS;
}

export async function observeCandidateForOwner(input: {
  websiteId: string;
  ideaId: string;
  sessionToken: string | null;
  queueItemId: string;
}): Promise<{
  status: string;
  copy: string;
  observation?: TargetedObservation;
  httpAttempted: boolean;
}> {
  const { context, idea, latestCrawl, t0 } = await requireEligibleT0(input);

  const [queue, pages, links, robots] = await Promise.all([
    listObserveQueueItems(t0.crawlRunId),
    listObservePages(t0.crawlRunId),
    listObserveLinks(t0.crawlRunId),
    loadSourceRobotsArtifact(t0.crawlRunId),
  ]);
  const gscRows = t0.gscSearchSyncId
    ? (await listEvidenceForSync(t0.gscSearchSyncId))
        .filter((row) => row.evidenceType === "query_page")
        .map((row) => ({ pageUrl: row.pageUrl, queryText: row.queryText }))
    : [];
  const candidates = selectObserveCandidates({
    hostname: context.website.hostname,
    keyword: idea.keyword,
    seedOffering: idea.seedOffering,
    languageCode: idea.languageCode,
    queue,
    pages,
    links,
    gscRows,
    robots,
  });
  const selected = candidates.find((candidate) => candidate.queueItemId === input.queueItemId);
  if (!selected) {
    throw new ObserveError("candidate_invalid", OBSERVE_CANDIDATE_INVALID_COPY);
  }

  const requestedUrlKey = pageComparisonKey(selected.url);
  if (!requestedUrlKey) {
    throw new ObserveError("candidate_invalid", OBSERVE_CANDIDATE_INVALID_COPY);
  }

  const running = await findRunningTargetedObservation(input.websiteId);
  if (running && isStaleRunning(running)) {
    await finalizeTargetedObservation({
      observationId: running.id,
      status: "fetch_failed",
      resultPageId: null,
      failureReason: OBSERVE_FAILURE_REASONS.interrupted,
    });
  }

  const claimed = await claimTargetedObservation({
    websiteId: input.websiteId,
    sourceCrawlRunId: latestCrawl.id,
    sourceQueueId: selected.queueItemId,
    sourceInspectRunId: t0.id,
    requestedUrlKey,
    requestedBy: context.owner.id,
    selectionMode: "owner_selected",
  });

  if (claimed.status === "stale_source") {
    return { status: "stale_source", copy: OBSERVE_STALE_SOURCE_COPY, httpAttempted: false };
  }

  if (claimed.status === "already_running") {
    const observation = await findTargetedObservationForWebsite({
      websiteId: input.websiteId,
      observationId: claimed.observationId,
    });
    return {
      status: "already_running",
      copy: OBSERVE_ALREADY_RUNNING_COPY,
      observation: observation ?? undefined,
      httpAttempted: false,
    };
  }

  if (claimed.status === "reused") {
    const observation = await findTargetedObservationForWebsite({
      websiteId: input.websiteId,
      observationId: claimed.observationId,
    });
    return {
      status: "reused",
      copy: OBSERVE_OBSERVED_COPY,
      observation: observation ?? undefined,
      httpAttempted: false,
    };
  }

  try {
    const pageId = await fetchAndSaveTargetedPage({
      websiteId: input.websiteId,
      hostname: context.website.hostname,
      sourceCrawlRunId: t0.crawlRunId,
      targetedCrawlRunId: claimed.targetedCrawlRunId,
      requestedUrl: selected.url,
      startedAt: claimed.startedAt,
    });
    await finalizeTargetedObservation({
      observationId: claimed.observationId,
      status: "analyzed",
      resultPageId: pageId,
      failureReason: null,
    });
    const observation = await findTargetedObservationForWebsite({
      websiteId: input.websiteId,
      observationId: claimed.observationId,
    });
    return {
      status: "analyzed",
      copy: OBSERVE_OBSERVED_COPY,
      observation: observation ?? undefined,
      httpAttempted: true,
    };
  } catch (error) {
    const reason =
      error instanceof TargetedObserveFetchError
        ? error.reason
        : OBSERVE_FAILURE_REASONS.fetch_failed;
    await finalizeTargetedObservation({
      observationId: claimed.observationId,
      status: "fetch_failed",
      resultPageId: null,
      failureReason: reason,
    });
    return {
      status: "fetch_failed",
      copy: observeFailureCopy(reason),
      httpAttempted: reason !== OBSERVE_FAILURE_REASONS.robots_disallow,
    };
  }
}
