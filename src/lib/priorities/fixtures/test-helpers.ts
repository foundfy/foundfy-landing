import type { RuleKey, StoredObservation } from "@/lib/observations/types";
import { RULE_DEFINITIONS } from "@/lib/observations/rules";

let observationCounter = 0;

export function buildStoredObservation(input: {
  id?: string;
  ruleKey: RuleKey;
  subjectKey: string;
  pageUrl?: string | null;
  severity?: StoredObservation["severity"];
  evidence?: Record<string, unknown>;
}): StoredObservation {
  observationCounter += 1;
  const definition = RULE_DEFINITIONS[input.ruleKey];

  return {
    id: input.id ?? `obs-${observationCounter}`,
    crawlRunId: "run-1",
    websiteId: "site-1",
    ruleKey: input.ruleKey,
    category: definition.category,
    severity: input.severity ?? definition.severity,
    title: definition.title,
    description: definition.description,
    pageUrl: input.pageUrl ?? null,
    subjectKey: input.subjectKey,
    evidence: input.evidence ?? {},
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function resetObservationCounter() {
  observationCounter = 0;
}
