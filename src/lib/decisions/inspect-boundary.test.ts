import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asDecisionV1Run, type DecisionRunRecord } from "./types";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("RESEARCH inspect engine isolation and side-effect boundary", () => {
  it("does not call providers, crawlers, GSC sync, ACT, VERIFY, or LEARN", () => {
    const files = [
      read("./inspect.ts"),
      read("./inspect-db.ts"),
      read("./inspect-match.ts"),
      read("./inspect-display.ts"),
      read("../../app/api/websites/[websiteId]/research/ideas/[ideaId]/inspect/route.ts"),
      read("../../components/site/SiteResearchSection.tsx"),
    ].join("\n");

    expect(files).not.toMatch(/relatedKeywordIdeas|resolveResearchProvider|DataForSEO|openai|OpenAI|anthropic/i);
    expect(files).not.toMatch(/createAndEnqueueCrawl|syncSearchAnalytics|insertSearchEvidence/);
    expect(files).not.toMatch(/generateDecisionsForWebsite|prepareAction|executeAction/);
    expect(files).not.toMatch(/createVerification|recordLearning|from \"@\/lib\/actions/);
    expect(files).not.toMatch(/findWebsiteGoals|insertRunningDecisionRun/);
    expect(read("./generate.ts")).not.toMatch(/from \"\.\/inspect|decision_research_inspect_v0|inspect_related_demand_against_pages/);
    expect(read("./candidates.ts")).not.toMatch(/inspect_related_demand_against_pages/);
  });

  it("keeps decision_v1 loaders and stale-marking on the v1 engine only", () => {
    const db = read("./db.ts");
    expect(db).toMatch(/export async function findLatestCompletedDecisionRun/);
    expect(db).toMatch(/eq\("engine_version", DECISION_ENGINE_VERSION\)/);
    expect(db).toMatch(/export async function markWebsiteDecisionRunsStale/);
    expect(read("./config.ts")).toMatch(/export const DECISION_ENGINE_VERSION = "decision_v1"/);
    expect(read("./inspect-db.ts")).toMatch(/persist_research_inspect_decision/);
    expect(read("./inspect-db.ts")).toMatch(/query\.is\("gsc_search_sync_id", null\)/);
    expect(read("./inspect-db.ts")).toMatch(/INSPECT_RELATED_DEMAND_ENGINE/);
    expect(read("./inspect-db.ts")).not.toMatch(/status:\s*"running"/);
    expect(read("./inspect-db.ts")).not.toMatch(/p_engine_version|p_decision_type|p_website_id|p_goal_id/);
    expect(read("./inspect-db.ts")).toMatch(/p_inspection_state: input\.inspectionState/);
    expect(read("./inspect-db.ts")).not.toMatch(/p_confidence|p_scoring|p_rank|p_priority_band/);
    expect(read("./inspect-db.ts")).not.toMatch(/p_targeted_observation_id/);
    expect(read("./inspect-db.ts")).not.toMatch(/persist_research_inspect_decision_with_observation/);
    expect(read("./inspect-db.ts")).toMatch(/is\("targeted_observation_id", null\)/);
    expect(read("./inspect.ts")).not.toMatch(/insertInspectDecisionRun|completeInspectDecisionRun|failDecisionRun/);
    expect(read("./inspect.ts")).not.toMatch(/rank:\s*1|priorityBand:\s*"next"|inspectScoring/);
    expect(read("./inspect-display.ts")).toMatch(/decision\.inspectionState/);
    expect(read("./inspect-db.ts")).toMatch(/export async function listCompletedInspectRunsForIdeas/);
    expect(read("./inspect-db.ts")).toMatch(/latestByIdea\.has\(ideaId\)/);
    expect(read("./inspect.ts")).toMatch(/views\.set\(run\.researchIdeaId, inspectionViewFromDecision\(decision\)\)/);
    expect(read("./inspect-display.ts")).not.toMatch(/scoring\.resultState|DECISION_BAND_LABELS|matchingConfidenceCopy/);
    expect(read("./inspect-display.ts")).not.toMatch(/issueImportance|searchDemand|supportedActionType/);
    expect(read("../../components/site/SiteResearchSection.tsx")).not.toContain("SiteDecisionsSection");
    expect(read("../../components/site/SiteResearchSection.tsx")).toContain("SiteObserveIdeaPanel");
    expect(read("./inspect.ts")).not.toMatch(/from \"@\/lib\/goals/);
  });

  it("refuses to treat a research inspection run as the latest decision_v1 Top 5 evidence", () => {
    const inspectRun: DecisionRunRecord = {
      id: "inspect-run",
      websiteId: "website-1",
      siteModelId: "model-1",
      crawlRunId: "crawl-1",
      gscSearchSyncId: null,
      engineVersion: "decision_research_inspect_v0",
      status: "completed",
      goalId: null,
      goalSnapshot: {},
      gscTruncated: false,
      errorCode: null,
      createdAt: "2026-10-15T00:00:00.000Z",
      completedAt: "2026-10-15T00:00:00.000Z",
      researchIdeaId: "idea-1",
    };
    expect(() => asDecisionV1Run(inspectRun)).toThrow(/decision_v1/);
    expect(() =>
      asDecisionV1Run({ ...inspectRun, gscSearchSyncId: "gsc-1" }),
    ).toThrow(/decision_v1/);
  });
});
