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
      read("./recover.ts"),
      read("./execute.ts"),
      read("./recovery.ts"),
      read("./request-key.ts"),
      read("./display.ts"),
      read("./filter.ts"),
      read("./gsc-join.ts"),
      read("./query-keys.ts"),
      read("./no-gsc-live-allowlist.ts"),
      read("../../app/api/websites/[websiteId]/research/route.ts"),
      read("../../app/api/websites/[websiteId]/research/[runId]/recover/route.ts"),
      read("../../app/api/websites/[websiteId]/research/[runId]/close/route.ts"),
      read("./close.ts"),
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
    expect(ui).toContain("RESEARCH_RESUME_UNATTEMPTED_LABEL");
    expect(ui).toContain("RESEARCH_CLOSE_LABEL");
    expect(ui).toContain("RESEARCH_NEW_CYCLE_LABEL");
    expect(ui).toContain("researchEmptyCopy");
    expect(ui).toContain("run.displayInterrupted");
    expect(ui).toContain("recoveryOwnsCta");
    expect(ui).toContain("INSPECT_CTA_LABEL");
    expect(ui).toContain("idea.canInspect");
    expect(ui).toContain("executionAvailable");
    expect(ui).toContain("persistedRuns");
    expect(ui).toContain("RESEARCH_NO_SAVED_EVIDENCE_COPY");
    expect(ui).not.toContain("RESEARCH_DISABLED_COPY");
    expect(ui).toContain("/research/ideas/");
    expect(ui).not.toMatch(/Retry all/);
    expect(ui).not.toMatch(/Close and retry|Start again/);
    expect(display).toContain("Estimated monthly searches");
    expect(display).not.toMatch(/people searching every month|easy win|you should create a page/);
  });

  it("keeps GET from invoking the provider", () => {
    const load = read("./load.ts");
    const route = read("../../app/api/websites/[websiteId]/research/route.ts");
    expect(load).not.toMatch(/relatedKeywordIdeas|resolveResearchProvider|updateResearchRun|claimResearchRecovery/);
    expect(load).toContain("listReadableCompletedResearchRuns");
    expect(load).toContain("findLatestCompatibleResearchRun");
    expect(load).not.toContain("listCompatibleResearchRuns");
    expect(load).not.toContain("isReusableCompletedRun");
    const inspect = read("../decisions/inspect.ts");
    expect(inspect).toContain("findLatestReadableCompletedRunForFingerprint");
    expect(inspect).not.toContain("listCompatibleResearchRuns");
    expect(inspect).not.toMatch(/relatedKeywordIdeas|resolveResearchProvider/);
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/loadResearchForOwner/);
    expect(route).not.toMatch(/recoverResearchForOwner|executeResearchLedger|closeResearchForOwner/);
    expect(read("./close.ts")).not.toMatch(/relatedKeywordIdeas|resolveResearchProvider|claimResearchRecovery|executeResearchLedger|claimResearchRun/);
  });
});
