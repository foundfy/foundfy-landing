import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findResearchRunForWebsiteMock = vi.fn();
const closeResearchRunMock = vi.fn();
const claimResearchRecoveryMock = vi.fn();
const claimResearchRunMock = vi.fn();
const loadResearchForOwnerMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("./repository", () => ({
  findResearchRunForWebsite: (...args: unknown[]) => findResearchRunForWebsiteMock(...args),
  closeResearchRun: (...args: unknown[]) => closeResearchRunMock(...args),
  claimResearchRecovery: (...args: unknown[]) => claimResearchRecoveryMock(...args),
  claimResearchRun: (...args: unknown[]) => claimResearchRunMock(...args),
}));

vi.mock("./load", () => ({
  loadResearchForOwner: (...args: unknown[]) => loadResearchForOwnerMock(...args),
}));

import { closeResearchForOwner } from "./close";
import type { ResearchRunRecord } from "./types";

function interruptedRun(): ResearchRunRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    websiteId: "site-1",
    siteModelId: "model-1",
    siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
    requestedBy: "owner-1",
    gscSyncId: "sync-1",
    gscQueriesTruncated: false,
    countryKey: "US",
    countryName: "United States",
    locationCode: 2840,
    languageCodes: ["en"],
    offeringSeeds: ["silk paint"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "interrupted",
    requestFingerprint: "f".repeat(64),
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
  };
}

describe("closeResearchForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: "site-1", hostname: "example.com" },
      owner: { id: "owner-1" },
    });
    loadResearchForOwnerMock.mockResolvedValue({
      readiness: { gate: null, surfaceVisible: true },
      run: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "closed", canStartNewCycle: true },
    });
  });

  it("closes the historical run without creating a new cycle or invoking recovery", async () => {
    const existing = interruptedRun();
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    closeResearchRunMock.mockResolvedValue({
      outcome: "closed",
      run: { ...existing, status: "closed", closedAt: "2026-10-11T00:00:00.000Z", executionGeneration: 2 },
    });

    const view = await closeResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
    });

    expect(closeResearchRunMock).toHaveBeenCalledWith({
      runId: existing.id,
      websiteId: "site-1",
    });
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
    expect(view.run?.status).toBe("closed");
  });

  it("treats already_closed as a successful owner load", async () => {
    const existing = interruptedRun();
    existing.status = "closed";
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    closeResearchRunMock.mockResolvedValue({ outcome: "already_closed", run: existing });
    await closeResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
    });
    expect(loadResearchForOwnerMock).toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });
});
