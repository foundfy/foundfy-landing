import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Technical SEO Foundation v0 boundary", () => {
  const evaluate = read("./evaluate.ts");
  const display = read("./display.ts");
  const types = read("./types.ts");
  const ui = read("../../components/site/SiteFoundationsSection.tsx");
  const page = read("../../components/site/SitePageView.tsx");
  const overviewLoader = read("../websites/load-overview.ts");
  const overviewTypes = read("../websites/types.ts");
  const completed = read("../findings/load-completed-results.ts");
  const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
  const blob = [evaluate, display, types, ui, completed].join("\n");

  it("does not call Google APIs, submit sitemaps, inspect URLs, or start a new crawler", () => {
    expect(blob).not.toMatch(/urlInspection|inspecturl|webmasters\.sitemaps|sitemaps\.submit/i);
    expect(blob).not.toMatch(/request indexing|submitSitemap|sitemap submit/i);
    expect(blob).not.toMatch(/from \"@\/lib\/crawler\/start-crawl|createAndEnqueueCrawl/);
    expect(blob).not.toMatch(/googleapis|searchconsole\.googleapis|webmasters\/v3/i);
    expect(blob).not.toMatch(/dataforseo|DataForSEO|relatedKeywordIdeas/i);
    expect(evaluate).not.toMatch(/from \"@\/lib\/gsc/);
    expect(display).not.toMatch(/from \"@\/lib\/gsc/);
    expect(ui).not.toMatch(/observe\/search-analytics\/sync/);
  });

  it("does not change Decision v1, C0 OAuth, Research, or ACT", () => {
    expect(blob).not.toMatch(/from \"@\/lib\/(decisions|research|actions|gsc\/setup|gsc\/oauth-url)/);
    expect(blob).not.toMatch(/generateDecisionsForWebsite|DECISION_ENGINE_VERSION|prepareAction|executeAction/);
    expect(blob).not.toMatch(/RESEARCH_NO_GSC_LIVE_ALLOWLIST|RESEARCH_LIVE_ENABLED|claim_targeted_observation/);
    expect(blob).not.toMatch(/GOOGLE_OAUTH_SETUP_SCOPES|siteverification|include_granted_scopes/);
    expect(read("../decisions/generate.ts")).not.toMatch(/from \"@\/lib\/foundations/);
    expect(read("../research/start.ts")).not.toMatch(/from \"@\/lib\/foundations/);
    expect(read("../actions/lifecycle.ts")).not.toMatch(/from \"@\/lib\/foundations/);
    expect(read("../gsc/setup.ts")).not.toMatch(/from \"@\/lib\/foundations/);
  });

  it("does not add a database schema or migration", () => {
    const migrations = readdirSync(path.join(__dirname, "../../../supabase/migrations"));
    expect(migrations.filter((name) => /seo.foundation|technical.seo.foundation|foundations_v0/i.test(name))).toEqual([]);
    expect(blob).not.toMatch(/alter table|create table|supabase\/migrations/i);
  });

  it("keeps Google performance behind the existing owner observe API", () => {
    expect(overviewLoader).not.toMatch(/search-analytics|loadSearchAnalyticsEvidence|from \"@\/lib\/gsc/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/gsc|search-analytics/);
    expect(overviewTypes).not.toMatch(/SearchAnalyticsView|query_text|impressions/);
    expect(ui).toContain("/api/websites/${websiteId}/observe/search-analytics");
    expect(ui).toContain("cache: \"no-store\"");
    expect(ui).not.toMatch(/query_text|impressions|clicks/);
    expect(ui).not.toMatch(/payload\.queries|payload\.pages/);
  });

  it("places foundations above What matters now and keeps indexing not checked", () => {
    expect(page).toContain("SiteFoundationsSection");
    expect(page).toContain("SiteWhatMattersSection");
    expect(page.indexOf("SiteFoundationsSection")).toBeLessThan(page.indexOf("SiteWhatMattersSection"));
    expect(evaluate).toContain("Foundfy has not checked whether Google has indexed these pages.");
    expect(evaluate).toMatch(/status: \"not_checked\"/);
  });
});
