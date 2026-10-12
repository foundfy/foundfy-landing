import { opportunityCompactKey } from "@/lib/opportunities/normalize";
import { RESEARCH_MAX_IDEAS_PER_REQUEST } from "./config";
import { ResearchExecutionSupersededError, ResearchProviderError } from "./errors";
import {
  createFencedResearchStore,
  throwIfSuperseded,
  type FencedIdeaInsert,
  type FencedResearchStore,
} from "./fence";
import { filterRelatedIdeas } from "./filter";
import { classifyGscSampleStatus } from "./gsc-join";
import {
  buildRequestPlan,
  findLedgerEntryByRequestKey,
  ledgerHasSecrets,
  uniquePlannedRequestKeys,
} from "./ledger";
import { settleResearchRunStatus } from "./recovery";
import {
  claimResearchRequest,
  finalizeFencedResearchRun,
  persistResearchRequestPlan,
  persistResearchRequestResult,
  skipUnattemptedResearchRequests,
} from "./repository";
import type { RelatedKeywordIdeasResult, ResearchProvider } from "./provider/types";
import type {
  ResearchFenceOutcome,
  ResearchRequestLedgerEntry,
  ResearchRequestStatus,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";

type MaybePromise<T> = T | Promise<T>;

export type ResearchExecutionStore = {
  persistPlan: (
    input: Parameters<FencedResearchStore["persistPlan"]>[0],
  ) => MaybePromise<ReturnType<FencedResearchStore["persistPlan"]>>;
  claimRequest: (
    input: Parameters<FencedResearchStore["claimRequest"]>[0],
  ) => MaybePromise<ReturnType<FencedResearchStore["claimRequest"]>>;
  persistResult: (
    input: Parameters<FencedResearchStore["persistResult"]>[0],
  ) => MaybePromise<ReturnType<FencedResearchStore["persistResult"]>>;
  skipUnattempted: (
    input: Parameters<FencedResearchStore["skipUnattempted"]>[0],
  ) => MaybePromise<ReturnType<FencedResearchStore["skipUnattempted"]>>;
  finalize: (
    input: Parameters<FencedResearchStore["finalize"]>[0],
  ) => MaybePromise<ReturnType<FencedResearchStore["finalize"]>>;
};

const liveExecutionStore: ResearchExecutionStore = {
  persistPlan: (input) => persistResearchRequestPlan(input),
  claimRequest: (input) => claimResearchRequest(input),
  persistResult: (input) => persistResearchRequestResult(input),
  skipUnattempted: (input) => skipUnattemptedResearchRequests(input),
  finalize: (input) => finalizeFencedResearchRun(input),
};

function ledgerStatusForError(error: ResearchProviderError): Extract<
  ResearchRequestStatus,
  "failed" | "timeout" | "rate_limited"
> {
  if (error.code === "timeout") {
    return "timeout";
  }

  if (error.code === "rate_limited") {
    return "rate_limited";
  }

  return "failed";
}

function ensureRequestPlan(run: ResearchRunRecord, requestedAt: string): ResearchRequestLedgerEntry[] {
  if ((run.requestLedger ?? []).length > 0) {
    return serializeLedger(run.requestLedger);
  }

  return buildRequestPlan({
    offerings: run.offeringSeeds,
    languages: run.languageCodes,
    locationCode: run.locationCode,
    requestedAt,
  });
}

function serializeLedger(ledger: ResearchRequestLedgerEntry[]): ResearchRequestLedgerEntry[] {
  if (ledgerHasSecrets(ledger)) {
    throw new Error("Research request ledger refused to persist secrets.");
  }
  return ledger.map((entry) => ({ ...entry }));
}

function requireOwned(
  outcome: ResearchFenceOutcome,
  allowed: ResearchFenceOutcome[],
  message: string,
): void {
  throwIfSuperseded(outcome);
  if (!allowed.includes(outcome)) {
    throw new Error(message);
  }
}

export function executionStoreForRuns(
  runs: ResearchRunRecord[],
  ideas?: Parameters<typeof createFencedResearchStore>[0]["ideas"],
): ResearchExecutionStore {
  return createFencedResearchStore({ runs, ideas });
}

export async function executeResearchLedger(input: {
  run: ResearchRunRecord;
  websiteId: string;
  hostname: string;
  queryKeys: Set<string>;
  provider: ResearchProvider;
  store?: ResearchExecutionStore;
}): Promise<void> {
  const store = input.store ?? liveExecutionStore;
  const generation = input.run.executionGeneration;
  const startedAt = input.run.startedAt ?? new Date().toISOString();
  const planned = ensureRequestPlan(input.run, startedAt);

  if ((input.run.requestLedger ?? []).length === 0) {
    const plan = await Promise.resolve(
      store.persistPlan({
        runId: input.run.id,
        websiteId: input.websiteId,
        executionGeneration: generation,
        ledger: planned,
      }),
    );
    requireOwned(plan.outcome, ["persisted"], "Failed to persist research request plan.");
  }

  const plannedKeys = uniquePlannedRequestKeys(planned);
  let stopRemaining = false;
  let stopCode: string | null = null;
  let latestLedger = planned;

  try {
    for (const requestKey of plannedKeys) {
      const current = findLedgerEntryByRequestKey(planned, requestKey);
      if (!current) {
        continue;
      }

      if (stopRemaining) {
        const skipped = await Promise.resolve(
          store.skipUnattempted({
            runId: input.run.id,
            websiteId: input.websiteId,
            executionGeneration: generation,
            failureCode: stopCode,
          }),
        );
        requireOwned(skipped.outcome, ["persisted"], "Failed to skip remaining research requests.");
        if (skipped.run) {
          latestLedger = skipped.run.requestLedger;
        }
        break;
      }

      const claim = await Promise.resolve(
        store.claimRequest({
          runId: input.run.id,
          websiteId: input.websiteId,
          executionGeneration: generation,
          requestKey,
        }),
      );
      throwIfSuperseded(claim.outcome);
      if (claim.outcome === "already_attempted" || claim.outcome === "missing_request") {
        if (claim.run) {
          latestLedger = claim.run.requestLedger;
        }
        continue;
      }
      requireOwned(claim.outcome, ["claimed"], "Failed to claim research request.");
      if (claim.run) {
        latestLedger = claim.run.requestLedger;
      }

      let result: RelatedKeywordIdeasResult;
      let terminalStatus: Extract<
        ResearchRequestStatus,
        "succeeded" | "zero_results" | "failed" | "timeout" | "rate_limited"
      >;
      let ideas: FencedIdeaInsert[] = [];
      let ideaCount = 0;
      let providerTaskId: string | null = null;
      let providerCost: number | null = null;
      let failureCode: string | null = null;

      try {
        result = await input.provider.relatedKeywordIdeas({
          offering: current.seedOffering,
          locationCode: current.locationCode,
          languageCode: current.languageCode,
          limit: RESEARCH_MAX_IDEAS_PER_REQUEST,
        });
        providerTaskId = result.taskId;
        providerCost =
          result.providerCost != null && result.providerCost >= 0 ? result.providerCost : null;
        const filtered = filterRelatedIdeas({
          ideas: result.ideas,
          seedOffering: current.seedOffering,
          hostname: input.hostname,
        });
        ideas = filtered.map((idea) => ({
          runId: input.run.id,
          websiteId: input.websiteId,
          seedOffering: current.seedOffering,
          languageCode: current.languageCode,
          providerTaskId: result.taskId,
          keyword: idea.keyword,
          compactKey: opportunityCompactKey(idea.keyword),
          estimatedMonthlySearches:
            idea.searchVolume != null && idea.searchVolume >= 0 ? idea.searchVolume : null,
          providerResultOrder: idea.providerOrder,
          initialGscSampleStatus: classifyGscSampleStatus(idea.keyword, input.queryKeys),
          requestKey,
        }));
        ideaCount = filtered.length;
        terminalStatus = filtered.length === 0 ? "zero_results" : "succeeded";
      } catch (error) {
        const providerError =
          error instanceof ResearchProviderError
            ? error
            : new ResearchProviderError("server_error", "Provider request failed.", true);
        terminalStatus = ledgerStatusForError(providerError);
        failureCode = providerError.code;
        if (terminalStatus === "rate_limited" || providerError.code === "unauthorized") {
          stopRemaining = true;
          stopCode = providerError.code;
        }
      }

      const persisted = await Promise.resolve(
        store.persistResult({
          runId: input.run.id,
          websiteId: input.websiteId,
          executionGeneration: generation,
          requestKey,
          status: terminalStatus,
          providerTaskId,
          ideaCount,
          providerCost,
          failureCode,
          ideas,
        }),
      );
      requireOwned(persisted.outcome, ["persisted"], "Failed to persist research request result.");
      if (persisted.run) {
        latestLedger = persisted.run.requestLedger;
      }
    }

    const status = settleResearchRunStatus(latestLedger);
    const providerCost = latestLedger.reduce((sum, entry) => sum + (entry.providerCost ?? 0), 0);
    const finalized = await Promise.resolve(
      store.finalize({
        runId: input.run.id,
        websiteId: input.websiteId,
        executionGeneration: generation,
        status: status as Extract<ResearchRunStatus, "completed" | "partial" | "failed" | "interrupted">,
        providerCost: providerCost || null,
        failureCode:
          status === "failed" || status === "interrupted"
            ? (latestLedger.find((entry) => entry.failureCode)?.failureCode ?? "provider_failed")
            : null,
        failureMessage:
          status === "failed" || status === "interrupted"
            ? "Related demand research did not complete."
            : null,
        completedAt: status === "interrupted" ? null : new Date().toISOString(),
      }),
    );
    requireOwned(finalized.outcome, ["finalized"], "Failed to finalize research run.");
  } catch (error) {
    if (error instanceof ResearchExecutionSupersededError) {
      return;
    }
    throw error;
  }
}
