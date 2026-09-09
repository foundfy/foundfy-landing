import type { CrawlEvidenceContext, ObservationDraft } from "../types";
import { getRuleDefinition } from "../rules";
import {
  buildSiteSubjectKey,
  buildUrlSubjectKey,
  extractSitemapUrls,
  normalizeComparableUrl,
  urlsMatch,
} from "../utils";

export function evaluateSiteDiscovery(context: CrawlEvidenceContext): ObservationDraft[] {
  const observations: ObservationDraft[] = [];

  const robotsArtifact = context.artifacts.find(
    (artifact) => artifact.artifactType === "robots_txt",
  );

  if (!robotsArtifact || !robotsArtifact.statusCode || robotsArtifact.statusCode >= 400) {
    const rule = getRuleDefinition("site_discovery.robots_txt_missing");
    observations.push({
      ruleKey: rule.key,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      subjectKey: buildSiteSubjectKey("robots_txt"),
      evidence: {
        robotsArtifactUrl: robotsArtifact?.url ?? null,
        statusCode: robotsArtifact?.statusCode ?? null,
      },
    });
  }

  const sitemapArtifacts = context.artifacts.filter(
    (artifact) => artifact.artifactType === "sitemap_xml",
  );
  const successfulSitemap = sitemapArtifacts.find(
    (artifact) => artifact.statusCode && artifact.statusCode < 400,
  );

  if (!successfulSitemap) {
    const rule = getRuleDefinition("site_discovery.sitemap_missing");
    observations.push({
      ruleKey: rule.key,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      subjectKey: buildSiteSubjectKey("sitemap"),
      evidence: {
        sitemapAttempts: sitemapArtifacts.map((artifact) => ({
          url: artifact.url,
          statusCode: artifact.statusCode,
        })),
      },
    });
  }

  const sitemapUrls = extractSitemapUrls(successfulSitemap ? [successfulSitemap] : sitemapArtifacts);

  for (const sitemapUrl of sitemapUrls) {
    const queueItem = context.queue.find((item) => urlsMatch(item.url, sitemapUrl));
    const page = context.pages.find(
      (entry) =>
        urlsMatch(entry.requestedUrl, sitemapUrl) || urlsMatch(entry.finalUrl, sitemapUrl),
    );

    if (queueItem?.status === "skipped" && queueItem.skipReason === "duplicate_final_url") {
      continue;
    }

    const queueIssue =
      queueItem &&
      (queueItem.status === "failed" ||
        (queueItem.status === "skipped" && queueItem.skipReason !== "robots_disallow"));

    const pageIssue = page && page.statusCode !== 200;
    const redirectIssue =
      page &&
      urlsMatch(page.requestedUrl, sitemapUrl) &&
      (page.redirectChain.length > 0 || !urlsMatch(page.requestedUrl, page.finalUrl));

    if (!queueIssue && !pageIssue && !redirectIssue) {
      continue;
    }

    const rule = getRuleDefinition("site_discovery.sitemap_url_issue");
    observations.push({
      ruleKey: rule.key,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      pageId: page?.id ?? null,
      pageUrl: page?.finalUrl ?? sitemapUrl,
      subjectKey: buildUrlSubjectKey(sitemapUrl),
      evidence: {
        sitemapUrl,
        queueStatus: queueItem?.status ?? null,
        queueSkipReason: queueItem?.skipReason ?? null,
        pageStatusCode: page?.statusCode ?? null,
        requestedUrl: page?.requestedUrl ?? null,
        finalUrl: page?.finalUrl ?? null,
        redirectChain: page?.redirectChain ?? [],
      },
    });
  }

  return observations;
}
