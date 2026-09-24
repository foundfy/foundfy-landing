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
    expect(pageView).toContain("SiteWhatMattersSection");
  });
});
