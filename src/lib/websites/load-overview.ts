import { findWebsiteGoals } from "@/lib/goals/repository";
import type { WebsiteGoalsRecord } from "@/lib/goals/types";
import { loadCompletedCrawlResults } from "@/lib/findings/load-completed-results";
import { loadOrCreateSiteModel } from "@/lib/site-model/load-for-website";
import type { SiteModelRecord } from "@/lib/site-model/types";
import { loadTrustworthyFindingsCount } from "./findings-count";
import {
  findActiveCrawlRunForWebsite,
  findLatestUsableCrawlRun,
  getWebsiteById,
  isUsableWebsiteCrawlRun,
  listCrawlRunsForWebsite,
} from "./repository";
import type { ScanHistoryItem, WebsiteOverview } from "./types";

function buildScanHistoryItem(
  run: Awaited<ReturnType<typeof listCrawlRunsForWebsite>>[number],
  findingsCount: number | null,
): ScanHistoryItem {
  return {
    crawlRunId: run.id,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    pagesCrawled: run.pagesCrawled,
    findingsCount,
  };
}

export async function loadWebsiteOverview(
  websiteId: string,
): Promise<WebsiteOverview | null> {
  const website = await getWebsiteById(websiteId);
  if (!website) {
    return null;
  }

  const [runs, latestUsable, activeScan] = await Promise.all([
    listCrawlRunsForWebsite(websiteId),
    findLatestUsableCrawlRun(websiteId),
    findActiveCrawlRunForWebsite(websiteId),
  ]);

  const latestResults = latestUsable
    ? await loadCompletedCrawlResults(latestUsable.id)
    : null;

  const highlightedFindingIds = new Set(
    latestResults?.findingsSummary.highlightedFindingIds ?? [],
  );
  const highlightedFindings =
    latestResults?.findings.filter((finding) =>
      highlightedFindingIds.has(finding.id),
    ) ?? [];

  const findingsCounts = await Promise.all(
    runs.map((run) =>
      loadTrustworthyFindingsCount({
        crawlRunId: run.id,
        status: run.status,
        pagesCrawled: run.pagesCrawled,
      }),
    ),
  );

  const scanHistory = runs.map((run, index) =>
    buildScanHistoryItem(run, findingsCounts[index] ?? null),
  );

  let siteModel: SiteModelRecord | null = null;
  if (latestUsable) {
    try {
      siteModel = await loadOrCreateSiteModel({
        website,
        crawlRun: latestUsable,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load site model.";
      console.error("[Site Model] Failed to load or create site model:", message);
    }
  }

  let goals: WebsiteGoalsRecord | null = null;
  try {
    goals = await findWebsiteGoals(websiteId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load website goals.";
    console.error("[Goals] Failed to load website goals:", message);
  }

  return {
    website,
    latestUsableScan: latestUsable
      ? {
          crawlRunId: latestUsable.id,
          completedAt: latestUsable.completedAt ?? latestUsable.createdAt,
          pagesCrawled: latestUsable.pagesCrawled,
          findings: latestResults?.findings ?? [],
          findingsSummary:
            latestResults?.findingsSummary ?? {
              totalCount: 0,
              highlightedFindingIds: [],
              highlightGroups: [],
            },
          comparison: latestResults?.comparison ?? null,
          searchPresence: latestResults?.searchPresence ?? null,
          explanationEnrichmentStatus:
            latestResults?.explanationEnrichmentStatus ?? "disabled",
        }
      : null,
    highlightedFindings,
    siteModel,
    goals,
    activeScan: activeScan
      ? {
          crawlRunId: activeScan.id,
          status: activeScan.status as "queued" | "running",
          pagesCrawled: activeScan.pagesCrawled,
          maxPages: activeScan.maxPages,
        }
      : null,
    scanHistory,
  };
}

export { isUsableWebsiteCrawlRun };
