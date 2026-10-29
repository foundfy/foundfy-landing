import { describe, expect, it } from "vitest";
import {
  RESEARCH_CLOSE_LABEL,
  RESEARCH_CLOSED_COPY,
  RESEARCH_EMPTY_COPY,
  RESEARCH_FILTERED_EMPTY_COPY,
  RESEARCH_INTERRUPTED_COPY,
  RESEARCH_NEW_CYCLE_LABEL,
  RESEARCH_NOT_IN_SAMPLE_COPY,
  RESEARCH_NO_REPLAY_COPY,
  RESEARCH_NO_SAFE_RETRY_COPY,
  RESEARCH_PROVIDER_EMPTY_COPY,
  RESEARCH_RESUME_UNATTEMPTED_LABEL,
  RESEARCH_DISABLED_COPY,
  RESEARCH_NO_GSC_START_COPY,
  RESEARCH_NO_SAVED_EVIDENCE_COPY,
  RESEARCH_TEST_DATA_COPY,
  RESEARCH_TRUNCATED_COPY,
  RESEARCH_VOLUME_HELP_COPY,
  RESEARCH_VOLUME_LABEL,
  hasPersistedResearchEvidence,
  currentGscSampleCopy,
  formatEstimatedMonthlySearches,
  researchGate,
  researchEmptyCopy,
  researchEmptyOutcome,
  researchFilterReasonDetails,
  researchReviewedKeptCopy,
  researchRunFilterProvenance,
} from "./display";
import { researchRequestKey } from "./request-key";
import type { ResearchRequestLedgerEntry } from "./types";

describe("RESEARCH wording", () => {
  it("keeps GSC absence bounded and qualifies test data", () => {
    expect(currentGscSampleCopy("not_in_current_gsc_sample")).toBe(RESEARCH_NOT_IN_SAMPLE_COPY);
    expect(currentGscSampleCopy("not_in_current_gsc_sample")).not.toMatch(
      /rank|missing keyword|content gap|uncovered|increase traffic/i,
    );
    expect(formatEstimatedMonthlySearches(1200, "sandbox")).toBe("1,200 (test data)");
    expect(formatEstimatedMonthlySearches(1200, "live")).toBe("1,200");
    expect(formatEstimatedMonthlySearches(null, "live")).toBeNull();
    expect(RESEARCH_VOLUME_LABEL).toBe("Estimated monthly searches");
    expect(RESEARCH_VOLUME_HELP_COPY).toBe(
      "External estimate. This is not Google Search Console impressions.",
    );
    expect(RESEARCH_VOLUME_HELP_COPY.toLowerCase()).not.toContain("impressions from google");
    expect(RESEARCH_TEST_DATA_COPY).toMatch(/not real market demand/);
    expect(RESEARCH_TRUNCATED_COPY).toMatch(/bounded set of Google Search data/);
    expect(RESEARCH_INTERRUPTED_COPY).toBe("This research run was interrupted.");
    expect(RESEARCH_NO_REPLAY_COPY).toMatch(/will not automatically repeat requests/);
    expect(RESEARCH_RESUME_UNATTEMPTED_LABEL).toBe("Resume unattempted requests");
    expect(RESEARCH_NO_SAFE_RETRY_COPY).toMatch(/no requests Foundfy can safely repeat automatically/);
    expect(RESEARCH_RESUME_UNATTEMPTED_LABEL).not.toMatch(/retry all/i);
    expect(RESEARCH_CLOSED_COPY).toBe("This research run was closed.");
    expect(RESEARCH_CLOSE_LABEL).toBe("Close this research run");
    expect(RESEARCH_CLOSE_LABEL).not.toMatch(/retry/i);
    expect(RESEARCH_NEW_CYCLE_LABEL).toBe("Start a new research cycle");
    expect(RESEARCH_NEW_CYCLE_LABEL).not.toMatch(/retry/i);
    expect(RESEARCH_NO_SAVED_EVIDENCE_COPY).toMatch(/no saved related-demand evidence/);
    expect(currentGscSampleCopy("gsc_unavailable")).toMatch(/cannot compare this search/i);
    expect(RESEARCH_NO_GSC_START_COPY).toMatch(/without Google Search data/);
    expect(RESEARCH_NO_GSC_START_COPY).not.toMatch(/Sync Google Search data before researching/);
    expect(researchGate("no_gsc_live_not_authorized").message).toMatch(
      /without Google Search data is not enabled/,
    );
    expect(researchGate("no_gsc_live_not_authorized").message).not.toMatch(/allowlist|env/i);
    expect(RESEARCH_NO_SAVED_EVIDENCE_COPY).not.toBe(RESEARCH_DISABLED_COPY);
    expect(
      hasPersistedResearchEvidence({
        run: {
          id: "ca",
          ideas: [],
          filterReasonDetails: ["2 matched the confirmed offering itself."],
          emptyOutcome: "filtered_all",
        } as never,
        persistedRuns: [
          {
            id: "es",
            ideas: [{ keyword: "como pintar en seda" }],
            filterReasonDetails: [],
            emptyOutcome: null,
          } as never,
        ],
      }),
    ).toBe(true);
    expect(hasPersistedResearchEvidence({ run: null, persistedRuns: [] })).toBe(false);
  });

  it("keeps empty RESEARCH copy bounded and distinguishes provenance", () => {
    const ledger = (overrides: Partial<ResearchRequestLedgerEntry>): ResearchRequestLedgerEntry[] => [
      {
        requestKey: researchRequestKey("SEO audit for small businesses", "en"),
        seedOffering: "SEO audit for small businesses",
        languageCode: "en",
        locationCode: 2840,
        providerTaskId: "task-1",
        status: "zero_results",
        requestedAt: "2026-10-13T22:59:09.633Z",
        attemptedAt: "2026-10-13T22:59:10.051Z",
        retrievedAt: "2026-10-13T22:59:14.556Z",
        ideaCount: 0,
        providerResultCount: null,
        filterReasonCounts: null,
        providerCost: 0.09,
        failureCode: null,
        ...overrides,
      },
    ];

    expect(researchEmptyOutcome({ ideaCount: 1, ledger: ledger({}) })).toBeNull();
    expect(researchEmptyOutcome({ ideaCount: 0, ledger: ledger({ providerResultCount: null }) })).toBe(
      "unknown",
    );
    expect(researchEmptyOutcome({ ideaCount: 0, ledger: ledger({ providerResultCount: 0 }) })).toBe(
      "provider_empty",
    );
    expect(researchEmptyOutcome({ ideaCount: 0, ledger: ledger({ providerResultCount: 1 }) })).toBe(
      "filtered_all",
    );
    expect(researchEmptyCopy("unknown")).toBe(RESEARCH_EMPTY_COPY);
    expect(researchEmptyCopy("provider_empty")).toBe(RESEARCH_PROVIDER_EMPTY_COPY);
    expect(researchEmptyCopy("filtered_all")).toBe(RESEARCH_FILTERED_EMPTY_COPY);
    expect(RESEARCH_PROVIDER_EMPTY_COPY).not.toMatch(/no demand|no one searches|no volume|Google has no/i);
    expect(RESEARCH_FILTERED_EMPTY_COPY).not.toMatch(/no demand|keyword has no volume/i);
    expect(RESEARCH_FILTERED_EMPTY_COPY).toMatch(/research criteria/);
    expect(RESEARCH_FILTERED_EMPTY_COPY).not.toMatch(/after applying its filters/);
  });

  it("shows generic kept-of-reviewed copy without inventing historical reasons", () => {
    expect(researchReviewedKeptCopy(3, 1)).toBe(
      "Foundfy reviewed 3 related searches and kept 1 that met its research criteria.",
    );
    expect(researchReviewedKeptCopy(2, 1)).toBe(
      "Foundfy reviewed 2 related searches and kept 1 that met its research criteria.",
    );
    expect(researchReviewedKeptCopy(5, 3)).toBe(
      "Foundfy reviewed 5 related searches and kept 3 that met its research criteria.",
    );
    expect(researchReviewedKeptCopy(3, 3)).toBeNull();
    expect(researchReviewedKeptCopy(3, 0)).toBeNull();
    expect(researchReviewedKeptCopy(null, 1)).toBeNull();

    const dbhobby = researchRunFilterProvenance({
      ideaCount: 1,
      ledger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "es"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "es",
          locationCode: 2724,
          providerTaskId: "10151254-2775-0368-0000-6c3fca93a594",
          status: "succeeded",
          requestedAt: "2026-10-15T12:54:32.939Z",
          attemptedAt: "2026-10-15T12:54:33.385Z",
          retrievedAt: "2026-10-15T12:54:36.812Z",
          ideaCount: 1,
          providerResultCount: 3,
          filterReasonCounts: null,
          providerCost: 0.09,
          failureCode: null,
        },
      ],
    });
    expect(dbhobby.providerResultCount).toBe(3);
    expect(dbhobby.filterReasonCounts).toBeNull();
    expect(researchReviewedKeptCopy(dbhobby.providerResultCount, 1)).toBe(
      "Foundfy reviewed 3 related searches and kept 1 that met its research criteria.",
    );
    expect(researchFilterReasonDetails(dbhobby.filterReasonCounts)).toEqual([]);
    expect(researchFilterReasonDetails({
      emptyCount: 0,
      invalidCount: 0,
      brandOnlyCount: 1,
      seedDuplicateCount: 1,
      compactDuplicateCount: 0,
      cappedCount: 0,
    })).toEqual([
      "1 was only a brand search.",
      "1 matched the confirmed offering itself.",
    ]);
  });
});
