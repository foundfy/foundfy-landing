import type {
  AnalysisFinding,
  HighlightGroupSummary,
} from "@/lib/analysis/crawl-status";
import { EXPLANATION_PROMPT_VERSION } from "../config";
import { pickWhitelistedEvidence } from "../evidence-whitelist";
import { hashExplanationInput } from "../input-hash";
import type { ExplanationInputFinding } from "../types";
import { buildGroupedExplanationInputFinding } from "./build-grouped-input";

export function buildExplanationInputFinding(
  finding: AnalysisFinding,
): ExplanationInputFinding {
  return {
    findingId: finding.id,
    ruleKey: finding.ruleKey as ExplanationInputFinding["ruleKey"],
    title: finding.title,
    description: finding.description,
    pageUrl: finding.pageUrl,
    whitelistedEvidence: pickWhitelistedEvidence(
      finding.ruleKey as ExplanationInputFinding["ruleKey"],
      finding.evidence,
    ),
    whyItMatters: finding.priority?.whyItMatters ?? null,
  };
}

export function resolveExplanationInputFinding(input: {
  finding: AnalysisFinding;
  highlightGroup?: HighlightGroupSummary;
  findingsById?: Map<string, AnalysisFinding>;
}): ExplanationInputFinding {
  if (
    input.highlightGroup &&
    input.highlightGroup.memberFindingIds.length > 1 &&
    input.findingsById
  ) {
    const members = input.highlightGroup.memberFindingIds
      .map((findingId) => input.findingsById?.get(findingId))
      .filter((finding): finding is AnalysisFinding => finding !== undefined);

    if (members.length === input.highlightGroup.memberFindingIds.length) {
      return buildGroupedExplanationInputFinding(input.finding, members);
    }
  }

  return buildExplanationInputFinding(input.finding);
}

export function buildExplanationInputHash(input: {
  hostname: string;
  pagesCrawled: number;
  finding: AnalysisFinding;
  highlightGroup?: HighlightGroupSummary;
  findingsById?: Map<string, AnalysisFinding>;
}): string {
  return hashExplanationInput({
    promptVersion: EXPLANATION_PROMPT_VERSION,
    hostname: input.hostname,
    pagesCrawled: input.pagesCrawled,
    finding: resolveExplanationInputFinding(input),
  });
}
