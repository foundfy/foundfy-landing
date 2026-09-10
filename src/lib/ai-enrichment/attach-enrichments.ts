import type {
  AnalysisFinding,
  FindingExplanationEnrichment,
} from "@/lib/analysis/crawl-status";
import { listExplanationEnrichments } from "./db/repository";
import type { ExplanationEnrichmentStatus } from "./types";

export function mapStoredExplanationToPublic(
  row: Awaited<ReturnType<typeof listExplanationEnrichments>>[number],
): FindingExplanationEnrichment | null {
  if (
    row.status !== "ready" ||
    !row.contextualExplanation ||
    !row.evidenceExplanation
  ) {
    return null;
  }

  return {
    contextualExplanation: row.contextualExplanation,
    evidenceExplanation: row.evidenceExplanation,
    citedEvidenceKeys: row.citedEvidenceKeys,
  };
}

export async function attachExplanationEnrichments(input: {
  crawlRunId: string;
  findings: AnalysisFinding[];
  highlightedFindingIds: string[];
}): Promise<{
  findings: AnalysisFinding[];
  explanationEnrichmentStatus: ExplanationEnrichmentStatus;
}> {
  let enrichments: Awaited<ReturnType<typeof listExplanationEnrichments>> = [];

  try {
    enrichments = await listExplanationEnrichments(input.crawlRunId);
  } catch {
    return {
      findings: input.findings,
      explanationEnrichmentStatus: "skipped",
    };
  }
  const enrichmentByFindingId = new Map(
    enrichments.map((row) => [row.findingId, row]),
  );

  const findings = input.findings.map((finding) => {
    const enrichment = enrichmentByFindingId.get(finding.id);
    const explanationEnrichment = enrichment
      ? mapStoredExplanationToPublic(enrichment)
      : null;

    return explanationEnrichment
      ? { ...finding, explanationEnrichment }
      : finding;
  });

  const explanationEnrichmentStatus = deriveExplanationEnrichmentStatus({
    highlightedFindingIds: input.highlightedFindingIds,
    enrichments,
  });

  return {
    findings,
    explanationEnrichmentStatus,
  };
}

export function deriveExplanationEnrichmentStatus(input: {
  highlightedFindingIds: string[];
  enrichments: Array<{ findingId: string; status: string }>;
}): ExplanationEnrichmentStatus {
  if (input.highlightedFindingIds.length === 0) {
    return "skipped";
  }

  const relevant = input.enrichments.filter((row) =>
    input.highlightedFindingIds.includes(row.findingId),
  );

  if (relevant.some((row) => row.status === "ready")) {
    if (
      input.highlightedFindingIds.every((findingId) =>
        relevant.some(
          (row) => row.findingId === findingId && row.status === "ready",
        ),
      )
    ) {
      return "ready";
    }

    if (relevant.some((row) => row.status === "pending")) {
      return "pending";
    }
  }

  if (relevant.some((row) => row.status === "pending")) {
    return "pending";
  }

  if (
    relevant.length > 0 &&
    relevant.every((row) => row.status === "failed")
  ) {
    return "failed";
  }

  if (relevant.length === 0) {
    return "pending";
  }

  return "failed";
}
