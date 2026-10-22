import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(__dirname, "../../../supabase/migrations");
const migration024 = readFileSync(
  path.join(migrationsDir, "024_research_decide_investigation.sql"),
  "utf8",
);
const migration025 = readFileSync(
  path.join(migrationsDir, "025_targeted_observe_foundation.sql"),
  "utf8",
);

const T0_IDENTITY =
  "public.persist_research_inspect_decision(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb)";
const T1_IDENTITY =
  "public.persist_research_inspect_decision_with_observation(uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb)";

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

describe("migration 024 remains frozen", () => {
  it("keeps the reviewed 024 SHA-256", () => {
    expect(sha256(migration024)).toBe(
      "22238501a027860f212653081c608f36c4c04dec68ccf0e00e43374961072228",
    );
  });
});

describe("migration 025 targeted observe foundation", () => {
  it("keeps 025 as a single frozen file before 026", () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("025"))).toEqual([
      "025_targeted_observe_foundation.sql",
    ]);
    expect(files.filter((name) => name.startsWith("026"))).toEqual([
      "026_targeted_observation_claim.sql",
    ]);
    expect(files.filter((name) => name.startsWith("027"))).toEqual([]);
  });

  it("adds crawl_runs.purpose with default, not-null, and allowlist", () => {
    expect(migration025).toMatch(
      /add column if not exists purpose text not null default 'site_sample'/,
    );
    expect(migration025).toMatch(/crawl_runs_purpose_check/);
    expect(migration025).toMatch(
      /check \(purpose in \('site_sample', 'targeted_observe'\)\)/,
    );
    expect(migration025).toMatch(/set purpose = 'site_sample'/);
  });

  it("enforces targeted max_pages=1 and status <> queued", () => {
    expect(migration025).toMatch(/crawl_runs_targeted_observe_max_pages_check/);
    expect(migration025).toMatch(
      /check \(purpose <> 'targeted_observe' or max_pages = 1\)/,
    );
    expect(migration025).toMatch(/crawl_runs_targeted_observe_not_queued_check/);
    expect(migration025).toMatch(
      /check \(purpose <> 'targeted_observe' or status <> 'queued'\)/,
    );
  });

  it("creates the expected supporting indexes", () => {
    expect(migration025).toMatch(/crawl_runs_website_purpose_status_completed_at_idx/);
    expect(migration025).toMatch(/targeted_observations_active_website_uidx/);
    expect(migration025).toMatch(/targeted_observations_analyzed_reuse_uidx/);
    expect(migration025).toMatch(/targeted_observations_website_created_at_idx/);
    expect(migration025).toMatch(/targeted_observations_source_crawl_run_id_idx/);
    expect(migration025).toMatch(/targeted_observations_targeted_crawl_run_id_idx/);
    expect(migration025).toMatch(/decision_runs_targeted_observation_id_idx/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_gsc_uidx/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_no_gsc_uidx/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_t1_gsc_uidx/);
    expect(migration025).toMatch(/decision_runs_inspect_identity_t1_no_gsc_uidx/);
  });

  it("creates targeted_observations with frozen columns, statuses, and row-semantic CHECK", () => {
    expect(migration025).toMatch(/create table if not exists public\.targeted_observations/);
    for (const column of [
      "website_id",
      "requested_url",
      "requested_url_key",
      "source_crawl_run_id",
      "source_queue_id",
      "targeted_crawl_run_id",
      "result_page_id",
      "requested_by",
      "selection_mode",
      "status",
      "failure_reason",
      "created_at",
      "started_at",
      "completed_at",
      "updated_at",
    ]) {
      expect(migration025).toMatch(new RegExp(`\\b${column}\\b`));
    }
    expect(migration025).toMatch(
      /check \(status in \('running', 'analyzed', 'fetch_failed'\)\)/,
    );
    expect(migration025).not.toMatch(/'requested'/);
    expect(migration025).toMatch(
      /check \(selection_mode in \('owner_selected', 'auto_candidate'\)\)/,
    );
    expect(migration025).toMatch(/targeted_observations_row_semantics_check/);
    expect(migration025).toMatch(/status = 'running'/);
    expect(migration025).toMatch(/status = 'analyzed'/);
    expect(migration025).toMatch(/status = 'fetch_failed'/);
    expect(migration025).toMatch(/references public\.gsc_observe_owners \(id\) on delete restrict/);
    expect(migration025).toMatch(/enable row level security/);
    expect(migration025).toMatch(/grant all on public\.targeted_observations to service_role/);
  });

  it("adds targeted_observation_id with restrict FK and frozen engine evidence CHECK", () => {
    expect(migration025).toMatch(
      /add column if not exists targeted_observation_id uuid/,
    );
    expect(migration025).toMatch(/decision_runs_targeted_observation_id_fkey/);
    expect(migration025).toMatch(
      /references public\.targeted_observations \(id\)\s+on delete restrict/s,
    );
    expect(migration025).toMatch(/decision_runs_engine_evidence_check/);
    expect(migration025).toMatch(
      /engine_version = 'decision_v1'[\s\S]*targeted_observation_id is null/,
    );
    expect(migration025).toMatch(
      /engine_version = 'decision_research_inspect_v0'[\s\S]*targeted_observation_id is null/,
    );
    expect(migration025).toMatch(
      /engine_version = 'decision_research_inspect_v0'[\s\S]*targeted_observation_id is not null/,
    );
    expect(migration025).toMatch(/goal_id is not null/);
    expect(migration025).toMatch(/research_idea_id is null/);
  });

  it("replaces inspect identity indexes with the four frozen T0/T1 identities", () => {
    expect(migration025).toMatch(
      /drop index if exists public\.decision_runs_inspect_identity_gsc_uidx/,
    );
    expect(migration025).toMatch(
      /targeted_observation_id is null[\s\S]*gsc_search_sync_id is not null/,
    );
    expect(migration025).toMatch(
      /targeted_observation_id is null[\s\S]*gsc_search_sync_id is null/,
    );
    expect(migration025).toMatch(
      /website_id, research_idea_id, crawl_run_id, gsc_search_sync_id, targeted_observation_id/,
    );
    expect(migration025).toMatch(
      /website_id, research_idea_id, crawl_run_id, targeted_observation_id/,
    );
    expect(migration025).not.toMatch(/drop constraint if exists decisions_run_rank_unique/);
    expect(migration025).not.toMatch(/drop constraint if exists decision_runs_rank/);
  });

  it("extends inspection_state and evidence-kind allowlists without content_gap", () => {
    expect(migration025).toMatch(/no_obvious_match_after_targeted_observation/);
    expect(migration025).toMatch(/clear_existing_page_evidence/);
    expect(migration025).toMatch(/no_obvious_match_in_current_crawl/);
    expect(migration025).toMatch(/'ambiguous'/);
    expect(migration025).toMatch(/'targeted_observation'/);
    expect(migration025).not.toMatch(/content_gap/);
    expect(migration025).not.toMatch(/create_page/);
  });

  it("keeps the T0 RPC identity and adds the unused T1 RPC identity", () => {
    expect(migration025).toMatch(
      /create or replace function public\.persist_research_inspect_decision\(/,
    );
    expect(migration025).toMatch(
      /create or replace function public\.persist_research_inspect_decision_with_observation\(/,
    );
    expect(migration025).toContain(`revoke all on function ${T0_IDENTITY} from public`);
    expect(migration025).toContain(`revoke all on function ${T0_IDENTITY} from anon`);
    expect(migration025).toContain(`revoke all on function ${T0_IDENTITY} from authenticated`);
    expect(migration025).toContain(`grant execute on function ${T0_IDENTITY} to service_role`);
    expect(migration025).toContain(`revoke all on function ${T1_IDENTITY} from public`);
    expect(migration025).toContain(`revoke all on function ${T1_IDENTITY} from anon`);
    expect(migration025).toContain(`revoke all on function ${T1_IDENTITY} from authenticated`);
    expect(migration025).toContain(`grant execute on function ${T1_IDENTITY} to service_role`);
    expect(migration025).toContain(`p_research_idea_id uuid,
  p_site_model_id uuid,
  p_crawl_run_id uuid,
  p_gsc_search_sync_id uuid,
  p_targeted_observation_id uuid,
  p_title text,
  p_explanation text,
  p_page_url text,
  p_page_id uuid,
  p_inspection_state text,
  p_gsc_truncated boolean,
  p_evidence_refs jsonb`);
  });

  it("marks both RPCs SECURITY DEFINER with search_path public", () => {
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
    for (const body of [t0, t1]) {
      expect(body).toMatch(/security definer/);
      expect(body).toMatch(/set search_path = public/);
    }
  });
});
