import {
  findSearchSyncById,
  listCompletedSearchSyncsForWebsite,
  listEvidenceForSync,
} from "@/lib/gsc/db-search";
import type { GscSearchEvidenceRecord, GscSearchSyncRecord } from "@/lib/gsc/types";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";
import { gscQueryCompactSet } from "./gsc-join";
import { safeUnattemptedEntries } from "./ledger";
import type { ResearchRunRecord } from "./types";

function queryKeysFromEvidence(evidence: GscSearchEvidenceRecord[]): Set<string> {
  return gscQueryCompactSet(
    evidence.flatMap((row) =>
      row.evidenceType === "query" && row.queryText ? [row.queryText] : [],
    ),
  );
}

export async function loadLatestCompletedGscQueryKeys(websiteId: string): Promise<{
  sync: GscSearchSyncRecord | null;
  queryKeys: Set<string> | null;
}> {
  const syncs = await listCompletedSearchSyncsForWebsite(websiteId);
  const sync = syncs[0] ?? null;
  if (!sync) {
    return { sync: null, queryKeys: null };
  }

  const evidence = await listEvidenceForSync(sync.id);
  return {
    sync,
    queryKeys: queryKeysFromEvidence(evidence),
  };
}

export async function loadQueryKeysForResearchRun(
  run: Pick<ResearchRunRecord, "gscSyncId">,
): Promise<Set<string> | null> {
  if (run.gscSyncId == null) {
    return null;
  }

  const sync = await findSearchSyncById(run.gscSyncId);
  if (!sync) {
    throw new ResearchGateError(
      "not_recoverable",
      researchGate("not_recoverable").message,
      409,
    );
  }

  const evidence = await listEvidenceForSync(sync.id);
  return queryKeysFromEvidence(evidence);
}

export function researchRunMayCallProvider(run: Pick<ResearchRunRecord, "requestLedger">): boolean {
  const ledger = run.requestLedger ?? [];
  if (ledger.length === 0) {
    return true;
  }

  return safeUnattemptedEntries(ledger).length > 0;
}
