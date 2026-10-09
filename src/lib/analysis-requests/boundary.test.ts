import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Type B analysis request boundary", () => {
  it("does not use ACT tables, VERIFY, LEARN, or DECIDE scoring", () => {
    const request = read("./request.ts");
    const settle = read("./settle.ts");
    const db = read("./db.ts");
    const display = read("./display.ts");
    const source = [request, settle, db, display].join("\n");

    expect(source).not.toMatch(/from \"@\/lib\/actions|mutation_spec|prepareAction|approveAction|executeAction|verifyAction|learningViewFor/);
    expect(source).not.toMatch(/generateDecisionsForWebsite|searchDemandScore|issueImportance|openai|OpenAI/);
    expect(display).toContain("Analyze this page");
    expect(display).toContain("Refresh priorities");
    expect(request).toContain("requiredUrl");
    expect(request).toContain("inspect_unanalyzed_page");
    expect(settle).toContain("fetch_failed");
    expect(db).toContain("analysis_requests");
    expect(db).not.toMatch(/from\(\"actions\"\)/);
  });

  it("keeps analysis requests off the public website overview and recent actions", () => {
    const overview = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const history = read("../../components/site/SiteActionsSection.tsx");
    const scan = read("../../app/api/websites/[websiteId]/scan/route.ts");

    expect(overview).not.toMatch(/analysis_requests|requestPageAnalysis/);
    expect(publicRoute).not.toMatch(/analysis-requests|requestPageAnalysis/);
    expect(history).not.toMatch(/analysis-requests|ANALYZE_PAGE_LABEL/);
    expect(scan).not.toMatch(/requiredUrl/);
  });
});
