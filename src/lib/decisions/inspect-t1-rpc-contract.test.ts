import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration025 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/025_targeted_observe_foundation.sql"),
  "utf8",
);

const t0 = migration025.slice(
  migration025.indexOf("create or replace function public.persist_research_inspect_decision("),
  migration025.indexOf(
    "create or replace function public.persist_research_inspect_decision_with_observation(",
  ),
);
const t1 = migration025.slice(
  migration025.indexOf(
    "create or replace function public.persist_research_inspect_decision_with_observation(",
  ),
);

describe("T1 RPC foundation contract (SQL; no live database)", () => {
  it("documents that this harness cannot execute RPCs against an isolated Postgres", () => {
    expect(t1).toMatch(/persist_research_inspect_decision_with_observation/);
    expect(t1).not.toMatch(/perform http/i);
  });

  it("persists a completed T1 inspect when provenance is valid", () => {
    expect(t1).toMatch(/cr\.purpose = 'site_sample'/);
    expect(t1).toMatch(/v_obs_status <> 'analyzed'/);
    expect(t1).toMatch(/v_targeted_crawl_purpose <> 'targeted_observe'/);
    expect(t1).toMatch(/insert into public\.decision_runs \(/);
    expect(t1).toMatch(/p_targeted_observation_id,/);
    expect(t1).toMatch(/'completed'/);
    expect(t1).toMatch(
      /inspect evidence must include idea, run, site model, crawl, and targeted observation/,
    );
  });

  it("reuses the same completed T1 identity", () => {
    expect(t1).toMatch(/dr\.targeted_observation_id = p_targeted_observation_id/);
    expect(t1).toMatch(/when unique_violation then/);
    expect(t1).toMatch(/'reused', true/);
    expect(t1).toMatch(/'reused', false/);
  });

  it("keeps T1 identity distinct from T0 by observation id", () => {
    expect(t1).toMatch(
      /p_research_idea_id::text \|\| ':' \|\|\s+p_crawl_run_id::text \|\| ':' \|\|\s+coalesce\(p_gsc_search_sync_id::text, 'no-gsc'\) \|\| ':' \|\|\s+p_targeted_observation_id::text/s,
    );
    expect(t0).toMatch(/dr\.targeted_observation_id is null/);
    expect(t0).not.toMatch(/p_targeted_observation_id/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_t1_gsc_uidx/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_t1_no_gsc_uidx/);
  });

  it("rejects invalid provenance and fabricated v1 fields", () => {
    expect(t1).toMatch(/inspect targeted observation does not belong to the idea website/);
    expect(t1).toMatch(/inspect targeted observation is not analyzed/);
    expect(t1).toMatch(/inspect targeted observation source crawl does not match/);
    expect(t1).toMatch(/inspect crawl does not belong to the idea website/);
    expect(t1).toMatch(/inspect targeted crawl does not belong to the idea website/);
    expect(t1).toMatch(/inspect targeted page does not belong to the targeted crawl/);
    expect(t1).toMatch(/no_obvious_match_after_targeted_observation/);
    expect(t1).not.toMatch(/no_obvious_match_in_current_crawl/);
    expect(t1).toMatch(/inspect evidence kind is invalid/);
    expect(t1).toMatch(/inspect page evidence does not belong to the idea website crawl/);
    expect(t1).toMatch(/inspect targeted observation evidence does not match/);
    expect(t1).not.toMatch(/p_rank/);
    expect(t1).not.toMatch(/p_priority_band/);
    expect(t1).not.toMatch(/p_confidence/);
    expect(t1).not.toMatch(/p_scoring/);
    expect(t1).not.toMatch(/'goal'/);
    expect(t1).toMatch(/null,\s*\n\s*null,\s*\n\s*null,\s*\n\s*null,\s*\n\s*p_inspection_state/);
  });

  it("stores a canonical targeted_observation snapshot from persisted provenance", () => {
    expect(t1).toMatch(/v_observation_snapshot := jsonb_build_object\(/);
    expect(t1).toMatch(/'requested_url', v_obs_requested_url/);
    expect(t1).toMatch(/'requested_url_key', v_obs_requested_url_key/);
    expect(t1).toMatch(/'source_crawl_run_id', v_obs_source_crawl_id/);
    expect(t1).toMatch(/'source_queue_id', v_obs_source_queue_id/);
    expect(t1).toMatch(/'targeted_crawl_run_id', v_obs_targeted_crawl_id/);
    expect(t1).toMatch(/'result_page_id', v_obs_result_page_id/);
    expect(t1).toMatch(/'selection_mode', v_obs_selection_mode/);
    expect(t1).toMatch(/'completed_at', v_obs_completed_at/);
    expect(t1).toMatch(
      /when ref->>'kind' = 'targeted_observation' then v_observation_snapshot/,
    );
  });

  it("keeps T0 unable to persist targeted_observation evidence or ids", () => {
    expect(t0).toMatch(
      /v_kind not in \(\s*'page',\s*'crawl_run',\s*'gsc_sync',\s*'site_model',\s*'research_run',\s*'research_idea'\s*\)/,
    );
    expect(t0).not.toMatch(/'targeted_observation'/);
    expect(t0).toMatch(/targeted_observation_id,\s*\n\s*completed_at/);
    expect(t0).toMatch(/p_research_idea_id,\s*\n\s*null,\s*\n\s*timezone\('utc', now\(\)\)/);
    expect(t0).toMatch(/no_obvious_match_in_current_crawl/);
    expect(t0).not.toMatch(/no_obvious_match_after_targeted_observation/);
    expect(t0).toMatch(/dr\.targeted_observation_id is null/);
  });
});
