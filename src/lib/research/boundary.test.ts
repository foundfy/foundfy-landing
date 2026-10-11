import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("RESEARCH v0 source boundary", () => {
  it("stays outside DECIDE, ACT, crawler, Opportunity Grain, GSC sync, and AI", () => {
    const files = [
      read("./start.ts"),
      read("./load.ts"),
      read("./display.ts"),
      read("./filter.ts"),
      read("./gsc-join.ts"),
      read("../../app/api/websites/[websiteId]/research/route.ts"),
      read("../../components/site/SiteResearchSection.tsx"),
    ].join("\n");

    expect(files).not.toMatch(/generateDecisionsForWebsite|createAndEnqueueCrawl|prepareAction|openai|OpenAI|anthropic/i);
    expect(files).not.toMatch(/syncSearchAnalytics|insertSearchEvidence|deriveQueryOpportunities/);
    expect(files).not.toMatch(/from \"@\/lib\/ai-enrichment|embeddings|stemming/);
    expect(read("../decisions/generate.ts")).not.toMatch(/from \"@\/lib\/research/);
    expect(read("../opportunities/derive.ts")).not.toMatch(/from \"@\/lib\/research/);
    expect(read("../actions/lifecycle.ts")).not.toMatch(/from \"@\/lib\/research/);
  });

  it("does not present sandbox or fixture data as live market evidence", () => {
    const display = read("./display.ts");
    const ui = read("../../components/site/SiteResearchSection.tsx");
    expect(display).toContain("Test data — this is not real market demand.");
    expect(ui).toContain("run.isTestData");
    expect(ui).toContain("readiness?.surfaceVisible");
    expect(display).toContain("Estimated monthly searches");
    expect(display).not.toMatch(/people searching every month|easy win|you should create a page/);
  });

  it("keeps GET from invoking the provider", () => {
    const load = read("./load.ts");
    const route = read("../../app/api/websites/[websiteId]/research/route.ts");
    expect(load).not.toMatch(/relatedKeywordIdeas|resolveResearchProvider/);
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/loadResearchForOwner/);
  });
});
