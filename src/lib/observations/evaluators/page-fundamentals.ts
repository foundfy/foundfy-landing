import type { CrawlEvidenceContext, ObservationDraft } from "../types";
import { TITLE_LENGTH } from "../types";
import { getRuleDefinition } from "../rules";
import { buildPageSubjectKey, groupByNormalizedValue, isIndexablePage } from "../utils";

export function evaluatePageFundamentals(context: CrawlEvidenceContext): ObservationDraft[] {
  const observations: ObservationDraft[] = [];
  const indexablePages = context.pages.filter(isIndexablePage);

  for (const page of indexablePages) {
    const title = page.title?.trim() ?? "";

    if (!title) {
      const rule = getRuleDefinition("page_fundamentals.missing_title");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:missing_title`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          title: page.title,
        },
      });
    } else if (
      title.length < TITLE_LENGTH.minRecommended ||
      title.length > TITLE_LENGTH.maxRecommended
    ) {
      const rule = getRuleDefinition("page_fundamentals.title_length_out_of_range");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:title_length`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          title,
          titleLength: title.length,
          recommendedMin: TITLE_LENGTH.minRecommended,
          recommendedMax: TITLE_LENGTH.maxRecommended,
        },
      });
    }

    if (!page.metaDescription?.trim()) {
      const rule = getRuleDefinition("page_fundamentals.missing_meta_description");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:missing_meta_description`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          metaDescription: page.metaDescription,
        },
      });
    }

    if (page.h1.length === 0) {
      const rule = getRuleDefinition("page_fundamentals.missing_h1");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:missing_h1`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          h1: page.h1,
        },
      });
    }

    if (page.h1.length > 1) {
      const rule = getRuleDefinition("page_fundamentals.multiple_h1");
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:multiple_h1`,
        evidence: {
          requestedUrl: page.requestedUrl,
          finalUrl: page.finalUrl,
          h1: page.h1,
          h1Count: page.h1.length,
        },
      });
    }
  }

  const titleGroups = groupByNormalizedValue(indexablePages, (page) => page.title);
  for (const [, group] of titleGroups) {
    if (group.length < 2) {
      continue;
    }

    const rule = getRuleDefinition("page_fundamentals.duplicate_title");
    const duplicateUrls = group.map((page) => page.finalUrl);

    for (const page of group) {
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:duplicate_title`,
        evidence: {
          title: page.title,
          duplicatePages: duplicateUrls,
          pageCount: group.length,
        },
      });
    }
  }

  const descriptionGroups = groupByNormalizedValue(
    indexablePages,
    (page) => page.metaDescription,
  );
  for (const [, group] of descriptionGroups) {
    if (group.length < 2) {
      continue;
    }

    const rule = getRuleDefinition("page_fundamentals.duplicate_meta_description");
    const duplicateUrls = group.map((page) => page.finalUrl);

    for (const page of group) {
      observations.push({
        ruleKey: rule.key,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        pageId: page.id,
        pageUrl: page.finalUrl,
        subjectKey: `${buildPageSubjectKey(page.id)}:duplicate_meta_description`,
        evidence: {
          metaDescription: page.metaDescription,
          duplicatePages: duplicateUrls,
          pageCount: group.length,
        },
      });
    }
  }

  return observations;
}
