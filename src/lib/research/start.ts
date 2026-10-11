import { opportunityCompactKey } from "@/lib/opportunities/normalize";
import {
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { selectClaimDecision } from "./claim";
import { RESEARCH_MAX_IDEAS_PER_REQUEST, RESEARCH_REUSE_WINDOW_MS } from "./config";
import { selectResearchCountry } from "./countries";
import { researchGate } from "./display";
import { ResearchGateError, ResearchProviderError } from "./errors";
import { researchRequestFingerprint } from "./fingerprint";
import { filterRelatedIdeas } from "./filter";
import { classifyGscSampleStatus, gscQueryCompactSet } from "./gsc-join";
import { researchLanguageCandidates, selectResearchLanguages } from "./languages";
import { ledgerHasSecrets } from "./ledger";
import { loadResearchForOwner } from "./load";
import { selectResearchOfferings, validConfirmedOfferings } from "./offerings";
import type { DataForSeoFetch } from "./provider/dataforseo-client";
import { FIXTURE_RESEARCH_COUNTRIES, FIXTURE_RESEARCH_LANGUAGES } from "./provider/fixture-metadata";
import { resolveResearchProvider } from "./provider/resolve";
import type { RelatedKeywordIdeasResult, ResearchProvider } from "./provider/types";
import {
  activeConfirmedSiteModel,
  assertRequestCap,
} from "./readiness";
import {
  claimResearchRun,
  insertResearchIdeas,
  listResearchRunsForFingerprint,
  updateResearchRun,
} from "./repository";
import type {
  ResearchIdeaRecord,
  ResearchOwnerView,
  ResearchRequestLedgerEntry,
  ResearchRequestStatus,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";

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

function pairsForRun(offerings: string[], languages: string[]): Array<{ offering: string; language: string }> {
  const pairs: Array<{ offering: string; language: string }> = [];
  for (const offering of offerings) {
    for (const language of languages) {
      pairs.push({ offering, language });
    }
  }

  return pairs;
}

function ledgerStatusForError(error: ResearchProviderError): ResearchRequestStatus {
  if (error.code === "timeout") {
    return "timeout";
  }

  if (error.code === "rate_limited") {
    return "rate_limited";
  }

  return "failed";
}

function settleStatus(ledger: ResearchRequestLedgerEntry[]): ResearchRunStatus {
  const successful = ledger.filter(
    (entry) => entry.status === "succeeded" || entry.status === "zero_results",
  );
  const failed = ledger.filter(
    (entry) =>
      entry.status === "failed" ||
      entry.status === "timeout" ||
      entry.status === "rate_limited" ||
      entry.status === "skipped",
  );
  if (ledger.some((entry) => entry.status === "pending" || entry.status === "in_flight")) {
    return "running";
  }
  if (successful.length === 0) {
    return "failed";
  }
  if (failed.length > 0) {
    return "partial";
  }

  return "completed";
}

async function persistRunState(input: {
  id: string;
  status: ResearchRunStatus;
  ledger: ResearchRequestLedgerEntry[];
  providerCost?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}): Promise<void> {
  if (ledgerHasSecrets(input.ledger)) {
    throw new Error("Research request ledger refused to persist secrets.");
  }

  await updateResearchRun({
    id: input.id,
    status: input.status,
    requestLedger: input.ledger,
    providerCost: input.providerCost,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  });
}

function throwIfBlocked(kind: string): void {
  if (kind === "block_retry") {
    throw new ResearchGateError(
      "retry_not_safe",
      researchGate("retry_not_safe").message,
    );
  }
}

async function executeClaimedRun(input: {
  run: ResearchRunRecord;
  websiteId: string;
  hostname: string;
  offerings: string[];
  languages: string[];
  locationCode: number;
  queryKeys: Set<string>;
  provider: ResearchProvider;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  const ledger: ResearchRequestLedgerEntry[] = [];
  await persistRunState({
    id: input.run.id,
    status: "running",
    ledger,
    startedAt,
  });

  let stopRemaining = false;
  let stopCode: string | null = null;

  for (const pair of pairsForRun(input.offerings, input.languages)) {
    const requestedAt = new Date().toISOString();
    if (stopRemaining) {
      ledger.push({
        seedOffering: pair.offering,
        languageCode: pair.language,
        locationCode: input.locationCode,
        providerTaskId: null,
        status: "skipped",
        requestedAt,
        retrievedAt: null,
        ideaCount: 0,
        providerCost: null,
        failureCode: stopCode,
      });
      await persistRunState({ id: input.run.id, status: "running", ledger });
      continue;
    }

    ledger.push({
      seedOffering: pair.offering,
      languageCode: pair.language,
      locationCode: input.locationCode,
      providerTaskId: null,
      status: "pending",
      requestedAt,
      retrievedAt: null,
      ideaCount: 0,
      providerCost: null,
      failureCode: null,
    });
    await persistRunState({ id: input.run.id, status: "running", ledger });

    const current = ledger[ledger.length - 1];
    if (!current) {
      throw new Error("Research request ledger is missing the current pair.");
    }
    current.status = "in_flight";
    await persistRunState({ id: input.run.id, status: "running", ledger });

    let result: RelatedKeywordIdeasResult;
    try {
      result = await input.provider.relatedKeywordIdeas({
        offering: pair.offering,
        locationCode: input.locationCode,
        languageCode: pair.language,
        limit: RESEARCH_MAX_IDEAS_PER_REQUEST,
      });
    } catch (error) {
      const providerError =
        error instanceof ResearchProviderError
          ? error
          : new ResearchProviderError("server_error", "Provider request failed.", true);
      current.status = ledgerStatusForError(providerError);
      current.retrievedAt = new Date().toISOString();
      current.ideaCount = 0;
      current.providerCost = null;
      current.failureCode = providerError.code;
      await persistRunState({ id: input.run.id, status: "running", ledger });
      if (current.status === "rate_limited" || providerError.code === "unauthorized") {
        stopRemaining = true;
        stopCode = providerError.code;
      }
      continue;
    }

    current.providerTaskId = result.taskId;
    await persistRunState({ id: input.run.id, status: "running", ledger });

    const filtered = filterRelatedIdeas({
      ideas: result.ideas,
      seedOffering: pair.offering,
      hostname: input.hostname,
    });
    const ideas: Array<Omit<ResearchIdeaRecord, "id" | "createdAt">> = filtered.map((idea) => ({
      runId: input.run.id,
      websiteId: input.websiteId,
      seedOffering: pair.offering,
      languageCode: pair.language,
      providerTaskId: result.taskId,
      keyword: idea.keyword,
      compactKey: opportunityCompactKey(idea.keyword),
      estimatedMonthlySearches:
        idea.searchVolume != null && idea.searchVolume >= 0 ? idea.searchVolume : null,
      providerResultOrder: idea.providerOrder,
      initialGscSampleStatus: classifyGscSampleStatus(idea.keyword, input.queryKeys),
    }));
    await insertResearchIdeas(ideas);

    current.status = filtered.length === 0 ? "zero_results" : "succeeded";
    current.retrievedAt = new Date().toISOString();
    current.ideaCount = filtered.length;
    current.providerCost =
      result.providerCost != null && result.providerCost >= 0 ? result.providerCost : null;
    current.failureCode = null;
    await persistRunState({ id: input.run.id, status: "running", ledger });
  }

  const status = settleStatus(ledger);
  const providerCost = ledger.reduce((sum, entry) => sum + (entry.providerCost ?? 0), 0);
  await persistRunState({
    id: input.run.id,
    status,
    ledger,
    providerCost: providerCost || null,
    failureCode: status === "failed" ? (ledger[0]?.failureCode ?? "provider_failed") : null,
    failureMessage: status === "failed" ? "Related demand research did not complete." : null,
    completedAt: new Date().toISOString(),
  });
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
  if (peek.kind === "reuse_completed" || peek.kind === "reuse_active") {
    return loadResearchForOwner(input);
  }
  throwIfBlocked(peek.kind);

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
  if (claim.kind === "reuse_completed" || claim.kind === "reuse_active") {
    return loadResearchForOwner(input);
  }
  throwIfBlocked(claim.kind);

  await executeClaimedRun({
    run: claim.run,
    websiteId: input.websiteId,
    hostname,
    offerings,
    languages: providerLanguages,
    locationCode: providerCountry.locationCode,
    queryKeys,
    provider,
  });

  return loadResearchForOwner(input);
}
