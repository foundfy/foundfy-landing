import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration024 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/024_research_decide_investigation.sql"),
  "utf8",
);

function readPrior(name: string): string {
  return readFileSync(path.join(__dirname, "../../../supabase/migrations", name), "utf8");
}

describe("migration 024 research decide investigation", () => {
  it("does not edit 012–023", () => {
    expect(readPrior("012_decision_engine_v1.sql")).toMatch(/engine_version = 'decision_v1'/);
    expect(readPrior("012_decision_engine_v1.sql")).toMatch(/gsc_search_sync_id uuid not null/);
    expect(readPrior("012_decision_engine_v1.sql")).toMatch(/goal_id uuid not null/);
    expect(migration024).not.toMatch(/create table if not exists public\.decision_runs/);
    expect(migration024).not.toMatch(/drop table/i);
  });

  it("makes GSC and goal nullable only with engine-conditional checks", () => {
    expect(migration024).toMatch(/alter column gsc_search_sync_id drop not null/);
    expect(migration024).toMatch(/alter column goal_id drop not null/);
    expect(migration024).toMatch(/decision_runs_engine_version_check/);
    expect(migration024).toMatch(/decision_runs_engine_evidence_check/);
    expect(migration024).toMatch(
      /engine_version in \('decision_v1', 'decision_research_inspect_v0'\)/,
    );
    expect(migration024).toMatch(/engine_version = 'decision_v1'/);
    expect(migration024).toMatch(/gsc_search_sync_id is not null/);
    expect(migration024).toMatch(/goal_id is not null/);
    expect(migration024).toMatch(/research_idea_id is null/);
    expect(migration024).toMatch(/engine_version = 'decision_research_inspect_v0'/);
    expect(migration024).toMatch(/research_idea_id is not null/);
    expect(migration024).toMatch(/goal_id is null/);
    expect(migration024.indexOf("engine_version = 'decision_v1'")).toBeLessThan(
      migration024.indexOf("engine_version = 'decision_research_inspect_v0'"),
    );
  });

  it("adds inspect type, evidence kinds, and NULL-safe identity indexes", () => {
    expect(migration024).toMatch(/inspect_related_demand_against_pages/);
    expect(migration024).toMatch(/research_run/);
    expect(migration024).toMatch(/research_idea/);
    expect(migration024).toMatch(/decision_runs_inspect_identity_gsc_uidx/);
    expect(migration024).toMatch(/decision_runs_inspect_identity_no_gsc_uidx/);
    expect(migration024).toMatch(/gsc_search_sync_id is not null/);
    expect(migration024).toMatch(/gsc_search_sync_id is null/);
    expect(migration024).toMatch(/references public\.research_ideas \(id, website_id\)/);
    expect(migration024).toMatch(/on delete cascade/);
    expect(migration024).toMatch(/notify pgrst, 'reload schema'/);
    expect(migration024).toMatch(/status = 'completed'/);
    expect(migration024).not.toMatch(/status in \('running', 'completed'\)/);
    expect(migration024).not.toMatch(/update public\.decision_runs/i);
    expect(migration024).not.toMatch(/insert into public\.gsc_search_syncs/i);
    expect(migration024).not.toMatch(/insert into public\.website_goals/i);
  });

  it("adds a persistence-only inspect RPC with service_role execute only", () => {
    expect(migration024).toMatch(
      /create or replace function public\.persist_research_inspect_decision\(/,
    );
    expect(migration024).toMatch(/security definer/);
    expect(migration024).toMatch(/set search_path = public/);
    expect(migration024).toMatch(/c_engine constant text := 'decision_research_inspect_v0'/);
    expect(migration024).toMatch(
      /c_decision_type constant text := 'inspect_related_demand_against_pages'/,
    );
    expect(migration024).toMatch(/'completed'/);
    expect(migration024).toMatch(/goal_id,\s*\n\s*goal_snapshot,/);
    expect(migration024).toMatch(/null,\s*\n\s*'{}'::jsonb,/);
    expect(migration024).toMatch(/when unique_violation then/);
    expect(migration024).toMatch(/inspect site model does not belong to the idea website/);
    expect(migration024).toMatch(/inspect crawl does not belong to the idea website/);
    expect(migration024).toMatch(/inspect GSC sync does not belong to the idea website/);
    expect(migration024).toMatch(/inspect evidence kind is invalid/);
    expect(migration024).not.toMatch(/p_engine_version/);
    expect(migration024).not.toMatch(/p_decision_type/);
    expect(migration024).not.toMatch(/p_website_id/);
    expect(migration024).not.toMatch(/p_goal_id/);
    expect(migration024).not.toMatch(/p_confidence/);
    expect(migration024).not.toMatch(/p_scoring/);
    expect(migration024).not.toMatch(/p_rank/);
    expect(migration024).not.toMatch(/p_priority_band/);
    expect(migration024).not.toMatch(/opportunityCompactKey|html_lang|stemming|embedding/i);
    expect(migration024).toMatch(
      /revoke all on function public\.persist_research_inspect_decision\(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb\) from public/,
    );
    expect(migration024).toMatch(
      /revoke all on function public\.persist_research_inspect_decision\(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb\) from anon/,
    );
    expect(migration024).toMatch(
      /revoke all on function public\.persist_research_inspect_decision\(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb\) from authenticated/,
    );
    expect(migration024).toMatch(
      /grant execute on function public\.persist_research_inspect_decision\(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb\) to service_role/,
    );
    expect(migration024).not.toMatch(
      /grant execute on function public\.persist_research_inspect_decision.*to anon/,
    );
    expect(migration024).not.toMatch(
      /grant execute on function public\.persist_research_inspect_decision.*to authenticated/,
    );
  });
});
