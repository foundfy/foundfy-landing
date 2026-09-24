import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Decision Engine v1 source boundary", () => {
  it("does not call OpenAI or create crawl findings/jobs", () => {
    const generate = read("./generate.ts");
    const candidates = read("./candidates.ts");
    const score = read("./score.ts");
    const engineFiles = [generate, candidates, score].join("\n");

    expect(engineFiles).not.toMatch(/openai|OpenAI/i);
    expect(generate).not.toMatch(/generateObservationsForCrawlRun|persistFindings|createJob|from \"@\/lib\/findings|from \"@\/lib\/jobs/);
    expect(generate).not.toMatch(/from \"@\/lib\/crawler/);
    expect(generate).not.toMatch(/confirmSiteModel|saveWebsiteGoals/);
    expect(score).not.toMatch(/\bctr\b|\bposition\b|keyword|competitor/i);
    expect(candidates).not.toMatch(/\bctr\b|target this keyword|AI search/i);
  });

  it("keeps Decision Engine output off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const pageView = read("../../components/site/SitePageView.tsx");

    expect(overviewLoader).not.toMatch(/decision_runs|from \"@\/lib\/decisions/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/decisions|decisions\/generate/);
    expect(pageView).toContain("SiteDecisionsSection");
    expect(pageView).toContain("refreshKey={decideRefreshKey}");
    expect(pageView).toContain("onUpdated={refreshDecide}");
    expect(pageView).toContain("SiteWhatMattersSection");
  });

  it("does not change candidate or scoring rules", () => {
    const candidates = read("./candidates.ts");
    const score = read("./score.ts");
    const config = read("./config.ts");

    expect(config).toContain('export const DECISION_ENGINE_VERSION = "decision_v1" as const;');
    expect(config).toContain("export const DECISION_MAX_COUNT = 5;");
    expect(config).toContain("export const DECISION_TYPE_B_MIN_SHARE = 0.1;");
    expect(score).toContain("input.issueImportance * 0.45 + input.searchDemand * 0.4 + input.evidenceConfidence * 0.15");
    expect(score).toContain("page.impressions / maxImpressions");
    expect(score).toContain("DECISION_TYPE_B_MIN_SHARE");
    expect(candidates).toContain("existing_demand_page_issue");
    expect(candidates).toContain("inspect_unanalyzed_page");
    expect(candidates).toContain("multi_page_issue_with_visibility");
    expect(candidates).toContain("DECISION_MAX_COUNT");
  });

  it("never generates a decision run from GET", () => {
    const getRoute = read("../../app/api/websites/[websiteId]/decisions/route.ts");
    const load = read("./load.ts");

    expect(getRoute).not.toMatch(/generateDecisionsForWebsite|insertRunningDecisionRun/);
    expect(load).not.toMatch(/generateDecisionsForWebsite|insertRunningDecisionRun|completeDecisionRun/);
  });
});
