import { RESEARCH_ABANDONED_MS } from "./config";
import { ledgerEntrySafeToResume, safeUnattemptedEntries } from "./ledger";
import type {
  ResearchRequestLedgerEntry,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";

export function researchRunProgressAt(run: ResearchRunRecord): string | null {
  return run.lastProgressAt ?? run.updatedAt ?? run.startedAt ?? run.createdAt ?? null;
}

export function isAbandonedActiveRun(run: ResearchRunRecord, now: Date = new Date()): boolean {
  if (run.status !== "requested" && run.status !== "running") {
    return false;
  }

  const progress = Date.parse(researchRunProgressAt(run) ?? "");
  if (!Number.isFinite(progress)) {
    return true;
  }

  return now.getTime() - progress >= RESEARCH_ABANDONED_MS;
}

export function settleResearchRunStatus(ledger: ResearchRequestLedgerEntry[]): ResearchRunStatus {
  if (ledger.some((entry) => entry.status === "in_flight" || entry.status === "pending")) {
    return "interrupted";
  }

  const successful = ledger.filter(
    (entry) => entry.status === "succeeded" || entry.status === "zero_results",
  );
  const unfinished = ledger.filter(
    (entry) =>
      entry.status === "failed" ||
      entry.status === "timeout" ||
      entry.status === "rate_limited" ||
      entry.status === "skipped",
  );
  if (successful.length === 0) {
    return unfinished.some((entry) => ledgerEntrySafeToResume(entry)) ? "interrupted" : "failed";
  }
  if (unfinished.length > 0) {
    return unfinished.some((entry) => ledgerEntrySafeToResume(entry)) ? "interrupted" : "partial";
  }

  return "completed";
}

export function researchRunRecoveryState(
  run: ResearchRunRecord,
  now: Date = new Date(),
): {
  recoveryRequired: boolean;
  canResumeUnattempted: boolean;
  safeUnattemptedCount: number;
  displayInterrupted: boolean;
  displayClosed: boolean;
  canClose: boolean;
  canStartNewCycle: boolean;
} {
  const safe = safeUnattemptedEntries(run.requestLedger ?? []);
  const abandoned = isAbandonedActiveRun(run, now);
  if (run.status === "completed") {
    return {
      recoveryRequired: false,
      canResumeUnattempted: false,
      safeUnattemptedCount: 0,
      displayInterrupted: false,
      displayClosed: false,
      canClose: false,
      canStartNewCycle: false,
    };
  }

  if (run.status === "closed") {
    return {
      recoveryRequired: false,
      canResumeUnattempted: false,
      safeUnattemptedCount: 0,
      displayInterrupted: false,
      displayClosed: true,
      canClose: false,
      canStartNewCycle: true,
    };
  }

  const recoveryRequired =
    abandoned ||
    run.status === "interrupted" ||
    run.status === "partial" ||
    run.status === "failed";
  const canClose =
    run.status === "interrupted" || run.status === "partial" || run.status === "failed";

  return {
    recoveryRequired,
    canResumeUnattempted: recoveryRequired && safe.length > 0,
    safeUnattemptedCount: recoveryRequired ? safe.length : 0,
    displayInterrupted: recoveryRequired,
    displayClosed: false,
    canClose,
    canStartNewCycle: false,
  };
}
