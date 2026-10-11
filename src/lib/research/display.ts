import type {
  CurrentGscSampleStatus,
  ResearchGate,
  ResearchGateCode,
  ResearchProviderEnvironment,
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
export const RESEARCH_EMPTY_COPY = "Foundfy did not keep related searches for this run.";
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
