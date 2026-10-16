import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { supportedActionTypeForDecision } from "./supported-action";
import {
  RESEARCH_INSPECT_DECISION_TYPE,
  RESEARCH_INSPECT_STATES,
  asDecisionV1Record,
  asResearchInspectDecisionRecord,
  type DecisionRecord,
  type ResearchInspectDecisionRecord,
} from "./types";

const migration024 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/024_research_decide_investigation.sql"),
  "utf8",
);
const migration012 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/012_decision_engine_v1.sql"),
  "utf8",
);

const V1_TYPES = [
  "existing_demand_page_issue",
  "inspect_unanalyzed_page",
  "multi_page_issue_with_visibility",
] as const;

type SemanticsRow = {
  decision_type: string;
  rank: number | null;
  priority_band: string | null;
  confidence: string | null;
  scoring: Record<string, unknown> | null;
  inspection_state: string | null;
};

function decisionsRowSemanticsCheck(row: SemanticsRow): boolean {
  const v1 =
    (V1_TYPES as readonly string[]).includes(row.decision_type) &&
    row.rank !== null &&
    row.priority_band !== null &&
    row.confidence !== null &&
    row.scoring !== null &&
    row.inspection_state === null;
  const inspect =
    row.decision_type === RESEARCH_INSPECT_DECISION_TYPE &&
    row.rank === null &&
    row.priority_band === null &&
    row.confidence === null &&
    row.scoring === null &&
    row.inspection_state !== null &&
    (RESEARCH_INSPECT_STATES as readonly string[]).includes(row.inspection_state);
  return v1 || inspect;
}

function v1Row(overrides: Partial<SemanticsRow> = {}): SemanticsRow {
  return {
    decision_type: "existing_demand_page_issue",
    rank: 1,
    priority_band: "do_first",
    confidence: "exact_match",
    scoring: { issueImportance: 80, searchDemand: 100, evidenceConfidence: 90, total: 88 },
    inspection_state: null,
    ...overrides,
  };
}

function inspectRow(overrides: Partial<SemanticsRow> = {}): SemanticsRow {
  return {
    decision_type: RESEARCH_INSPECT_DECISION_TYPE,
    rank: null,
    priority_band: null,
    confidence: null,
    scoring: null,
    inspection_state: "no_obvious_match_in_current_crawl",
    ...overrides,
  };
}

function inspectRecord(
  overrides: Partial<ResearchInspectDecisionRecord> = {},
): ResearchInspectDecisionRecord {
  return {
    id: "decision-inspect-1",
    decisionRunId: "inspect-run-1",
    websiteId: "website-1",
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
    evidenceRefs: [],
    ...overrides,
  };
}

describe("migration 024 Decision-row semantics contract", () => {
  it("keeps 012 ranked value CHECKs and only drops NOT NULL where inspect requires it", () => {
    expect(migration012).toMatch(/check \(rank >= 1 and rank <= 5\)/);
    expect(migration012).toMatch(/check \(priority_band in \('do_first', 'next', 'later'\)\)/);
    expect(migration012).toMatch(
      /check \(confidence in \('exact_match', 'bounded_dataset', 'unmapped_page'\)\)/,
    );
    expect(migration024).toMatch(/alter column rank drop not null/);
    expect(migration024).toMatch(/alter column priority_band drop not null/);
    expect(migration024).toMatch(/alter column confidence drop not null/);
    expect(migration024).toMatch(/alter column scoring drop not null/);
    expect(migration024).toMatch(/alter column scoring drop default/);
    expect(migration024).not.toMatch(/drop constraint if exists decisions_priority_band/);
    expect(migration024).not.toMatch(/drop constraint if exists decisions_rank/);
    expect(migration024).not.toMatch(/drop constraint if exists decisions_confidence/);
  });

  it("adds inspection_state and a type-conditional IS NULL / IS NOT NULL / IN check", () => {
    expect(migration024).toMatch(/add column if not exists inspection_state text/);
    expect(migration024).toMatch(/decisions_row_semantics_check/);
    expect(migration024).toMatch(/rank is not null/);
    expect(migration024).toMatch(/priority_band is not null/);
    expect(migration024).toMatch(/confidence is not null/);
    expect(migration024).toMatch(/scoring is not null/);
    expect(migration024).toMatch(/inspection_state is null/);
    expect(migration024).toMatch(/rank is null/);
    expect(migration024).toMatch(/priority_band is null/);
    expect(migration024).toMatch(/confidence is null/);
    expect(migration024).toMatch(/scoring is null/);
    expect(migration024).toMatch(/inspection_state is not null/);
    expect(migration024).toMatch(/clear_existing_page_evidence/);
    expect(migration024).toMatch(/no_obvious_match_in_current_crawl/);
    expect(migration024).toMatch(/'ambiguous'/);
  });

  it("accepts valid v1 and inspect rows and rejects the documented invalid combinations", () => {
    expect(decisionsRowSemanticsCheck(v1Row())).toBe(true);
    expect(decisionsRowSemanticsCheck(v1Row({ rank: null }))).toBe(false);
    expect(decisionsRowSemanticsCheck(v1Row({ priority_band: null }))).toBe(false);
    expect(decisionsRowSemanticsCheck(v1Row({ confidence: null }))).toBe(false);
    expect(decisionsRowSemanticsCheck(v1Row({ scoring: null }))).toBe(false);
    expect(decisionsRowSemanticsCheck(v1Row({ inspection_state: "ambiguous" }))).toBe(false);

    expect(decisionsRowSemanticsCheck(inspectRow())).toBe(true);
    expect(decisionsRowSemanticsCheck(inspectRow({ inspection_state: "clear_existing_page_evidence" }))).toBe(
      true,
    );
    expect(decisionsRowSemanticsCheck(inspectRow({ inspection_state: "ambiguous" }))).toBe(true);
    expect(decisionsRowSemanticsCheck(inspectRow({ rank: 1 }))).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ priority_band: "next" }))).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ confidence: "exact_match" }))).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ confidence: "bounded_dataset" }))).toBe(false);
    expect(
      decisionsRowSemanticsCheck(
        inspectRow({ scoring: { issueImportance: 0, searchDemand: 0, evidenceConfidence: 0, total: 0 } }),
      ),
    ).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ scoring: {} }))).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ inspection_state: null }))).toBe(false);
    expect(decisionsRowSemanticsCheck(inspectRow({ inspection_state: "unknown" }))).toBe(false);
  });
});

describe("inspect RPC persistence contract", () => {
  const rpc = migration024.slice(migration024.indexOf("create or replace function public.persist_research_inspect_decision"));

  it("persists NULL v1 fields and a dedicated inspection_state", () => {
    expect(rpc).toMatch(/p_inspection_state text/);
    expect(rpc).toMatch(/p_inspection_state is null/);
    expect(rpc).toMatch(/insert into public\.decisions \(/);
    expect(rpc).toMatch(/inspection_state/);
    expect(rpc).toMatch(/null,\s*\n\s*null,\s*\n\s*null,\s*\n\s*null,\s*\n\s*p_inspection_state/);
    expect(rpc).not.toMatch(/p_confidence/);
    expect(rpc).not.toMatch(/p_scoring/);
    expect(rpc).not.toMatch(/p_rank/);
    expect(rpc).not.toMatch(/p_priority_band/);
    expect(rpc).not.toMatch(/priority_band = 'next'/);
    expect(rpc).not.toMatch(/rank = 1/);
    expect(rpc).not.toMatch(/'exact_match'/);
    expect(rpc).not.toMatch(/'bounded_dataset'/);
    expect(rpc).not.toMatch(/issueImportance/);
    expect(rpc).not.toMatch(/searchDemand/);
    expect(rpc).not.toMatch(/'{}'::jsonb,\s*\n\s*p_/);
  });

  it("accepts only ownership-checked inspect evidence kinds", () => {
    expect(rpc).toMatch(/v_kind not in \(\s*'page',\s*'crawl_run',\s*'gsc_sync',\s*'site_model',\s*'research_run',\s*'research_idea'\s*\)/);
    expect(rpc).toMatch(/inspect research idea evidence does not match/);
    expect(rpc).toMatch(/inspect research run evidence does not match/);
    expect(rpc).toMatch(/inspect site model evidence does not match/);
    expect(rpc).toMatch(/inspect crawl evidence does not match/);
    expect(rpc).toMatch(/inspect GSC evidence does not match/);
    expect(rpc).toMatch(/inspect page evidence does not belong to the idea website crawl/);
    expect(rpc).not.toMatch(/'observation'/);
    expect(rpc).not.toMatch(/'gsc_evidence'/);
    expect(rpc).not.toMatch(/'goal'/);
    expect(rpc).toMatch(/pg_advisory_xact_lock/);
    expect(rpc).not.toMatch(/pg_advisory_lock\(/);
  });
});

describe("inspect TypeScript Decision model", () => {
  it("keeps inspect rows out of decision_v1 loaders and ACT", () => {
    const inspect = inspectRecord();
    expect(inspect.rank).toBeNull();
    expect(inspect.priorityBand).toBeNull();
    expect(inspect.confidence).toBeNull();
    expect(inspect.scoring).toBeNull();
    expect(inspect.inspectionState).toBe("no_obvious_match_in_current_crawl");
    expect(() => asDecisionV1Record(inspect)).toThrow(/decision_v1/);
    expect(asResearchInspectDecisionRecord(inspect).inspectionState).toBe(
      "no_obvious_match_in_current_crawl",
    );
    expect(
      supportedActionTypeForDecision({
        decisionType: inspect.decisionType,
        pageId: "page-1",
        evidenceRefs: [{ kind: "page", recordId: "page-1", snapshot: {} }],
      }),
    ).toBeNull();
  });

  it("does not weaken a ranked decision_v1 record", () => {
    const v1 = {
      id: "decision-1",
      decisionRunId: "run-1",
      websiteId: "website-1",
      createdAt: "2026-10-16T00:00:00.000Z",
      decisionType: "existing_demand_page_issue",
      title: "Improve the page title",
      explanation: "ranked",
      pageUrl: "https://example.com",
      pageId: "page-1",
      priorityBand: "do_first",
      rank: 1,
      scoring: { issueImportance: 80, searchDemand: 100, evidenceConfidence: 90, total: 88 },
      confidence: "exact_match",
      evidenceRefs: [],
    } satisfies DecisionRecord;
    const narrowed = asDecisionV1Record(v1);
    expect(narrowed.rank).toBe(1);
    expect(narrowed.priorityBand).toBe("do_first");
    expect(narrowed.confidence).toBe("exact_match");
    expect(narrowed.scoring.total).toBe(88);
    expect(() => asResearchInspectDecisionRecord(v1)).toThrow(/research inspection/);
  });
});
