import {
  DecisionPrerequisiteError,
  type DecisionEmptyReason,
  type DecisionPrerequisiteReason,
  type DecisionRecord,
  type DecisionView,
  type DecisionsOwnerView,
  type GoalSnapshot,
} from "./types";
import { findLatestCompletedDecisionRun, listDecisionsForRun } from "./db";
import { loadDecisionPrerequisites } from "./generate";
import { goalContextCopy, matchingConfidenceCopy } from "./wording";

function gscDemand(refs: DecisionRecord["evidenceRefs"]): { appearances: number; visits: number } | null {
  const gsc = refs.filter((ref) => ref.kind === "gsc_evidence");
  if (gsc.length === 0) {
    return null;
  }

  return {
    appearances: gsc.reduce(
      (sum, ref) => sum + (typeof ref.snapshot.impressions === "number" ? ref.snapshot.impressions : 0),
      0,
    ),
    visits: gsc.reduce(
      (sum, ref) => sum + (typeof ref.snapshot.clicks === "number" ? ref.snapshot.clicks : 0),
      0,
    ),
  };
}

function websiteEvidenceCopy(decision: DecisionRecord): string {
  const observation = decision.evidenceRefs.find((ref) => ref.kind === "observation");
  const title =
    observation && typeof observation.snapshot.title === "string"
      ? observation.snapshot.title
      : null;

  if (decision.decisionType === "inspect_unanalyzed_page") {
    return "Foundfy has not yet crawled this Google-visible page.";
  }

  if (title) {
    return `Foundfy detected a ${title.toLowerCase()} on this page.`;
  }

  return decision.explanation;
}

export function toDecisionView(
  decision: DecisionRecord,
  goal: GoalSnapshot,
  truncated: boolean,
): DecisionView {
  const period = decision.evidenceRefs.find((ref) => ref.kind === "gsc_sync");

  return {
    id: decision.id,
    decisionType: decision.decisionType,
    title: decision.title,
    explanation: decision.explanation,
    pageUrl: decision.pageUrl,
    pageId: decision.pageId,
    priorityBand: decision.priorityBand,
    rank: decision.rank,
    scoring: decision.scoring,
    confidence: decision.confidence,
    why: {
      searchDemand: gscDemand(decision.evidenceRefs),
      websiteEvidence: websiteEvidenceCopy(decision),
      goalContext: goalContextCopy(goal),
      evidencePeriod:
        period &&
        typeof period.snapshot.periodStart === "string" &&
        typeof period.snapshot.periodEnd === "string"
          ? { start: period.snapshot.periodStart, end: period.snapshot.periodEnd }
          : null,
      matchingConfidence: matchingConfidenceCopy(decision.confidence),
      truncated,
    },
  };
}

export function staleReasonForRun(input: {
  run: {
    siteModelId: string;
    crawlRunId: string;
    gscSearchSyncId: string;
    goalSnapshot: GoalSnapshot;
  };
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string;
  goal: GoalSnapshot;
}): string | null {
  if (input.run.siteModelId !== input.siteModelId) {
    return "site_model";
  }

  if (input.run.crawlRunId !== input.crawlRunId) {
    return "crawl";
  }

  if (input.run.gscSearchSyncId !== input.gscSearchSyncId) {
    return "gsc_sync";
  }

  if (
    input.run.goalSnapshot.id !== input.goal.id ||
    input.run.goalSnapshot.updatedAt !== input.goal.updatedAt
  ) {
    return "goal";
  }

  return null;
}

function emptyReasonForCompletedRun(
  decisionCount: number,
  pageRowCount: number,
): DecisionEmptyReason | null {
  if (decisionCount > 0) {
    return null;
  }

  return pageRowCount === 0 ? "empty_gsc_evidence" : "no_cross_signal_candidates";
}

function ownerViewWithoutRun(input: {
  blocked: DecisionPrerequisiteReason | null;
  pageRowCount: number;
}): DecisionsOwnerView {
  if (input.blocked != null) {
    return {
      status: "blocked",
      current: false,
      staleReason: null,
      canGenerate: false,
      blockedReason: input.blocked,
      emptyReason: null,
      run: null,
      decisions: [],
    };
  }

  if (input.pageRowCount === 0) {
    return {
      status: "empty",
      current: false,
      staleReason: null,
      canGenerate: true,
      blockedReason: null,
      emptyReason: "empty_gsc_evidence",
      run: null,
      decisions: [],
    };
  }

  return {
    status: "not_generated",
    current: false,
    staleReason: null,
    canGenerate: true,
    blockedReason: null,
    emptyReason: null,
    run: null,
    decisions: [],
  };
}

export async function loadDecisionsForWebsite(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<DecisionsOwnerView> {
  let prerequisites: Awaited<ReturnType<typeof loadDecisionPrerequisites>> | null = null;
  let blocked: DecisionPrerequisiteReason | null = null;

  try {
    prerequisites = await loadDecisionPrerequisites(input);
  } catch (error) {
    if (error instanceof DecisionPrerequisiteError) {
      blocked = error.reason;
    } else {
      throw error;
    }
  }

  const run = await findLatestCompletedDecisionRun(input.websiteId);
  if (!run) {
    return ownerViewWithoutRun({
      blocked,
      pageRowCount: prerequisites?.sync.pageRowCount ?? 0,
    });
  }

  const decisions = await listDecisionsForRun(run.id);
  const stale =
    prerequisites == null
      ? "inputs"
      : staleReasonForRun({
          run,
          siteModelId: prerequisites.siteModel.id,
          crawlRunId: prerequisites.crawl.id,
          gscSearchSyncId: prerequisites.sync.id,
          goal: prerequisites.goal,
        });
  const emptyReason =
    prerequisites == null
      ? null
      : emptyReasonForCompletedRun(decisions.length, prerequisites.sync.pageRowCount);

  return {
    status: decisions.length === 0 ? "empty" : "completed",
    current: stale == null,
    staleReason: stale,
    canGenerate: blocked == null,
    blockedReason: blocked,
    emptyReason,
    run: {
      id: run.id,
      engineVersion: run.engineVersion,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    },
    decisions: decisions.map((decision) =>
      toDecisionView(decision, run.goalSnapshot, run.gscTruncated),
    ),
  };
}
