import {
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { selectClaimDecision } from "./claim";
import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import { selectResearchCountry } from "./countries";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";
import { executeResearchLedger } from "./execute";
import { researchRequestFingerprint } from "./fingerprint";
import { gscQueryCompactSet } from "./gsc-join";
import { researchLanguageCandidates, selectResearchLanguages } from "./languages";
import { loadResearchForOwner } from "./load";
import { selectResearchOfferings, validConfirmedOfferings } from "./offerings";
import type { DataForSeoFetch } from "./provider/dataforseo-client";
import { FIXTURE_RESEARCH_COUNTRIES, FIXTURE_RESEARCH_LANGUAGES } from "./provider/fixture-metadata";
import { resolveResearchProvider } from "./provider/resolve";
import type { ResearchProvider } from "./provider/types";
import {
  activeConfirmedSiteModel,
  assertRequestCap,
} from "./readiness";
import {
  claimResearchRun,
  listResearchRunsForFingerprint,
} from "./repository";
import type { ResearchOwnerView } from "./types";

export type StartResearchInput = {
  websiteId: string;
  sessionToken: string | null;
  selectedOfferings?: string[];
  countryKey?: string;
  languages?: string[];
  env?: NodeJS.ProcessEnv;
  provider?: ResearchProvider;
  fetchImpl?: DataForSeoFetch;
  now?: Date;
};

function shouldReturnExisting(kind: string): boolean {
  return (
    kind === "reuse_completed" ||
    kind === "reuse_active" ||
    kind === "recovery_required" ||
    kind === "block_retry"
  );
}

export async function startResearchForOwner(
  input: StartResearchInput,
): Promise<ResearchOwnerView> {
  const context = await requireObserveOwner(input);
  const model = activeConfirmedSiteModel(
    await findLatestConfirmedSiteModelForWebsite(input.websiteId),
  );
  if (!model?.confirmed) {
    throw new ResearchGateError(
      "no_confirmed_site_model",
      researchGate("no_confirmed_site_model").message,
    );
  }

  const hostname = context.website.hostname;
  const offerings = selectResearchOfferings({
    confirmedValid: validConfirmedOfferings(model.confirmed.offers, hostname),
    selected: input.selectedOfferings,
  });
  const country = selectResearchCountry({
    selected: input.countryKey,
    countries: FIXTURE_RESEARCH_COUNTRIES,
  });
  const languages = selectResearchLanguages({
    selected: input.languages,
    candidates: researchLanguageCandidates({
      htmlLangs: model.understanding.languages.htmlLangs,
      supported: FIXTURE_RESEARCH_LANGUAGES,
    }),
  });
  assertRequestCap(offerings.length, languages.length);

  const syncs = await listCompletedSearchSyncsForWebsite(input.websiteId);
  const sync = syncs[0] ?? null;
  if (!sync) {
    throw new ResearchGateError("no_gsc_sync", researchGate("no_gsc_sync").message);
  }

  const evidence = await listEvidenceForSync(sync.id);
  const queryKeys = gscQueryCompactSet(
    evidence.flatMap((row) =>
      row.evidenceType === "query" && row.queryText ? [row.queryText] : [],
    ),
  );

  const provider = input.provider ?? resolveResearchProvider({
    env: input.env,
    fetchImpl: input.fetchImpl,
  });
  const fingerprint = researchRequestFingerprint({
    websiteId: input.websiteId,
    siteModelId: model.id,
    confirmedAt: model.confirmed.confirmedAt,
    offerings,
    countryKey: country.key,
    languages,
    provider: provider.id,
    environment: provider.environment,
  });
  const now = input.now ?? new Date();
  const peek = selectClaimDecision({
    runs: await listResearchRunsForFingerprint({
      websiteId: input.websiteId,
      fingerprint,
    }),
    now,
  });
  if (shouldReturnExisting(peek.kind)) {
    return loadResearchForOwner(input);
  }

  const [countries, supportedLanguages] = await Promise.all([
    provider.listCountries(),
    provider.listLanguages(),
  ]);
  const providerCountry = selectResearchCountry({
    selected: country.key,
    countries,
  });
  const providerLanguages = selectResearchLanguages({
    selected: languages,
    candidates: researchLanguageCandidates({
      htmlLangs: model.understanding.languages.htmlLangs,
      supported: supportedLanguages,
    }),
  });

  const claim = await claimResearchRun({
    websiteId: input.websiteId,
    requestFingerprint: fingerprint,
    reuseSinceIso: new Date(now.getTime() - RESEARCH_REUSE_WINDOW_MS).toISOString(),
    siteModelId: model.id,
    siteModelConfirmedAt: model.confirmed.confirmedAt,
    requestedBy: context.owner.id,
    gscSyncId: sync.id,
    gscQueriesTruncated: sync.queriesTruncated,
    countryKey: providerCountry.key,
    countryName: providerCountry.name,
    locationCode: providerCountry.locationCode,
    languageCodes: providerLanguages,
    offeringSeeds: offerings,
    provider: provider.id,
    providerEnvironment: provider.environment,
  });
  if (shouldReturnExisting(claim.kind)) {
    return loadResearchForOwner(input);
  }

  await executeResearchLedger({
    run: claim.run,
    websiteId: input.websiteId,
    hostname,
    queryKeys,
    provider,
  });

  return loadResearchForOwner(input);
}
