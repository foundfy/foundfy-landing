import { RESEARCH_ABANDONED_MS, RESEARCH_REUSE_WINDOW_MS } from "./config";
import { isAbandonedActiveRun } from "./recovery";
import type { ResearchClaimResult, ResearchRecoveryResult, ResearchRunRecord } from "./types";

export function selectClaimDecision(input: {
  runs: ResearchRunRecord[];
  now?: Date;
}): { kind: ResearchClaimResult["kind"]; run: ResearchRunRecord | null } {
  const now = input.now ?? new Date();
  const since = now.getTime() - RESEARCH_REUSE_WINDOW_MS;
  const completed = input.runs
    .filter((run) => {
      if (run.status !== "completed" || !run.completedAt) {
        return false;
      }
      const completedAt = Date.parse(run.completedAt);
      return Number.isFinite(completedAt) && completedAt >= since;
    })
    .sort((left, right) => Date.parse(right.completedAt ?? "") - Date.parse(left.completedAt ?? ""));
  if (completed[0]) {
    return { kind: "reuse_completed", run: completed[0] };
  }

  const active = input.runs
    .filter((run) => run.status === "requested" || run.status === "running")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  if (active[0]) {
    if (isAbandonedActiveRun(active[0], now)) {
      return { kind: "recovery_required", run: active[0] };
    }
    return { kind: "reuse_active", run: active[0] };
  }

  const recovery = input.runs
    .filter(
      (run) => run.status === "interrupted" || run.status === "partial" || run.status === "failed",
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  if (recovery[0]) {
    return { kind: "recovery_required", run: recovery[0] };
  }

  return { kind: "claimed", run: null };
}

function fingerprintLockKey(websiteId: string, requestFingerprint: string): string {
  return `${websiteId}\0${requestFingerprint}`;
}

export function createSerializedResearchClaim(input: {
  runs: ResearchRunRecord[];
  now?: Date;
  afterAcquire?: (fingerprint: string) => Promise<void>;
  onLocked?: (fingerprint: string) => void;
}): {
  claim: (args: {
    websiteId: string;
    requestFingerprint: string;
    insert: Omit<
      ResearchRunRecord,
      | "id"
      | "status"
      | "requestLedger"
      | "providerCost"
      | "failureCode"
      | "failureMessage"
      | "createdAt"
      | "startedAt"
      | "completedAt"
      | "updatedAt"
      | "lastProgressAt"
      | "executionGeneration"
      | "closedAt"
    > & {
      requestFingerprint: string;
    };
  }) => Promise<ResearchClaimResult>;
  finalize: (args: {
    id: string;
    executionGeneration: number;
    status: ResearchRunRecord["status"];
    requestLedger?: ResearchRunRecord["requestLedger"];
    completedAt?: string | null;
  }) => Promise<ResearchRunRecord>;
} {
  const tails = new Map<string, Promise<void>>();

  async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(
      key,
      previous.then(() => current),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    async claim(args) {
      const key = fingerprintLockKey(args.websiteId, args.requestFingerprint);
      return withLock(key, async () => {
        input.onLocked?.(args.requestFingerprint);
        if (input.afterAcquire) {
          await input.afterAcquire(args.requestFingerprint);
        }

        const matching = input.runs.filter(
          (run) =>
            run.websiteId === args.websiteId &&
            run.requestFingerprint === args.requestFingerprint,
        );
        const decision = selectClaimDecision({ runs: matching, now: input.now });
        if (decision.kind !== "claimed" && decision.run) {
          return { kind: decision.kind, run: decision.run };
        }

        const timestamp = (input.now ?? new Date()).toISOString();
        const run: ResearchRunRecord = {
          id: `run-${input.runs.length + 1}`,
          websiteId: args.websiteId,
          siteModelId: args.insert.siteModelId,
          siteModelConfirmedAt: args.insert.siteModelConfirmedAt,
          requestedBy: args.insert.requestedBy,
          gscSyncId: args.insert.gscSyncId,
          gscQueriesTruncated: args.insert.gscQueriesTruncated,
          countryKey: args.insert.countryKey,
          countryName: args.insert.countryName,
          locationCode: args.insert.locationCode,
          languageCodes: args.insert.languageCodes,
          offeringSeeds: args.insert.offeringSeeds,
          provider: args.insert.provider,
          providerEnvironment: args.insert.providerEnvironment,
          status: "requested",
          requestFingerprint: args.requestFingerprint,
          requestLedger: [],
          providerCost: null,
          failureCode: null,
          failureMessage: null,
          createdAt: timestamp,
          startedAt: null,
          completedAt: null,
          updatedAt: timestamp,
          lastProgressAt: timestamp,
          executionGeneration: 1,
          closedAt: null,
        };
        input.runs.push(run);
        return { kind: "claimed", run };
      });
    },
    async finalize(args) {
      const current = input.runs.find((run) => run.id === args.id);
      if (!current) {
        throw new Error("Research run not found.");
      }

      const key = fingerprintLockKey(current.websiteId, current.requestFingerprint);
      return withLock(key, async () => {
        if (current.executionGeneration !== args.executionGeneration) {
          throw new Error("execution_superseded");
        }
        if (current.status !== "requested" && current.status !== "running") {
          throw new Error("invalid_state");
        }
        current.status = args.status;
        if (args.requestLedger) {
          current.requestLedger = args.requestLedger;
        }
        if (args.completedAt !== undefined) {
          current.completedAt = args.completedAt;
        }
        current.updatedAt = (input.now ?? new Date()).toISOString();
        current.lastProgressAt = current.updatedAt;
        return current;
      });
    },
  };
}

export function createSerializedResearchRecovery(input: {
  runs: ResearchRunRecord[];
  now?: Date;
  afterAcquire?: (runId: string) => Promise<void>;
}): {
  recover: (args: { runId: string; websiteId: string }) => Promise<ResearchRecoveryResult>;
} {
  const tails = new Map<string, Promise<void>>();

  async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(
      key,
      previous.then(() => current),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    async recover(args) {
      const existing = input.runs.find(
        (run) => run.id === args.runId && run.websiteId === args.websiteId,
      );
      if (!existing) {
        return { kind: "not_found", run: null };
      }

      const key = fingerprintLockKey(existing.websiteId, existing.requestFingerprint);
      return withLock(key, async () => {
        if (input.afterAcquire) {
          await input.afterAcquire(args.runId);
        }

        const rec = input.runs.find(
          (run) => run.id === args.runId && run.websiteId === args.websiteId,
        );
        if (!rec) {
          return { kind: "not_found", run: null };
        }
        if (rec.status === "completed" || rec.status === "closed") {
          return { kind: "not_recoverable", run: rec };
        }

        const now = input.now ?? new Date();
        const abandoned = isAbandonedActiveRun(rec, now);
        if ((rec.status === "requested" || rec.status === "running") && !abandoned) {
          return { kind: "recovery_busy", run: rec };
        }
        if (
          rec.status !== "requested" &&
          rec.status !== "running" &&
          rec.status !== "interrupted" &&
          rec.status !== "partial" &&
          rec.status !== "failed"
        ) {
          return { kind: "not_recoverable", run: rec };
        }

        const timestamp = now.toISOString();
        rec.status = "running";
        rec.completedAt = null;
        rec.executionGeneration += 1;
        rec.lastProgressAt = timestamp;
        rec.updatedAt = timestamp;
        rec.startedAt = rec.startedAt ?? timestamp;
        return { kind: "claimed_recovery", run: rec };
      });
    },
  };
}

export function isResearchAbandonedThreshold(elapsedMs: number): boolean {
  return elapsedMs >= RESEARCH_ABANDONED_MS;
}
