import {
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";
import { executeResearchLedger } from "./execute";
import { gscQueryCompactSet } from "./gsc-join";
import { safeUnattemptedEntries } from "./ledger";
import { loadResearchForOwner } from "./load";
import type { DataForSeoFetch } from "./provider/dataforseo-client";
import {
  assertResearchEnvironmentExecutable,
  resolveResearchProviderForEnvironment,
} from "./provider/resolve";
import type { ResearchProvider } from "./provider/types";
import { claimResearchRecovery, findResearchRunForWebsite } from "./repository";
import type { ResearchOwnerView } from "./types";

export type RecoverResearchInput = {
  websiteId: string;
  runId: string;
  sessionToken: string | null;
  env?: NodeJS.ProcessEnv;
  provider?: ResearchProvider;
  fetchImpl?: DataForSeoFetch;
};

export async function recoverResearchForOwner(
  input: RecoverResearchInput,
): Promise<ResearchOwnerView> {
  const context = await requireObserveOwner(input);
  const existing = await findResearchRunForWebsite({
    runId: input.runId,
    websiteId: input.websiteId,
  });
  if (!existing) {
    throw new ResearchGateError("not_recoverable", researchGate("not_recoverable").message, 404);
  }

  assertResearchEnvironmentExecutable({
    environment: existing.providerEnvironment,
    env: input.env,
  });

  const safe = safeUnattemptedEntries(existing.requestLedger);
  if (safe.length === 0 && existing.requestLedger.length > 0) {
    throw new ResearchGateError("retry_not_safe", researchGate("retry_not_safe").message, 409);
  }

  const provider =
    input.provider ??
    resolveResearchProviderForEnvironment({
      environment: existing.providerEnvironment,
      env: input.env,
      fetchImpl: input.fetchImpl,
    });

  const claim = await claimResearchRecovery({
    runId: input.runId,
    websiteId: input.websiteId,
  });
  if (claim.kind === "not_found" || !claim.run) {
    throw new ResearchGateError("not_recoverable", researchGate("not_recoverable").message, 404);
  }
  if (claim.kind === "recovery_busy") {
    throw new ResearchGateError("recovery_busy", researchGate("recovery_busy").message, 409);
  }
  if (claim.kind === "not_recoverable") {
    throw new ResearchGateError("not_recoverable", researchGate("not_recoverable").message, 409);
  }

  const run = claim.run;
  const syncs = await listCompletedSearchSyncsForWebsite(input.websiteId);
  const sync = syncs[0] ?? null;
  const evidence = sync ? await listEvidenceForSync(sync.id) : [];
  const queryKeys = gscQueryCompactSet(
    evidence.flatMap((row) =>
      row.evidenceType === "query" && row.queryText ? [row.queryText] : [],
    ),
  );

  await executeResearchLedger({
    run,
    websiteId: input.websiteId,
    hostname: context.website.hostname,
    queryKeys,
    provider,
  });

  return loadResearchForOwner(input);
}
