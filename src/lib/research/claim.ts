import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import type { ResearchClaimResult, ResearchRunRecord } from "./types";

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
    return { kind: "reuse_active", run: active[0] };
  }

  const priorUnfinished = input.runs
    .filter((run) => {
      if (run.status !== "partial" && run.status !== "failed") {
        return false;
      }
      const createdAt = Date.parse(run.createdAt);
      return Number.isFinite(createdAt) && createdAt >= since;
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  if (priorUnfinished[0]) {
    return { kind: "block_retry", run: priorUnfinished[0] };
  }

  return { kind: "claimed", run: null };
}

export function createSerializedResearchClaim(input: {
  runs: ResearchRunRecord[];
  now?: Date;
  afterAcquire?: (fingerprint: string) => Promise<void>;
}): {
  claim: (args: {
    websiteId: string;
    requestFingerprint: string;
    insert: Omit<
      ResearchRunRecord,
      "id" | "status" | "requestLedger" | "providerCost" | "failureCode" | "failureMessage" | "createdAt" | "startedAt" | "completedAt" | "updatedAt"
    > & {
      requestFingerprint: string;
    };
  }) => Promise<ResearchClaimResult>;
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
      const key = `${args.websiteId}\0${args.requestFingerprint}`;
      return withLock(key, async () => {
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
        };
        input.runs.push(run);
        return { kind: "claimed", run };
      });
    },
  };
}
