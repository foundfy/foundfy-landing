import type { CrawlEvidenceContext, ObservationDraft } from "../types";
import { getRuleDefinition } from "../rules";
import {
  buildLinkSubjectKey,
  buildPageSubjectKey,
  buildUrlSubjectKey,
  extractSitemapUrls,
  isIndexablePage,
  normalizeComparableUrl,
  urlsMatch,
} from "../utils";

function buildCrawledUrlStatusMap(context: CrawlEvidenceContext): Map<string, number | null> {
  const map = new Map<string, number | null>();

  for (const page of context.pages) {
    const requested = normalizeComparableUrl(page.requestedUrl);
    const finalUrl = normalizeComparableUrl(page.finalUrl);

    if (requested) {
      map.set(requested, page.statusCode);
    }

    if (finalUrl) {
      map.set(finalUrl, page.statusCode);
    }
  }

  return map;
}

function buildIncomingInternalLinkTargets(context: CrawlEvidenceContext): Set<string> {
  const targets = new Set<string>();

  for (const link of context.links) {
    if (link.linkType !== "internal") {
      continue;
    }

    const normalized = normalizeComparableUrl(link.toUrl);
    if (normalized) {
      targets.add(normalized);
    }
  }

  return targets;
}

export function evaluateInternalStructure(context: CrawlEvidenceContext): ObservationDraft[] {
  const observations: ObservationDraft[] = [];
  const crawledStatuses = buildCrawledUrlStatusMap(context);
  const incomingInternalLinks = buildIncomingInternalLinkTargets(context);
  const sitemapUrls = extractSitemapUrls(
    context.artifacts.filter((artifact) => artifact.artifactType === "sitemap_xml"),
  );

  for (const page of context.pages.filter(isIndexablePage)) {
    if (page.internalLinkCount === 0) {
      const rule = getRuleDefinition("internal_structure.zero_internal_links");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:zero_internal_links`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          internalLinkCount: page.internalLinkCount,
        },
      });
    }
  }

  for (const link of context.links) {
    if (link.linkType !== "internal") {
      continue;
    }

    const normalizedTarget = normalizeComparableUrl(link.toUrl);
    if (!normalizedTarget) {
      continue;
    }

    const targetStatus = crawledStatuses.get(normalizedTarget);
    if (targetStatus === undefined || targetStatus === 200) {
      continue;
    }

    const rule = getRuleDefinition("internal_structure.broken_internal_link");
    observations.push({
      ruleKey: rule.key,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      pageId: link.fromPageId,
      pageUrl: context.pages.find((page) => page.id === link.fromPageId)?.finalUrl ?? null,
      subjectKey: buildLinkSubjectKey(link.id),
      evidence: {
        fromPageId: link.fromPageId,
        linkToUrl: link.toUrl,
        anchorText: link.anchorText,
        targetStatusCode: targetStatus,
        evidenceScope:
          "Only internal links whose targets were crawled in this run can be classified as broken.",
      },
    });
  }

  for (const sitemapUrl of sitemapUrls) {
    const normalizedSitemapUrl = normalizeComparableUrl(sitemapUrl);
    if (!normalizedSitemapUrl) {
      continue;
    }

    const matchingPage = context.pages.find(
      (page) =>
        urlsMatch(page.finalUrl, sitemapUrl) || urlsMatch(page.requestedUrl, sitemapUrl),
    );

    if (!matchingPage || !isIndexablePage(matchingPage)) {
      continue;
    }

    if (incomingInternalLinks.has(normalizedSitemapUrl)) {
      continue;
    }

    const rule = getRuleDefinition("internal_structure.orphan_sitemap_page");
    observations.push({
      ruleKey: rule.key,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      pageId: matchingPage.id,
      pageUrl: matchingPage.finalUrl,
      subjectKey: buildUrlSubjectKey(sitemapUrl),
      evidence: {
        sitemapUrl,
        finalUrl: matchingPage.finalUrl,
        incomingInternalLinksFound: false,
        evidenceScope:
          "Orphan detection is limited to sitemap URLs crawled in this run with no incoming internal links observed among crawled pages.",
      },
    });
  }

  return observations;
}
