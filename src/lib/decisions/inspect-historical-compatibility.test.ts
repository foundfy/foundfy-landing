import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESEARCH_INSPECT_DECISION_TYPE,
  RESEARCH_INSPECT_T0_STATES,
  asResearchInspectDecisionRecord,
  type DecisionRecord,
} from "./types";

const migration025 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/025_targeted_observe_foundation.sql"),
  "utf8",
);

const PRODUCTION_T0_CRAWL_RUN_ID = "882fbaee-cae3-4134-85e2-1b6ec6ea78c9";
const PRODUCTION_T0_DECISION_ID = "3a94b4d8-3d1f-4530-8324-67db3beef1c7";

const productionT0Decision: DecisionRecord = {
  id: PRODUCTION_T0_DECISION_ID,
  decisionRunId: "inspect-run-production-t0",
  websiteId: "website-dbhobby",
  createdAt: "2026-10-16T00:00:00.000Z",
  decisionType: RESEARCH_INSPECT_DECISION_TYPE,
  title: "Check whether current pages cover “como pintar en seda”",
  explanation: "Foundfy did not find an obvious match in the current crawl sample.",
  pageUrl: null,
  pageId: null,
  priorityBand: null,
  rank: null,
  scoring: null,
  confidence: null,
  inspectionState: "no_obvious_match_in_current_crawl",
  evidenceRefs: [
    {
      kind: "crawl_run",
      recordId: PRODUCTION_T0_CRAWL_RUN_ID,
      snapshot: { bounded: true },
    },
  ],
};

describe("historical compatibility after migration 025", () => {
  it("keeps existing decision_v1 rows valid with targeted_observation_id NULL", () => {
    expect(migration025).toMatch(
      /engine_version = 'decision_v1'[\s\S]*targeted_observation_id is null/,
    );
  });

  it("keeps the production-shaped T0 inspection semantically valid", () => {
    const inspect = asResearchInspectDecisionRecord(productionT0Decision);
    expect(inspect.id).toBe(PRODUCTION_T0_DECISION_ID);
    expect(inspect.evidenceRefs[0]?.recordId).toBe(PRODUCTION_T0_CRAWL_RUN_ID);
    expect(inspect.inspectionState).toBe("no_obvious_match_in_current_crawl");
    expect(RESEARCH_INSPECT_T0_STATES).toContain("no_obvious_match_in_current_crawl");
    expect(migration025).toMatch(/no_obvious_match_in_current_crawl/);
  });

  it("keeps T0 persist create-or-reuse on targeted_observation_id IS NULL", () => {
    const t0 = migration025.slice(
      migration025.indexOf("create or replace function public.persist_research_inspect_decision("),
      migration025.indexOf(
        "create or replace function public.persist_research_inspect_decision_with_observation(",
      ),
    );
    expect(t0).toMatch(/dr\.targeted_observation_id is null/);
    expect(t0).toMatch(/when unique_violation then/);
    expect(t0).toMatch(/p_research_idea_id,\s*\n\s*null,\s*\n\s*timezone\('utc', now\(\)\)/);
    expect(t0).toMatch(/'reused', true/);
    expect(t0).toMatch(/'reused', false/);
  });
});
