import { findWebsiteGoals } from "@/lib/goals/repository";
import {
  findLatestCompletedSearchSync,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { findActivePropertyConnection } from "@/lib/gsc/db";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { listObservations } from "@/lib/observations/db/repository";
import { listPriorities } from "@/lib/priorities/db/repository";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";
import { buildRankedDecisions } from "./candidates";
import { DECISION_ENGINE_VERSION } from "./config";
import {
  completeDecisionRun,
  failDecisionRun,
  insertRunningDecisionRun,
  markWebsiteDecisionRunsStale,
} from "./db";
import { DecisionPrerequisiteError, type DecisionRecord, type GoalSnapshot, type ObservationInput } from "./types";

function toGoalSnapshot(goal: NonNullable<Awaited<ReturnType<typeof findWebsiteGoals>>>): GoalSnapshot {
  return {
    id: goal.id,
    primaryType: goal.primaryType,
    secondaryType: goal.secondaryType,
    note: goal.note,
    updatedAt: goal.updatedAt,
  };
}

export async function loadDecisionPrerequisites(input: {
  websiteId: string;
  sessionToken: string | null;
}) {
  const context = await requireObserveOwner(input);
  const [siteModel, goal, crawl] = await Promise.all([
    findLatestConfirmedSiteModelForWebsite(input.websiteId),
    findWebsiteGoals(input.websiteId),
    findLatestUsableCrawlRun(input.websiteId),
  ]);

  if (!siteModel?.confirmed) {
    throw new DecisionPrerequisiteError(
      "missing_site_model",
      "Confirm how Foundfy understands this site before prioritizing actions.",
    );
  }

  if (!goal) {
    throw new DecisionPrerequisiteError(
      "missing_goal",
      "Tell Foundfy what should happen when the right people find this site before prioritizing actions.",
    );
  }

  if (!crawl) {
    throw new DecisionPrerequisiteError(
      "missing_crawl",
      "Complete a website crawl before Foundfy can prioritize actions.",
    );
  }

  const connection = await findActivePropertyConnection(input.websiteId);
  if (
    !connection ||
    connection.status !== "connected" ||
    connection.googleIdentityId !== context.owner.googleIdentityId
  ) {
    throw new DecisionPrerequisiteError(
      "google_not_connected",
      "Connect Google Search before Foundfy can combine search demand with website evidence.",
    );
  }

  const sync = await findLatestCompletedSearchSync(input.websiteId, connection.id);
  if (!sync) {
    throw new DecisionPrerequisiteError(
      "missing_gsc_sync",
      "Sync Google search data before Foundfy can prioritize cross-signal actions.",
    );
  }

  return {
    context,
    siteModel,
    goal: toGoalSnapshot(goal),
    crawl,
    connection,
    sync,
  };
}

export async function generateDecisionsForWebsite(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{ runId: string; decisions: DecisionRecord[] }> {
  const loaded = await loadDecisionPrerequisites(input);
  const evidence = await listEvidenceForSync(loaded.sync.id);
  const pages = evidence
    .filter((row) => row.evidenceType === "page" && row.pageUrl)
    .map((row) => ({
      id: row.id,
      pageUrl: row.pageUrl as string,
      pageId: row.pageId,
      clicks: row.clicks,
      impressions: row.impressions,
    }));

  const [observations, priorities] = await Promise.all([
    listObservations(loaded.crawl.id),
    listPriorities(loaded.crawl.id),
  ]);
  const priorityByObservation = new Map(priorities.map((priority) => [priority.observationId, priority]));
  const observationInputs: ObservationInput[] = observations.map((observation) => {
    const priority = priorityByObservation.get(observation.id);
    return {
      id: observation.id,
      pageId: observation.pageId ?? null,
      pageUrl: observation.pageUrl ?? null,
      ruleKey: observation.ruleKey,
      title: observation.title,
      description: observation.description,
      severity: observation.severity,
      status: observation.status,
      evidence: observation.evidence,
      priorityLevel: priority?.priorityLevel ?? null,
      priorityScore: priority?.priorityScore ?? null,
    };
  });

  const run = await insertRunningDecisionRun({
    websiteId: input.websiteId,
    siteModelId: loaded.siteModel.id,
    crawlRunId: loaded.crawl.id,
    gscSearchSyncId: loaded.sync.id,
    goal: loaded.goal,
    gscTruncated:
      loaded.sync.pagesTruncated || loaded.sync.queriesTruncated || loaded.sync.queryPagesTruncated,
  });

  try {
    const ranked = buildRankedDecisions({
      engine: {
        websiteId: input.websiteId,
        siteModelId: loaded.siteModel.id,
        crawlRunId: loaded.crawl.id,
        gscSearchSyncId: loaded.sync.id,
        engineVersion: DECISION_ENGINE_VERSION,
        goal: loaded.goal,
        gscTruncated:
          loaded.sync.pagesTruncated ||
          loaded.sync.queriesTruncated ||
          loaded.sync.queryPagesTruncated,
        periodStart: loaded.sync.periodStart,
        periodEnd: loaded.sync.periodEnd,
      },
      pages,
      observations: observationInputs,
    });

    const completed = await completeDecisionRun({
      id: run.id,
      websiteId: input.websiteId,
      decisions: ranked,
    });
    await markWebsiteDecisionRunsStale(input.websiteId, completed.run.id);
    return { runId: completed.run.id, decisions: completed.decisions };
  } catch (error) {
    await failDecisionRun(run.id, "unavailable").catch(() => undefined);
    throw error;
  }
}
