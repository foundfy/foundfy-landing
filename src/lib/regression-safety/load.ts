import {
  getCrawlRunSummary,
  listPageMetadataForCrawlRun,
  type PersistedPageMetadataRow,
} from "@/lib/crawler/db/repository";
import type { CrawlRunSummary } from "@/lib/crawler/types";
import { listObservations } from "@/lib/observations/db/repository";
import { evaluateManualSeoRegression } from "./compare";
import { pageEvidenceFromPersistedPage } from "./observe";
import type {
  CrawlMetadataSnapshot,
  PersistedRegressionCheckInput,
  RegressionSafetyReport,
} from "./types";

export type RegressionSafetyStores = {
  getCrawlRunSummary: (crawlRunId: string) => Promise<CrawlRunSummary | null>;
  listPageMetadataForCrawlRun: (crawlRunId: string) => Promise<PersistedPageMetadataRow[]>;
  listObservations: typeof listObservations;
};

const defaultStores: RegressionSafetyStores = {
  getCrawlRunSummary,
  listPageMetadataForCrawlRun,
  listObservations,
};

function snapshotFromPersistedRows(
  run: CrawlRunSummary,
  pages: PersistedPageMetadataRow[],
  findings?: CrawlMetadataSnapshot["findings"],
): CrawlMetadataSnapshot {
  return {
    websiteId: run.websiteId,
    crawlRunId: run.id,
    status: run.status,
    pagesCrawled: run.pagesCrawled,
    completedAt: run.completedAt,
    pages: pages.map((page) =>
      pageEvidenceFromPersistedPage({
        requestedUrl: page.requestedUrl,
        finalUrl: page.finalUrl,
        statusCode: page.statusCode,
        title: page.title,
        metaDescription: page.metaDescription,
        canonical: page.canonical,
        robotsMeta: page.robotsMeta,
        socialMetadata: page.socialMetadata,
      }),
    ),
    findings,
  };
}

async function loadFindings(
  crawlRunId: string,
  stores: RegressionSafetyStores,
): Promise<CrawlMetadataSnapshot["findings"] | undefined> {
  try {
    const observations = await stores.listObservations(crawlRunId);
    return observations.map((observation) => ({
      ruleKey: observation.ruleKey,
      pageUrl: observation.pageUrl,
    }));
  } catch {
    return undefined;
  }
}

function missingCrawlReport(
  input: PersistedRegressionCheckInput,
  summary: string,
): RegressionSafetyReport {
  return {
    verdict: "not_verified",
    websiteId: input.websiteId,
    urls: input.urls.map((url) => ({ url, matched: false })),
    baselineCrawlId: input.baselineCrawlId,
    baselineCompletedAt: null,
    verificationCrawlId: input.verificationCrawlId,
    verificationCompletedAt: null,
    originalIssueStatus: input.originalFindingRuleKey ? "not_verified" : null,
    checks: [],
    limitations: ["Required crawl evidence could not be loaded from stored pages."],
    summary,
  };
}

export async function evaluatePersistedManualSeoRegression(
  input: PersistedRegressionCheckInput,
  stores: RegressionSafetyStores = defaultStores,
): Promise<RegressionSafetyReport> {
  const [baselineRun, verificationRun] = await Promise.all([
    stores.getCrawlRunSummary(input.baselineCrawlId),
    stores.getCrawlRunSummary(input.verificationCrawlId),
  ]);

  if (!baselineRun || !verificationRun) {
    return missingCrawlReport(
      input,
      "Foundfy did not compare these scans because a required crawl could not be loaded.",
    );
  }

  const [baselinePages, verificationPages, baselineFindings, verificationFindings] =
    await Promise.all([
      stores.listPageMetadataForCrawlRun(input.baselineCrawlId),
      stores.listPageMetadataForCrawlRun(input.verificationCrawlId),
      loadFindings(input.baselineCrawlId, stores),
      loadFindings(input.verificationCrawlId, stores),
    ]);

  return evaluateManualSeoRegression({
    websiteId: input.websiteId,
    urls: input.urls,
    expectedChanges: input.expectedChanges,
    preserveFields: input.preserveFields,
    originalFindingRuleKey: input.originalFindingRuleKey,
    baseline: snapshotFromPersistedRows(baselineRun, baselinePages, baselineFindings),
    verification: snapshotFromPersistedRows(
      verificationRun,
      verificationPages,
      verificationFindings,
    ),
  });
}
