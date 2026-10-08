import { describe, expect, it, vi } from "vitest";

const deleteOpenActionsForWebsiteMock = vi.fn();
const deleteActionLearningSnapshotsForWebsiteMock = vi.fn();
const scrubGoogleMetricsFromActionEvidenceMock = vi.fn();
const scrubGoogleMetricsFromReviewEvidenceMock = vi.fn();
const deleteDecisionEngineForWebsiteMock = vi.fn();
const deleteSearchAnalyticsForWebsiteMock = vi.fn();

vi.mock("./db", () => ({
  deleteOpenActionsForWebsite: (...args: unknown[]) => deleteOpenActionsForWebsiteMock(...args),
  deleteActionLearningSnapshotsForWebsite: (...args: unknown[]) =>
    deleteActionLearningSnapshotsForWebsiteMock(...args),
  scrubGoogleMetricsFromActionEvidence: (...args: unknown[]) =>
    scrubGoogleMetricsFromActionEvidenceMock(...args),
}));

vi.mock("./review-db", () => ({
  scrubGoogleMetricsFromReviewEvidence: (...args: unknown[]) =>
    scrubGoogleMetricsFromReviewEvidenceMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  deleteDecisionEngineForWebsite: (...args: unknown[]) =>
    deleteDecisionEngineForWebsiteMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  deleteSearchAnalyticsForWebsite: (...args: unknown[]) =>
    deleteSearchAnalyticsForWebsiteMock(...args),
}));

import { OPEN_ACTION_STATUSES } from "./config";
import { removeGoogleDerivedOwnerDataForWebsite } from "./google-privacy";

describe("disconnect/property-change Google-metric cleanup", () => {
  it("keeps executed and verified history instead of deleting every action", () => {
    expect(OPEN_ACTION_STATUSES).toEqual(["prepared", "awaiting_approval", "approved"]);
    expect(OPEN_ACTION_STATUSES).not.toContain("executed");
    expect(OPEN_ACTION_STATUSES).not.toContain("blocked");
    expect(OPEN_ACTION_STATUSES).not.toContain("cancelled");
  });

  it("removes Google metrics and open actions before deleting GSC evidence", async () => {
    deleteOpenActionsForWebsiteMock.mockResolvedValue(undefined);
    deleteActionLearningSnapshotsForWebsiteMock.mockResolvedValue(undefined);
    scrubGoogleMetricsFromActionEvidenceMock.mockResolvedValue(undefined);
    scrubGoogleMetricsFromReviewEvidenceMock.mockResolvedValue(undefined);
    deleteDecisionEngineForWebsiteMock.mockResolvedValue(undefined);
    deleteSearchAnalyticsForWebsiteMock.mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await removeGoogleDerivedOwnerDataForWebsite("website-1");

    expect(deleteOpenActionsForWebsiteMock).toHaveBeenCalledWith("website-1");
    expect(deleteActionLearningSnapshotsForWebsiteMock).toHaveBeenCalledWith("website-1");
    expect(scrubGoogleMetricsFromActionEvidenceMock).toHaveBeenCalledWith("website-1");
    expect(scrubGoogleMetricsFromReviewEvidenceMock).toHaveBeenCalledWith("website-1");
    expect(deleteDecisionEngineForWebsiteMock).toHaveBeenCalledWith("website-1");
    expect(scrubGoogleMetricsFromReviewEvidenceMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteSearchAnalyticsForWebsiteMock.mock.invocationCallOrder[0],
    );
    expect(deleteSearchAnalyticsForWebsiteMock).toHaveBeenCalledWith("website-1");
    expect(deleteActionLearningSnapshotsForWebsiteMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteSearchAnalyticsForWebsiteMock.mock.invocationCallOrder[0],
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
