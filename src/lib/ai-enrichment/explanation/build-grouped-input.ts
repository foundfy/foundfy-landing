import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { normalizeCrawlUrl } from "@/lib/crawler/url/normalize";
import {
  collectNormalizedAffectedSourceUrls,
  computeBrokenLinkAffectedPageCount,
} from "@/lib/findings/highlight-aggregation";
import { pickWhitelistedEvidence } from "../evidence-whitelist";
import type { ExplanationInputFinding } from "../types";
import { buildExplanationInputFinding } from "./build-input";

export const MAX_AFFECTED_SOURCE_URLS = 10;

function pickBrokenLinkEvidence(finding: AnalysisFinding): Record<string, unknown> {
  return pickWhitelistedEvidence(
    "internal_structure.broken_internal_link",
    finding.evidence,
  );
}

function buildBrokenLinkGroupedExplanationInput(
  representative: AnalysisFinding,
  members: AnalysisFinding[],
): ExplanationInputFinding {
  const memberEvidence = members.map((finding) => pickBrokenLinkEvidence(finding));
  const normalizedTargets = memberEvidence.map((evidence) => {
    const linkToUrl = evidence.linkToUrl;
    return typeof linkToUrl === "string" ? normalizeCrawlUrl(linkToUrl) : null;
  });

  const firstTarget = normalizedTargets[0];
  if (!firstTarget) {
    return buildExplanationInputFinding(representative);
  }

  if (normalizedTargets.some((target) => target !== firstTarget)) {
    return buildExplanationInputFinding(representative);
  }

  const firstEvidence = memberEvidence[0] ?? {};
  const targetStatusCode = firstEvidence.targetStatusCode;

  const anchorTexts = memberEvidence
    .map((evidence) => evidence.anchorText)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const unanimousAnchorText =
    anchorTexts.length > 0 && new Set(anchorTexts).size === 1
      ? anchorTexts[0]
      : undefined;

  const affectedSourceUrls = collectNormalizedAffectedSourceUrls(members).slice(
    0,
    MAX_AFFECTED_SOURCE_URLS,
  );

  const whitelistedEvidence: Record<string, unknown> = {
    linkToUrl: firstTarget,
    targetStatusCode,
    affectedPageCount: computeBrokenLinkAffectedPageCount(members),
    affectedSourceUrls,
  };

  if (unanimousAnchorText !== undefined) {
    whitelistedEvidence.anchorText = unanimousAnchorText;
  }

  return {
    findingId: representative.id,
    ruleKey: "internal_structure.broken_internal_link",
    title: representative.title,
    description: representative.description,
    pageUrl: representative.pageUrl,
    whitelistedEvidence,
    whyItMatters: representative.priority?.whyItMatters ?? null,
  };
}

export function buildGroupedExplanationInputFinding(
  representative: AnalysisFinding,
  members: AnalysisFinding[],
): ExplanationInputFinding {
  if (members.length <= 1) {
    return buildExplanationInputFinding(representative);
  }

  if (representative.ruleKey === "internal_structure.broken_internal_link") {
    return buildBrokenLinkGroupedExplanationInput(representative, members);
  }

  return buildExplanationInputFinding(representative);
}
