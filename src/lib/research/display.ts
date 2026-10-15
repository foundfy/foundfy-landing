import {
  FILTER_REASON_COUNT_KEYS,
  filterReasonCountSum,
  mergeFilterReasonCounts,
  type FilterReasonCountKey,
  type ResearchFilterReasonCounts,
} from "./filter-reasons";
import type {
  CurrentGscSampleStatus,
  ResearchEmptyOutcome,
  ResearchGate,
  ResearchGateCode,
  ResearchProviderEnvironment,
  ResearchRequestLedgerEntry,
} from "./types";

export const RESEARCH_SECTION_HEADING = "Search demand to explore";
export const RESEARCH_SECTION_COPY =
  "Explore searches related to offerings you confirmed for your business. Foundfy compares this external demand evidence with your current Google Search sample.";
export const RESEARCH_CTA_LABEL = "Research related demand";
export const RESEARCH_TEST_DATA_COPY = "Test data — this is not real market demand.";
export const RESEARCH_VOLUME_LABEL = "Estimated monthly searches";
export const RESEARCH_SOURCE_OFFERING_LABEL = "Confirmed offering";
export const RESEARCH_COUNTRY_LABEL = "Country";
export const RESEARCH_LANGUAGE_LABEL = "Language";
export const RESEARCH_RETRIEVED_LABEL = "Retrieved";
export const RESEARCH_EVIDENCE_LABEL = "Why Foundfy is showing this";
export const RESEARCH_PARTIAL_COPY = "Some related-demand requests did not finish, so this list may be incomplete.";
export const RESEARCH_INTERRUPTED_COPY = "This research run was interrupted.";
export const RESEARCH_NO_REPLAY_COPY =
  "Foundfy will not automatically repeat requests that may already have been sent.";
export const RESEARCH_RESUME_UNATTEMPTED_LABEL = "Resume unattempted requests";
export const RESEARCH_NO_SAFE_RETRY_COPY =
  "There are no requests Foundfy can safely repeat automatically.";
export const RESEARCH_CLOSED_COPY = "This research run was closed.";
export const RESEARCH_CLOSE_LABEL = "Close this research run";
export const RESEARCH_CLOSE_HELP_COPY =
  "Closing keeps this evidence and stops recovery for this run. You can start a new research cycle later if you choose.";
export const RESEARCH_NEW_CYCLE_LABEL = "Start a new research cycle";
export const RESEARCH_NEW_CYCLE_HELP_COPY =
  "This starts new external research. It is not a retry of the closed run.";
export const RESEARCH_EMPTY_COPY = "Foundfy did not keep related searches for this run.";
export const RESEARCH_PROVIDER_EMPTY_COPY =
  "The provider returned no related searches for this run.";
export const RESEARCH_FILTERED_EMPTY_COPY =
  "Foundfy did not keep any of the returned searches after applying its research criteria.";
export const RESEARCH_ERROR_COPY = "Foundfy couldn’t research related demand right now.";
export const RESEARCH_DISABLED_COPY = "Research is not available right now.";
export const RESEARCH_RETRY_NOT_SAFE_COPY =
  "Foundfy already started related-demand research for this selection and cannot safely run it again automatically.";
export const RESEARCH_STALE_COPY = "This related-demand evidence is out of date. Research again to refresh it.";
export const RESEARCH_UNDERSTANDING_HREF = "#site-understanding";

export const RESEARCH_NOT_IN_SAMPLE_COPY =
  "Foundfy did not see this search in the current Google Search sample for your site.";
export const RESEARCH_IN_SAMPLE_COPY =
  "Foundfy already sees this search in the current Google Search sample for your site.";
export const RESEARCH_GSC_UNAVAILABLE_COPY =
  "Foundfy cannot compare this search with Google Search data right now.";
export const RESEARCH_TRUNCATED_COPY =
  "Foundfy imports a bounded set of Google Search data, so your site may still appear for searches not shown here.";

export const RESEARCH_GATE_COPY: Record<ResearchGateCode, string> = {
  no_confirmed_site_model: "Confirm what your business offers before researching related search demand.",
  no_valid_offering: "Foundfy needs a clearer confirmed offering before researching related demand.",
  invalid_offering_selection: "Research offerings must match currently confirmed offerings.",
  offering_selection_required: "Choose up to 5 confirmed offerings to research.",
  no_research_country: "Choose the country you want Foundfy to research.",
  invalid_country: "Choose a country Foundfy can research.",
  no_research_language: "Choose the site languages you want Foundfy to research.",
  unsupported_language: "Choose a language Foundfy observed on this site.",
  no_gsc_sync: "Sync Google Search data before researching related demand.",
  provider_disabled: RESEARCH_DISABLED_COPY,
  live_not_enabled: RESEARCH_DISABLED_COPY,
  credentials_missing: RESEARCH_DISABLED_COPY,
  request_cap_exceeded: "Foundfy can research a limited number of offerings and languages at a time.",
  retry_not_safe: RESEARCH_RETRY_NOT_SAFE_COPY,
  recovery_busy: "Foundfy is already continuing this research run.",
  not_recoverable: "Foundfy cannot recover this research run automatically.",
  execution_superseded: "Foundfy is already continuing this research run.",
  already_closed: "This research run is already closed.",
  not_closeable: "Foundfy cannot close this research run right now.",
};

export function researchGate(code: ResearchGateCode, message?: string): ResearchGate {
  return { code, message: message ?? RESEARCH_GATE_COPY[code] };
}

export function currentGscSampleCopy(status: CurrentGscSampleStatus): string {
  if (status === "in_current_gsc_sample") {
    return RESEARCH_IN_SAMPLE_COPY;
  }

  if (status === "gsc_unavailable") {
    return RESEARCH_GSC_UNAVAILABLE_COPY;
  }

  return RESEARCH_NOT_IN_SAMPLE_COPY;
}

export function researchEmptyOutcome(input: {
  ideaCount: number;
  ledger: ResearchRequestLedgerEntry[];
}): ResearchEmptyOutcome | null {
  if (input.ideaCount > 0) {
    return null;
  }

  const counts = input.ledger
    .filter((entry) => entry.status === "succeeded" || entry.status === "zero_results")
    .map((entry) => entry.providerResultCount);
  if (counts.length === 0 || counts.some((count) => count == null)) {
    return "unknown";
  }

  if (counts.some((count) => (count ?? 0) > 0)) {
    return "filtered_all";
  }

  return "provider_empty";
}

export function researchEmptyCopy(outcome: ResearchEmptyOutcome | null): string {
  if (outcome === "provider_empty") {
    return RESEARCH_PROVIDER_EMPTY_COPY;
  }

  if (outcome === "filtered_all") {
    return RESEARCH_FILTERED_EMPTY_COPY;
  }

  return RESEARCH_EMPTY_COPY;
}

export function researchRunFilterProvenance(input: {
  ideaCount: number;
  ledger: ResearchRequestLedgerEntry[];
}): {
  providerResultCount: number | null;
  ideaCount: number;
  filterReasonCounts: ResearchFilterReasonCounts | null;
} {
  const terminal = input.ledger.filter(
    (entry) => entry.status === "succeeded" || entry.status === "zero_results",
  );
  if (terminal.length === 0) {
    return {
      providerResultCount: null,
      ideaCount: input.ideaCount,
      filterReasonCounts: null,
    };
  }

  if (terminal.some((entry) => entry.providerResultCount == null)) {
    return {
      providerResultCount: null,
      ideaCount: input.ideaCount,
      filterReasonCounts: null,
    };
  }

  const providerResultCount = terminal.reduce(
    (sum, entry) => sum + (entry.providerResultCount ?? 0),
    0,
  );

  return {
    providerResultCount,
    ideaCount: input.ideaCount,
    filterReasonCounts: mergeFilterReasonCounts(terminal.map((entry) => entry.filterReasonCounts)),
  };
}

export function researchReviewedKeptCopy(
  providerResultCount: number | null,
  ideaCount: number,
): string | null {
  if (providerResultCount == null || ideaCount <= 0 || providerResultCount <= ideaCount) {
    return null;
  }

  const searchNoun = providerResultCount === 1 ? "search" : "searches";
  return `Foundfy reviewed ${providerResultCount} related ${searchNoun} and kept ${ideaCount} that met its research criteria.`;
}

const FILTER_REASON_DETAIL_ORDER: FilterReasonCountKey[] = [...FILTER_REASON_COUNT_KEYS];

export function researchFilterReasonDetails(
  counts: ResearchFilterReasonCounts | null,
): string[] {
  if (!counts || filterReasonCountSum(counts) === 0) {
    return [];
  }

  const details: string[] = [];
  for (const key of FILTER_REASON_DETAIL_ORDER) {
    const count = counts[key];
    if (count <= 0) {
      continue;
    }
    const line = filterReasonDetailCopy(key, count);
    if (line) {
      details.push(line);
    }
  }
  return details;
}

function filterReasonDetailCopy(key: FilterReasonCountKey, count: number): string | null {
  if (count <= 0) {
    return null;
  }

  switch (key) {
    case "emptyCount":
      return count === 1
        ? "1 did not contain usable search text."
        : `${count} did not contain usable search text.`;
    case "invalidCount":
      return count === 1
        ? "1 contained unsupported search text."
        : `${count} contained unsupported search text.`;
    case "brandOnlyCount":
      return count === 1 ? "1 was only a brand search." : `${count} were only a brand search.`;
    case "seedDuplicateCount":
      return count === 1
        ? "1 matched the confirmed offering itself."
        : `${count} matched the confirmed offering itself.`;
    case "compactDuplicateCount":
      return count === 1
        ? "1 repeated another related search."
        : `${count} repeated another related search.`;
    case "cappedCount":
      return count === 1
        ? "1 was outside Foundfy's 20-result display limit."
        : `${count} were outside Foundfy's 20-result display limit.`;
  }
}

export function isResearchTestData(environment: ResearchProviderEnvironment): boolean {
  return environment !== "live";
}

export function formatEstimatedMonthlySearches(
  value: number | null,
  environment: ResearchProviderEnvironment,
): string | null {
  if (value == null) {
    return null;
  }

  const formatted = Math.round(value).toLocaleString("en-US");
  if (isResearchTestData(environment)) {
    return `${formatted} (test data)`;
  }

  return formatted;
}

export function formatResearchRetrievedAt(iso: string): string {
  const date = iso.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }

  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
