import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    from() {
      throw new Error("inspect persist must not write tables directly");
    },
  }),
}));

import { persistResearchInspectDecision } from "./inspect-db";
import type { PersistResearchInspectDecisionInput } from "./inspect-db";

const persistInput: PersistResearchInspectDecisionInput = {
  researchIdeaId: "idea-1",
  siteModelId: "model-1",
  crawlRunId: "crawl-1",
  gscSearchSyncId: null,
  title: "Check whether current pages cover “como pintar en seda”",
  explanation: "Foundfy did not find an obvious match in the current crawl sample.",
  pageUrl: null,
  pageId: null,
  inspectionState: "no_obvious_match_in_current_crawl",
  gscTruncated: false,
  evidenceRefs: [
    { kind: "research_idea", recordId: "idea-1", snapshot: {} },
    { kind: "research_run", recordId: "run-1", snapshot: {} },
    { kind: "site_model", recordId: "model-1", snapshot: {} },
    { kind: "crawl_run", recordId: "crawl-1", snapshot: { bounded: true } },
  ],
};

describe("persistResearchInspectDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the atomic RPC without website, engine, type, or goal overrides", async () => {
    rpcMock.mockResolvedValue({
      data: { reused: false, run_id: "inspect-run-1", decision_id: "decision-1" },
      error: null,
    });
    const result = await persistResearchInspectDecision(persistInput);
    expect(result).toEqual({
      reused: false,
      runId: "inspect-run-1",
      decisionId: "decision-1",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "persist_research_inspect_decision",
      expect.objectContaining({
        p_research_idea_id: "idea-1",
        p_site_model_id: "model-1",
        p_crawl_run_id: "crawl-1",
        p_gsc_search_sync_id: null,
      }),
    );
    const payload = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("p_website_id");
    expect(payload).not.toHaveProperty("p_engine_version");
    expect(payload).not.toHaveProperty("p_decision_type");
    expect(payload).not.toHaveProperty("p_status");
    expect(payload).not.toHaveProperty("p_goal_id");
    expect(payload).not.toHaveProperty("p_rank");
    expect(payload).not.toHaveProperty("p_priority_band");
    expect(payload).not.toHaveProperty("p_confidence");
    expect(payload).not.toHaveProperty("p_scoring");
    expect(payload.p_inspection_state).toBe("no_obvious_match_in_current_crawl");
  });

  it("returns the same winner to concurrent no-GSC and with-GSC callers", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: { reused: false, run_id: "inspect-run-no-gsc", decision_id: "d-no-gsc" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { reused: true, run_id: "inspect-run-no-gsc", decision_id: "d-no-gsc" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { reused: false, run_id: "inspect-run-gsc", decision_id: "d-gsc" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { reused: true, run_id: "inspect-run-gsc", decision_id: "d-gsc" },
        error: null,
      });

    const [first, second] = await Promise.all([
      persistResearchInspectDecision(persistInput),
      persistResearchInspectDecision(persistInput),
    ]);
    expect(first.runId).toBe("inspect-run-no-gsc");
    expect(second.runId).toBe(first.runId);
    expect(first.decisionId).toBe(second.decisionId);

    const withGsc = { ...persistInput, gscSearchSyncId: "gsc-1" };
    const [gscFirst, gscSecond] = await Promise.all([
      persistResearchInspectDecision(withGsc),
      persistResearchInspectDecision(withGsc),
    ]);
    expect(gscFirst.runId).toBe("inspect-run-gsc");
    expect(gscSecond.runId).toBe(gscFirst.runId);
    expect(gscFirst.decisionId).toBe(gscSecond.decisionId);
  });

  it("surfaces RPC failure without a local table write", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "forced persist failure" } });
    await expect(persistResearchInspectDecision(persistInput)).rejects.toThrow(
      /forced persist failure/,
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
