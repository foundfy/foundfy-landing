import type { SiteModelRecord } from "@/lib/site-model/types";
import {
  RESEARCH_MAX_OFFERINGS_PER_RUN,
  isResearchLiveEnabled,
  readDataForSeoCredentials,
  readResearchProviderMode,
  researchExecutionAvailable,
  researchSurfaceVisible,
} from "./config";
import { selectResearchCountry } from "./countries";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";
import { researchLanguageCandidates, selectResearchLanguages } from "./languages";
import { isNoGscLiveSpendAllowed } from "./no-gsc-live-allowlist";
import { selectResearchOfferings, validConfirmedOfferings } from "./offerings";
import { FIXTURE_RESEARCH_COUNTRIES, FIXTURE_RESEARCH_LANGUAGES } from "./provider/fixture-metadata";
import type {
  ResearchCountry,
  ResearchGate,
  ResearchLanguage,
  ResearchReadinessView,
} from "./types";

export function activeConfirmedSiteModel(
  model: SiteModelRecord | null,
): SiteModelRecord | null {
  if (!model?.confirmed) {
    return null;
  }

  if (model.status !== "confirmed" && model.status !== "stale") {
    return null;
  }

  return model;
}

function providerGate(env?: NodeJS.ProcessEnv): ResearchGate | null {
  const mode = readResearchProviderMode(env);
  if (mode === "disabled") {
    return researchGate("provider_disabled");
  }

  if (mode === "fixture") {
    return null;
  }

  if (!readDataForSeoCredentials(env)) {
    return researchGate("credentials_missing");
  }

  if (mode === "live" && !isResearchLiveEnabled(env)) {
    return researchGate("live_not_enabled");
  }

  return null;
}

export function evaluateResearchReadiness(input: {
  model: SiteModelRecord | null;
  hasCompletedGscSync: boolean;
  websiteId?: string;
  googleIdentityId?: string | null;
  htmlLangs?: string[];
  env?: NodeJS.ProcessEnv;
}): ResearchReadinessView {
  const mode = readResearchProviderMode(input.env);
  const countries = FIXTURE_RESEARCH_COUNTRIES.map(({ key, name }) => ({ key, name }));
  const languages = researchLanguageCandidates({
    htmlLangs: input.htmlLangs ?? input.model?.understanding.languages.htmlLangs,
    supported: FIXTURE_RESEARCH_LANGUAGES,
  });
  const confirmed = activeConfirmedSiteModel(input.model);
  const hostname = input.model?.understanding.hostname ?? "";
  const validOfferings = confirmed
    ? validConfirmedOfferings(confirmed.confirmed?.offers, hostname)
    : [];

  let gate: ResearchGate | null = null;
  if (!confirmed) {
    gate = researchGate("no_confirmed_site_model");
  } else if (validOfferings.length === 0) {
    gate = researchGate("no_valid_offering");
  } else if (languages.length === 0) {
    gate = researchGate("unsupported_language");
  } else {
    gate = providerGate(input.env);
    if (
      !gate &&
      !input.hasCompletedGscSync &&
      mode === "live" &&
      isResearchLiveEnabled(input.env)
    ) {
      if (
        !isNoGscLiveSpendAllowed({
          websiteId: input.websiteId ?? "",
          googleIdentityId: input.googleIdentityId,
          env: input.env,
        })
      ) {
        gate = researchGate("no_gsc_live_not_authorized");
      }
    }
  }

  return {
    gate,
    executionAvailable: gate == null && researchExecutionAvailable(input.env),
    surfaceVisible: researchSurfaceVisible(input.env),
    hasCompletedGscSync: input.hasCompletedGscSync,
    providerMode: mode,
    requiresOfferingSelection: validOfferings.length > RESEARCH_MAX_OFFERINGS_PER_RUN,
    validOfferings,
    countries,
    languages,
    understandingHref: "#site-understanding",
  };
}

export function resolveRunSelections(input: {
  hostname: string;
  offers: string[];
  htmlLangs: string[] | undefined;
  selectedOfferings: string[] | undefined;
  selectedCountry: string | undefined;
  selectedLanguages: string[] | undefined;
  countries: ResearchCountry[];
  supportedLanguages: ResearchLanguage[];
}): {
  offerings: string[];
  country: ResearchCountry;
  languages: string[];
} {
  const confirmedValid = validConfirmedOfferings(input.offers, input.hostname);
  const offerings = selectResearchOfferings({
    confirmedValid,
    selected: input.selectedOfferings,
  });
  const country = selectResearchCountry({
    selected: input.selectedCountry,
    countries: input.countries,
  });
  const candidates = researchLanguageCandidates({
    htmlLangs: input.htmlLangs,
    supported: input.supportedLanguages,
  });
  const languages = selectResearchLanguages({
    selected: input.selectedLanguages,
    candidates,
  });

  return { offerings, country, languages };
}

export function assertRequestCap(offeringCount: number, languageCount: number): void {
  const requests = offeringCount * languageCount;
  if (requests < 1 || requests > 15) {
    throw new ResearchGateError(
      "request_cap_exceeded",
      "Foundfy can research a limited number of offerings and languages at a time.",
      400,
    );
  }
}
