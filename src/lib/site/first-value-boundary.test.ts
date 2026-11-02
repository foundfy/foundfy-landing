import { readFileSync } from "node:fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("First Value UX v0 boundary", () => {
  const firstValue = read("./first-value.ts");
  const page = read("../../components/site/SitePageView.tsx");
  const whatMatters = read("../../components/site/SiteWhatMattersSection.tsx");
  const foundationsUi = read("../../components/site/SiteFoundationsSection.tsx");
  const observe = read("../../components/site/SiteObserveSection.tsx");
  const blob = [firstValue, whatMatters, foundationsUi, observe, page].join("\n");

  it("does not add a decision engine, task store, indexing API, or crawler", () => {
    expect(blob).not.toMatch(/generateDecisionsForWebsite|DECISION_ENGINE_VERSION|prepareAction|executeAction/);
    expect(blob).not.toMatch(/urlInspection|inspecturl|webmasters\.sitemaps|sitemaps\.submit/i);
    expect(blob).not.toMatch(/createAndEnqueueCrawl|from \"@\/lib\/crawler\/start-crawl/);
    expect(blob).not.toMatch(/dataforseo|DataForSEO/);
    expect(firstValue).not.toMatch(/from \"@\/lib\/(decisions|research|actions|gsc)/);
  });

  it("does not claim scheduled, monitoring, or automatic indexing work", () => {
    expect(firstValue).not.toMatch(/Foundfy will (monitor|schedule|automatically)/i);
    expect(firstValue).not.toMatch(/recurring sync|scheduled (check|scan|sync)/i);
    expect(firstValue).toContain("does not inspect Google's index in this version");
    expect(firstValue).toContain("does not run it on a schedule");
  });

  it("keeps Google performance on the owner observe API", () => {
    const hook = read("../../hooks/useGooglePerformanceEvidence.ts");
    expect(hook).toContain("/api/websites/${requestedWebsiteId}/observe/search-analytics");
    expect(hook).toContain("cache: \"no-store\"");
    expect(hook).not.toMatch(/query_text|impressions|payload\.queries|payload\.pages/);
    expect(hook).toContain("shouldRetryGooglePerformanceAttempt");
    expect(page).toContain("useGooglePerformanceEvidence");
    expect(page).toContain("selectGoogleEvidenceForWebsite(google, websiteId)");
    expect(page).toContain("onReloadPerformance={reloadGooglePerformance}");
    expect(page).toContain("performanceLoadError={google.loadError}");
    expect(observe).toContain("performanceLoadError === OBSERVE_EXPIRED_COPY");
    expect(hook).toContain("visibleGoogleEvidenceForWebsite");
    expect(hook).toContain("shouldCommitGooglePerformanceResponse");
    expect(observe).not.toMatch(/\/observe\/search-analytics`/);
    expect(observe).toContain("observe/search-analytics/sync");
    expect(observe).toContain("onReloadPerformance?.()");
  });
});
