import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Opportunity Discovery v0 source boundary", () => {
  it("stays derived, deterministic, and persistence-free", () => {
    const derive = read("./derive.ts");
    const load = read("./load.ts");
    const display = read("./display.ts");
    const route = read("../../app/api/websites/[websiteId]/opportunities/route.ts");
    const ui = read("../../components/site/SiteOpportunitiesSection.tsx");
    const combined = [derive, load, display, route, ui].join("\n");

    expect(combined).not.toMatch(/openai|OpenAI|anthropic/i);
    expect(combined).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|from\(\"opportunities\"\)|create table/i);
    expect(load).toMatch(/findLatestCompletedSearchSync/);
    expect(load).toMatch(/listEvidenceForSync/);
    expect(load).not.toMatch(/syncSearchAnalytics|insertSearchEvidence|deleteEvidenceForSync/);
    expect(derive).toMatch(/hasMeaningfulVisibility/);
    expect(derive).not.toMatch(/searchDemandScore|combineScoring|issueImportance|DECISION_MAX_COUNT/);
    expect(combined).not.toMatch(/generateDecisionsForWebsite|insertRunningDecisionRun|prepareAction|mutation_spec|supportedAction/);
    expect(combined).not.toMatch(/primary_goal_type|siteDescription|confirmed\.offers|sell_more_products/);
    expect(route).toMatch(/export async function GET/);
    expect(route).not.toMatch(/export async function POST/);
    expect(ui).not.toMatch(/method:\s*[\"']POST[\"']/);
  });

  it("does not enter the Decision Engine or change scoring", () => {
    const generate = read("../decisions/generate.ts");
    const candidates = read("../decisions/candidates.ts");
    const score = read("../decisions/score.ts");
    const config = read("../decisions/config.ts");

    expect(generate).not.toMatch(/from \"@\/lib\/opportunities|deriveQueryOpportunities/);
    expect(candidates).not.toMatch(/from \"@\/lib\/opportunities|deriveQueryOpportunities/);
    expect(score).not.toMatch(/from \"@\/lib\/opportunities|deriveQueryOpportunities/);
    expect(config).toContain('export const DECISION_ENGINE_VERSION = "decision_v1" as const;');
    expect(config).toContain("export const DECISION_MAX_COUNT = 5;");
    expect(config).toContain("export const DECISION_TYPE_B_MIN_SHARE = 0.1;");
    expect(score).toContain(
      "input.issueImportance * 0.45 + input.searchDemand * 0.4 + input.evidenceConfidence * 0.15",
    );
  });

  it("keeps opportunities off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const pageView = read("../../components/site/SitePageView.tsx");

    expect(overviewLoader).not.toMatch(/from \"@\/lib\/opportunities|opportunities/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/opportunities|loadQueryOpportunities/);
    expect(pageView).toContain("SiteOpportunitiesSection");
    expect(pageView).toContain("refreshKey={decideRefreshKey}");
  });
});
