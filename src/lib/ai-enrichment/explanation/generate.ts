import type { HighlightGroupSummary } from "@/lib/analysis/crawl-status";
import { EXPLANATION_PROMPT_VERSION } from "../config";
import {
  listExplanationEnrichments,
  upsertExplanationEnrichment,
} from "../db/repository";
import {
  buildExplanationInputHash,
  resolveExplanationInputFinding,
} from "./build-input";
import { createOpenAiExplanationProvider } from "../providers/openai";
import {
  parseExplanationModelPayload,
  validateExplanationOutput,
} from "../validation";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { ExplanationProvider } from "../types";

export function shouldAutoGenerateExplanationEnrichment(input: {
  highlightedFindingIds: string[];
}): boolean {
  return input.highlightedFindingIds.length > 0;
}

function buildFindingsById(
  findings: AnalysisFinding[],
): Map<string, AnalysisFinding> {
  return new Map(findings.map((finding) => [finding.id, finding]));
}

function buildHighlightGroupByRepresentativeId(
  highlightGroups: HighlightGroupSummary[] | undefined,
): Map<string, HighlightGroupSummary> {
  return new Map(
    (highlightGroups ?? []).map((group) => [group.representativeFindingId, group]),
  );
}

function resolveHighlightGroupForFinding(input: {
  findingId: string;
  highlightGroupByRepresentativeId: Map<string, HighlightGroupSummary>;
}): HighlightGroupSummary | undefined {
  return input.highlightGroupByRepresentativeId.get(input.findingId);
}

export function selectFindingsNeedingExplanationEnrichment(input: {
  findings: AnalysisFinding[];
  findingIds: string[];
  existing: Array<{ findingId: string; inputHash: string; status: string }>;
  hostname: string;
  pagesCrawled: number;
  highlightGroups?: HighlightGroupSummary[];
}): AnalysisFinding[] {
  const existingByFindingId = new Map(
    input.existing.map((row) => [row.findingId, row]),
  );
  const findingsById = buildFindingsById(input.findings);
  const highlightGroupByRepresentativeId = buildHighlightGroupByRepresentativeId(
    input.highlightGroups,
  );

  return input.findings.filter((finding) => {
    if (!input.findingIds.includes(finding.id)) {
      return false;
    }

    const highlightGroup = resolveHighlightGroupForFinding({
      findingId: finding.id,
      highlightGroupByRepresentativeId,
    });
    const expectedHash = buildExplanationInputHash({
      hostname: input.hostname,
      pagesCrawled: input.pagesCrawled,
      finding,
      highlightGroup,
      findingsById,
    });
    const current = existingByFindingId.get(finding.id);

    if (!current) {
      return true;
    }

    if (current.status === "ready" && current.inputHash === expectedHash) {
      return false;
    }

    return current.inputHash !== expectedHash || current.status !== "ready";
  });
}

export async function generateExplanationEnrichments(input: {
  crawlRunId: string;
  hostname: string;
  pagesCrawled: number;
  findings: AnalysisFinding[];
  findingIds: string[];
  highlightGroups?: HighlightGroupSummary[];
  provider?: ExplanationProvider;
}): Promise<void> {
  const provider = input.provider ?? createOpenAiExplanationProvider();
  const findingsById = buildFindingsById(input.findings);
  const highlightGroupByRepresentativeId = buildHighlightGroupByRepresentativeId(
    input.highlightGroups,
  );
  const targets = selectFindingsNeedingExplanationEnrichment({
    findings: input.findings,
    findingIds: input.findingIds,
    existing: (await listExplanationEnrichments(input.crawlRunId)).map((row) => ({
      findingId: row.findingId,
      inputHash: row.inputHash,
      status: row.status,
    })),
    hostname: input.hostname,
    pagesCrawled: input.pagesCrawled,
    highlightGroups: input.highlightGroups,
  });

  if (targets.length === 0) {
    return;
  }

  for (const finding of targets) {
    const highlightGroup = resolveHighlightGroupForFinding({
      findingId: finding.id,
      highlightGroupByRepresentativeId,
    });

    await upsertExplanationEnrichment({
      crawlRunId: input.crawlRunId,
      findingId: finding.id,
      contextualExplanation: null,
      evidenceExplanation: null,
      citedEvidenceKeys: [],
      inputHash: buildExplanationInputHash({
        hostname: input.hostname,
        pagesCrawled: input.pagesCrawled,
        finding,
        highlightGroup,
        findingsById,
      }),
      model: provider.model,
      promptVersion: EXPLANATION_PROMPT_VERSION,
      status: "pending",
    });
  }

  try {
    const batchInput = {
      crawlRunId: input.crawlRunId,
      hostname: input.hostname,
      pagesCrawled: input.pagesCrawled,
      promptVersion: EXPLANATION_PROMPT_VERSION,
      findings: targets.map((finding) =>
        resolveExplanationInputFinding({
          finding,
          highlightGroup: resolveHighlightGroupForFinding({
            findingId: finding.id,
            highlightGroupByRepresentativeId,
          }),
          findingsById,
        }),
      ),
    };

    const rawPayload = await provider.generateExplanations(batchInput);
    const parsedPayload = parseExplanationModelPayload(rawPayload);

    if (!parsedPayload.ok) {
      throw new Error(
        parsedPayload.issues.map((issue) => issue.message).join(" "),
      );
    }

    const parsed = parsedPayload.explanations;

    const allowedFindingIds = new Set(targets.map((finding) => finding.id));
    const outputsByFindingId = new Map(parsed.map((item) => [item.findingId, item]));

    for (const finding of targets) {
      const highlightGroup = resolveHighlightGroupForFinding({
        findingId: finding.id,
        highlightGroupByRepresentativeId,
      });
      const explanationInput = resolveExplanationInputFinding({
        finding,
        highlightGroup,
        findingsById,
      });
      const inputHash = buildExplanationInputHash({
        hostname: input.hostname,
        pagesCrawled: input.pagesCrawled,
        finding,
        highlightGroup,
        findingsById,
      });
      const output = outputsByFindingId.get(finding.id);

      if (!output) {
        await upsertExplanationEnrichment({
          crawlRunId: input.crawlRunId,
          findingId: finding.id,
          contextualExplanation: null,
          evidenceExplanation: null,
          citedEvidenceKeys: [],
          inputHash,
          model: provider.model,
          promptVersion: EXPLANATION_PROMPT_VERSION,
          status: "failed",
        });
        continue;
      }

      const validation = validateExplanationOutput({
        output,
        finding: explanationInput,
        pagesCrawled: input.pagesCrawled,
        allowedFindingIds,
      });

      if (!validation.ok) {
        await upsertExplanationEnrichment({
          crawlRunId: input.crawlRunId,
          findingId: finding.id,
          contextualExplanation: null,
          evidenceExplanation: null,
          citedEvidenceKeys: [],
          inputHash,
          model: provider.model,
          promptVersion: EXPLANATION_PROMPT_VERSION,
          status: "failed",
        });
        continue;
      }

      await upsertExplanationEnrichment({
        crawlRunId: input.crawlRunId,
        findingId: finding.id,
        contextualExplanation: validation.value.contextualExplanation,
        evidenceExplanation: validation.value.evidenceExplanation,
        citedEvidenceKeys: validation.value.citedEvidenceKeys,
        inputHash,
        model: provider.model,
        promptVersion: EXPLANATION_PROMPT_VERSION,
        status: "ready",
      });
    }
  } catch {
    for (const finding of targets) {
      const highlightGroup = resolveHighlightGroupForFinding({
        findingId: finding.id,
        highlightGroupByRepresentativeId,
      });

      await upsertExplanationEnrichment({
        crawlRunId: input.crawlRunId,
        findingId: finding.id,
        contextualExplanation: null,
        evidenceExplanation: null,
        citedEvidenceKeys: [],
        inputHash: buildExplanationInputHash({
          hostname: input.hostname,
          pagesCrawled: input.pagesCrawled,
          finding,
          highlightGroup,
          findingsById,
        }),
        model: provider.model,
        promptVersion: EXPLANATION_PROMPT_VERSION,
        status: "failed",
      });
    }
  }
}
