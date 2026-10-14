import { isAbandonedActiveRun } from "./recovery";
import {
  ledgerEntrySafeToResume,
  ledgerEntryWasAttempted,
  serializeRequestLedger,
} from "./ledger";
import { ResearchExecutionSupersededError } from "./errors";
import type {
  ResearchCloseOutcome,
  ResearchFenceOutcome,
  ResearchIdeaRecord,
  ResearchRequestLedgerEntry,
  ResearchRequestStatus,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";

export { ResearchExecutionSupersededError };

export type FencedIdeaInsert = Omit<ResearchIdeaRecord, "id" | "createdAt">;

export type FencedResearchStore = {
  persistPlan: (input: {
    runId: string;
    websiteId: string;
    executionGeneration: number;
    ledger: ResearchRequestLedgerEntry[];
  }) => { outcome: ResearchFenceOutcome; run: ResearchRunRecord | null };
  claimRequest: (input: {
    runId: string;
    websiteId: string;
    executionGeneration: number;
    requestKey: string;
  }) => { outcome: ResearchFenceOutcome; run: ResearchRunRecord | null };
  persistResult: (input: {
    runId: string;
    websiteId: string;
    executionGeneration: number;
    requestKey: string;
    status: Extract<
      ResearchRequestStatus,
      "succeeded" | "zero_results" | "failed" | "timeout" | "rate_limited"
    >;
    providerTaskId: string | null;
    ideaCount: number;
    providerResultCount?: number | null;
    providerCost: number | null;
    failureCode: string | null;
    ideas: FencedIdeaInsert[];
  }) => { outcome: ResearchFenceOutcome; run: ResearchRunRecord | null; ideas: ResearchIdeaRecord[] };
  skipUnattempted: (input: {
    runId: string;
    websiteId: string;
    executionGeneration: number;
    failureCode: string | null;
  }) => { outcome: ResearchFenceOutcome; run: ResearchRunRecord | null };
  finalize: (input: {
    runId: string;
    websiteId: string;
    executionGeneration: number;
    status: Extract<ResearchRunStatus, "completed" | "partial" | "failed" | "interrupted">;
    providerCost: number | null;
    failureCode: string | null;
    failureMessage: string | null;
    completedAt: string | null;
  }) => { outcome: ResearchFenceOutcome; run: ResearchRunRecord | null };
  recover: (input: {
    runId: string;
    websiteId: string;
    now?: Date;
  }) => { outcome: string; run: ResearchRunRecord | null };
  close: (input: {
    runId: string;
    websiteId: string;
    now?: Date;
  }) => { outcome: ResearchCloseOutcome; run: ResearchRunRecord | null };
};

function findEntry(
  ledger: ResearchRequestLedgerEntry[],
  requestKey: string,
): ResearchRequestLedgerEntry | null {
  return ledger.find((entry) => entry.requestKey === requestKey) ?? null;
}

function touch(run: ResearchRunRecord, now: Date): void {
  const timestamp = now.toISOString();
  run.updatedAt = timestamp;
  run.lastProgressAt = timestamp;
}

export function throwIfSuperseded(outcome: ResearchFenceOutcome): void {
  if (outcome === "superseded") {
    throw new ResearchExecutionSupersededError();
  }
}

export function createFencedResearchStore(input: {
  runs: ResearchRunRecord[];
  ideas?: ResearchIdeaRecord[];
}): FencedResearchStore {
  const ideas = input.ideas ?? [];
  let ideaSeq = 0;

  function requireRun(runId: string, websiteId: string): ResearchRunRecord | null {
    return input.runs.find((run) => run.id === runId && run.websiteId === websiteId) ?? null;
  }

  return {
    persistPlan(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "invalid_state", run: null };
      }
      if (rec.executionGeneration !== args.executionGeneration) {
        return { outcome: "superseded", run: rec };
      }
      if (rec.status !== "requested" && rec.status !== "running") {
        return { outcome: "invalid_state", run: rec };
      }
      if (rec.requestLedger.length > 0) {
        return { outcome: "persisted", run: rec };
      }
      rec.requestLedger = serializeRequestLedger(args.ledger);
      rec.status = "running";
      rec.startedAt = rec.startedAt ?? new Date().toISOString();
      touch(rec, new Date());
      return { outcome: "persisted", run: rec };
    },
    claimRequest(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "invalid_state", run: null };
      }
      if (rec.executionGeneration !== args.executionGeneration) {
        return { outcome: "superseded", run: rec };
      }
      if (rec.status !== "requested" && rec.status !== "running") {
        return { outcome: "invalid_state", run: rec };
      }
      const entry = findEntry(rec.requestLedger, args.requestKey);
      if (!entry) {
        return { outcome: "missing_request", run: rec };
      }
      if (!ledgerEntrySafeToResume(entry)) {
        return { outcome: "already_attempted", run: rec };
      }
      entry.status = "in_flight";
      entry.attemptedAt = new Date().toISOString();
      rec.status = "running";
      touch(rec, new Date());
      return { outcome: "claimed", run: rec };
    },
    persistResult(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "invalid_state", run: null, ideas: [] };
      }
      if (rec.executionGeneration !== args.executionGeneration) {
        return { outcome: "superseded", run: rec, ideas: [] };
      }
      if (rec.status !== "requested" && rec.status !== "running") {
        return { outcome: "invalid_state", run: rec, ideas: [] };
      }
      const entry = findEntry(rec.requestLedger, args.requestKey);
      if (!entry) {
        return { outcome: "missing_request", run: rec, ideas: [] };
      }
      if (!ledgerEntryWasAttempted(entry)) {
        return { outcome: "invalid_state", run: rec, ideas: [] };
      }
      const persisted: ResearchIdeaRecord[] = [];
      if (args.status === "succeeded" || args.status === "zero_results") {
        for (const idea of args.ideas) {
          const exists = ideas.some(
            (row) =>
              row.runId === idea.runId &&
              row.requestKey === idea.requestKey &&
              row.compactKey === idea.compactKey,
          );
          if (exists) {
            continue;
          }
          ideaSeq += 1;
          const record: ResearchIdeaRecord = {
            ...idea,
            id: `idea-${ideaSeq}`,
            createdAt: new Date().toISOString(),
          };
          ideas.push(record);
          persisted.push(record);
        }
      }
      entry.status = args.status;
      entry.providerTaskId = args.providerTaskId;
      entry.retrievedAt = new Date().toISOString();
      entry.ideaCount = args.ideaCount;
      if (args.providerResultCount !== undefined) {
        entry.providerResultCount = args.providerResultCount;
      }
      entry.providerCost = args.providerCost;
      entry.failureCode = args.failureCode;
      touch(rec, new Date());
      return { outcome: "persisted", run: rec, ideas: persisted };
    },
    skipUnattempted(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "invalid_state", run: null };
      }
      if (rec.executionGeneration !== args.executionGeneration) {
        return { outcome: "superseded", run: rec };
      }
      if (rec.status !== "requested" && rec.status !== "running") {
        return { outcome: "invalid_state", run: rec };
      }
      for (const entry of rec.requestLedger) {
        if (ledgerEntrySafeToResume(entry)) {
          entry.status = "skipped";
          entry.attemptedAt = null;
          entry.failureCode = args.failureCode;
        }
      }
      touch(rec, new Date());
      return { outcome: "persisted", run: rec };
    },
    finalize(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "invalid_state", run: rec };
      }
      if (rec.executionGeneration !== args.executionGeneration) {
        return { outcome: "superseded", run: rec };
      }
      if (rec.status !== "requested" && rec.status !== "running") {
        return { outcome: "invalid_state", run: rec };
      }
      rec.status = args.status;
      rec.providerCost = args.providerCost;
      rec.failureCode = args.failureCode;
      rec.failureMessage = args.failureMessage;
      rec.completedAt = args.completedAt;
      touch(rec, new Date());
      return { outcome: "finalized", run: rec };
    },
    recover(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "not_found", run: null };
      }
      if (rec.status === "completed" || rec.status === "closed") {
        return { outcome: "not_recoverable", run: rec };
      }
      const now = args.now ?? new Date();
      if (
        (rec.status === "requested" || rec.status === "running") &&
        !isAbandonedActiveRun(rec, now)
      ) {
        return { outcome: "recovery_busy", run: rec };
      }
      if (
        rec.status !== "requested" &&
        rec.status !== "running" &&
        rec.status !== "interrupted" &&
        rec.status !== "partial" &&
        rec.status !== "failed"
      ) {
        return { outcome: "not_recoverable", run: rec };
      }
      rec.status = "running";
      rec.completedAt = null;
      rec.executionGeneration += 1;
      rec.startedAt = rec.startedAt ?? now.toISOString();
      touch(rec, now);
      return { outcome: "claimed_recovery", run: rec };
    },
    close(args) {
      const rec = requireRun(args.runId, args.websiteId);
      if (!rec) {
        return { outcome: "not_found", run: null };
      }
      if (rec.status === "closed") {
        return { outcome: "already_closed", run: rec };
      }
      const now = args.now ?? new Date();
      if (
        (rec.status === "requested" || rec.status === "running") &&
        !isAbandonedActiveRun(rec, now)
      ) {
        return { outcome: "recovery_busy", run: rec };
      }
      if (rec.status !== "interrupted" && rec.status !== "partial" && rec.status !== "failed") {
        return { outcome: "not_closeable", run: rec };
      }
      rec.status = "closed";
      rec.closedAt = now.toISOString();
      rec.executionGeneration += 1;
      touch(rec, now);
      return { outcome: "closed", run: rec };
    },
  };
}
