import { describe, expect, it } from "vitest";
import { RESEARCH_ABANDONED_MS, RESEARCH_REUSE_WINDOW_MS } from "./config";
import { buildRequestPlan } from "./ledger";
import { researchRequestKey } from "./request-key";
import {
  isAbandonedActiveRun,
  researchRunRecoveryState,
  settleResearchRunStatus,
} from "./recovery";
import type { ResearchRequestLedgerEntry, ResearchRunRecord } from "./types";

function run(overrides: Partial<ResearchRunRecord> = {}): ResearchRunRecord {
  return {
    id: "run-1",
    websiteId: "site-1",
    siteModelId: "model-1",
    siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
    requestedBy: "owner-1",
    gscSyncId: "sync-1",
    gscQueriesTruncated: false,
    countryKey: "ES",
    countryName: "Spain",
    locationCode: 2724,
    languageCodes: ["en"],
    offeringSeeds: ["silk paint"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "running",
    requestFingerprint: "a".repeat(64),
    requestLedger: [],
    providerCost: null,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    startedAt: "2026-10-10T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-10-10T00:00:00.000Z",
    lastProgressAt: "2026-10-10T00:00:00.000Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

describe("interrupted-run detection", () => {
  const now = new Date("2026-10-11T00:30:00.000Z");

  it("treats requested/running with no durable progress for 30 minutes as abandoned", () => {
    expect(
      isAbandonedActiveRun(
        run({
          lastProgressAt: new Date(now.getTime() - RESEARCH_ABANDONED_MS).toISOString(),
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isAbandonedActiveRun(
        run({ lastProgressAt: now.toISOString(), updatedAt: now.toISOString() }),
        now,
      ),
    ).toBe(false);
  });

  it("does not treat completed research as recovery-required after 30 days", () => {
    const state = researchRunRecoveryState(
      run({
        status: "completed",
        completedAt: new Date(now.getTime() - RESEARCH_REUSE_WINDOW_MS - 1000).toISOString(),
      }),
      now,
    );
    expect(state.recoveryRequired).toBe(false);
    expect(state.displayInterrupted).toBe(false);
  });

  it("keeps attempted interrupted research recovery-required after 30 days", () => {
    const ledger: ResearchRequestLedgerEntry[] = [
      {
        ...buildRequestPlan({
          offerings: ["silk paint"],
          languages: ["en"],
          locationCode: 2724,
          requestedAt: "2026-09-01T00:00:00.000Z",
        })[0]!,
        status: "in_flight",
        attemptedAt: "2026-09-01T00:00:01.000Z",
      },
    ];
    const state = researchRunRecoveryState(
      run({
        status: "interrupted",
        createdAt: "2026-09-01T00:00:00.000Z",
        requestLedger: ledger,
      }),
      now,
    );
    expect(state.recoveryRequired).toBe(true);
    expect(state.canResumeUnattempted).toBe(false);
  });

  it("stops recovery after explicit closure and allows a later new cycle", () => {
    const state = researchRunRecoveryState(run({ status: "closed", closedAt: now.toISOString() }), now);
    expect(state.recoveryRequired).toBe(false);
    expect(state.displayInterrupted).toBe(false);
    expect(state.displayClosed).toBe(true);
    expect(state.canClose).toBe(false);
    expect(state.canStartNewCycle).toBe(true);
  });

  it("settles remaining in_flight as interrupted rather than completed", () => {
    const pending = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2724,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    pending[0] = {
      ...pending[0]!,
      status: "in_flight",
      attemptedAt: "2026-10-11T00:00:01.000Z",
      requestKey: researchRequestKey("silk paint", "en"),
    };
    expect(settleResearchRunStatus(pending)).toBe("interrupted");
  });
});
