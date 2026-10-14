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
  RESEARCH_TEST_DATA_COPY,
  RESEARCH_TRUNCATED_COPY,
  currentGscSampleCopy,
  formatEstimatedMonthlySearches,
  researchEmptyCopy,
  researchEmptyOutcome,
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
  });
});
