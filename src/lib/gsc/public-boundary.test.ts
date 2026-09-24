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

    expect(overviewLoader).not.toMatch(/google_identit|observeOwner|refresh_token|gsc_property|gsc_search|impressions|query_text|decision_runs/i);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/gsc|from \"@\/lib\/decisions|observeOwner|propertyUri|search-analytics/i);
    expect(overviewTypes).not.toMatch(/googleIdentity|refreshToken|observeOwner|searchAnalytics|DecisionView/i);
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
  });

  it("does not let public first-scan crawl use private GSC evidence", () => {
    const publicCrawl = read("../../app/api/crawl/route.ts");
    const startCrawl = read("../crawler/start-crawl.ts");

    expect(publicCrawl).not.toMatch(/from \"@\/lib\/gsc|gscVisibility|resolveOwnerGsc/);
    expect(startCrawl).not.toMatch(/impressions|clicks|query_text/);
  });
});
