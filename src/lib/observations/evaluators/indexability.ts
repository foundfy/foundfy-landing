import type { CrawlEvidenceContext, ObservationDraft } from "../types";
import { getRuleDefinition } from "../rules";
import {
  buildPageSubjectKey,
  buildQueueSubjectKey,
  hasNoindex,
  isIndexablePage,
  urlsMatch,
} from "../utils";

export function evaluateIndexability(context: CrawlEvidenceContext): ObservationDraft[] {
  const observations: ObservationDraft[] = [];

  for (const page of context.pages) {
    if (page.statusCode !== 200) {
      const rule = getRuleDefinition("indexability.non_200_page");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: buildPageSubjectKey(page.id),
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          statusCode: page.statusCode,
        },
      });
    }

    if (hasNoindex(page.robotsMeta, page.xRobotsTag)) {
      const rule = getRuleDefinition("indexability.noindex");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:noindex`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          robotsMeta: page.robotsMeta,
          xRobotsTag: page.xRobotsTag,
        },
      });
    }

    const hasRedirect =
      page.redirectChain.length > 0 || !urlsMatch(page.requestedUrl, page.finalUrl);

    if (hasRedirect) {
      const rule = getRuleDefinition("indexability.redirecting_url");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.requestedUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:redirect`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          redirectChain: page.redirectChain,
        },
      });
    }

    if (isIndexablePage(page) && !page.canonical) {
      const rule = getRuleDefinition("indexability.canonical_missing");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:canonical_missing`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          canonical: page.canonical,
        },
      });
    }

    if (
      isIndexablePage(page) &&
      page.canonical &&
      !urlsMatch(page.canonical, page.finalUrl, page.finalUrl)
    ) {
      const rule = getRuleDefinition("indexability.canonical_points_elsewhere");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:canonical_elsewhere`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          canonical: page.canonical,
        },
      });
    }
  }

  for (const item of context.queue) {
    if (item.status === "skipped" && item.skipReason === "robots_disallow") {
      const rule = getRuleDefinition("indexability.robots_blocked_url");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageUrl: item.url,
        subjectKey: buildQueueSubjectKey(item.id),
        evidence: {
          queueUrl: item.url,
          queueStatus: item.status,
          skipReason: item.skipReason,
        },
      });
    }
  }

  return observations;
}
