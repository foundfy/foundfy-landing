import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("public vs owner-private OBSERVE boundary", () => {
  it("keeps private Google OAuth state off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const overviewTypes = read("../websites/types.ts");

    expect(overviewLoader).not.toMatch(/google_identit|observeOwner|refresh_token|gsc_property|gsc_search|impressions|query_text|decision_runs|action_reviews|review_canonical|analysis_requests|opportunities|loadQueryOpportunities/i);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/gsc|from \"@\/lib\/decisions|from \"@\/lib\/opportunities|observeOwner|propertyUri|search-analytics/i);
    expect(overviewTypes).not.toMatch(/googleIdentity|refreshToken|observeOwner|searchAnalytics|DecisionView|QueryOpportunity/i);
  });

  it("keeps Search Analytics evidence in the owner-only observe UI", () => {
    const ui = read("../../components/site/SiteObserveSection.tsx");
    expect(ui).toContain("onUpdated?.()");
    expect(ui).toContain("OBSERVE_CONNECT_LABEL");
    expect(ui).toContain("OBSERVE_CONNECTED_TITLE");
    expect(ui).toContain("OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE");
    expect(ui).toContain("OBSERVE_SYNC_LABEL");
    expect(ui).toContain("Connect Google to begin observing how people discover this site.");
    expect(ui).not.toMatch(/high priority|opportunity|optimize this|CTR is too low|you should target/i);
  });

  it("keeps Decision Engine output in the owner-only section", () => {
    const decisionsUi = read("../../components/site/SiteDecisionsSection.tsx");
    expect(decisionsUi).toContain("refreshKey");
    expect(decisionsUi).toContain("/api/websites/${websiteId}/decisions");
    expect(decisionsUi).toContain("DECISION_SECTION_HEADING");
    expect(decisionsUi).toContain("DECISION_BLOCKED_COPY");
    expect(decisionsUi).toContain("DECISION_EMPTY_GSC_COPY");
    expect(decisionsUi).toContain("DECISION_NO_OVERLAP_COPY");
    expect(decisionsUi).not.toContain("DECISION_EMPTY_COPY");
    expect(decisionsUi).not.toMatch(/enough cross-signal evidence to prioritize an action yet/);
    expect(decisionsUi).not.toMatch(/CTR is too low|you should target|increase traffic by/i);
    expect(decisionsUi).toContain("/api/websites/${websiteId}/reviews");
    expect(decisionsUi).toContain("SiteCanonicalReviewPanel");
    expect(decisionsUi).toContain("/api/websites/${websiteId}/analysis-requests");
    expect(decisionsUi).toContain("SiteAnalyzePagePanel");
    expect(decisionsUi).not.toMatch(/Prepare this change|Approve|Apply this change|mutation_spec/);
  });

  it("keeps query opportunities in the owner-only site UI", () => {
    const ui = read("../../components/site/SiteOpportunitiesSection.tsx");
    expect(ui).toContain("OPPORTUNITY_SECTION_HEADING");
    expect(ui).toContain("/api/websites/${websiteId}/opportunities");
    expect(ui).toContain("OPPORTUNITY_REVIEW_LABEL");
    expect(ui).toContain("<details");
    expect(ui).not.toMatch(/Prepare this change|Approve|Apply this change|mutation_spec|Analyze this page/i);
    expect(ui).not.toMatch(/CTR is too low|easy win|create a page|trending|cannibaliz|high-converting/i);
  });

  it("keeps canonical review UI review-only", () => {
    const ui = read("../../components/site/SiteCanonicalReviewPanel.tsx");
    expect(ui).toContain("CANONICAL_REVIEW_LABEL");
    expect(ui).toContain("CANONICAL_REVIEW_PAGE_HEADING");
    expect(ui).toContain("CANONICAL_REVIEW_CANONICAL_HEADING");
    expect(ui).toContain("CANONICAL_REVIEW_OUTCOME_LABELS");
    expect(ui).not.toMatch(/Prepare this change|Apply this change|mutation_spec|mutationSpec/);
    expect(ui).not.toMatch(/ACTION_PREPARE_LABEL|ACTION_APPROVE_LABEL|ACTION_EXECUTE_LABEL/);
  });

  it("keeps Type B analyze UI as an OBSERVE request", () => {
    const ui = read("../../components/site/SiteAnalyzePagePanel.tsx");
    expect(ui).toContain("ANALYZE_PAGE_LABEL");
    expect(ui).toContain("ANALYZE_PAGE_ANALYZED_COPY");
    expect(ui).not.toMatch(/Prepare this change|Approve|Apply this change|mutation_spec|VERIFY|LEARN|Safety/);
    expect(ui).not.toMatch(/ACTION_PREPARE_LABEL|ACTION_APPROVE_LABEL|ACTION_EXECUTE_LABEL/);
  });

  it("does not let public first-scan crawl use private GSC evidence", () => {
    const publicCrawl = read("../../app/api/crawl/route.ts");
    const startCrawl = read("../crawler/start-crawl.ts");
    const hostVariant = read("../crawler/select/host-variant-equivalence.ts");

    expect(publicCrawl).not.toMatch(/from \"@\/lib\/gsc|gscVisibility|resolveOwnerGsc/);
    expect(startCrawl).not.toMatch(/impressions|clicks|query_text/);
    expect(hostVariant).not.toMatch(/impressions|clicks|query_text|from \"@\/lib\/gsc/);
  });
});
