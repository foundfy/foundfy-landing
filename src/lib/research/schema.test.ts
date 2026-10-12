import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/020_research_v0.sql"),
  "utf8",
);

describe("RESEARCH migration 020 constraints", () => {
  it("enforces idea website identity with a composite run/website foreign key", () => {
    expect(migration).toMatch(/constraint research_runs_id_website_id_key unique \(id, website_id\)/);
    expect(migration).toMatch(/constraint research_ideas_run_website_fk/);
    expect(migration).toMatch(
      /foreign key \(run_id, website_id\)\s+references public\.research_runs \(id, website_id\)/s,
    );
  });

  it("rejects impossible provider and environment combinations", () => {
    expect(migration).toMatch(/research_runs_provider_environment_compat_check/);
    expect(migration).toMatch(
      /provider = 'fixture' and provider_environment = 'fixture'/,
    );
    expect(migration).toMatch(
      /provider = 'dataforseo' and provider_environment in \('sandbox', 'live'\)/,
    );
  });

  it("rejects negative provider cost and search volume", () => {
    expect(migration).toMatch(/provider_cost is null or provider_cost >= 0/);
    expect(migration).toMatch(
      /estimated_monthly_searches is null or estimated_monthly_searches >= 0/,
    );
    expect(migration).toMatch(/provider_result_order >= 0/);
    expect(migration).toMatch(/location_code > 0/);
  });

  it("allows at most one active run per website fingerprint", () => {
    expect(migration).toMatch(/research_runs_active_fingerprint_uidx/);
    expect(migration).toMatch(
      /unique index[\s\S]*\(website_id, request_fingerprint\)[\s\S]*status in \('requested', 'running'\)/s,
    );
  });

  it("serializes claims with a transactional advisory lock", () => {
    expect(migration).toMatch(/create or replace function public\.claim_research_run/);
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).toMatch(/outcome', 'reuse_completed'/);
    expect(migration).toMatch(/outcome', 'reuse_active'/);
    expect(migration).toMatch(/outcome', 'block_retry'/);
    expect(migration).toMatch(/outcome', 'claimed'/);
    expect(migration).not.toMatch(/grant execute on function public\.claim_research_run.*to anon/);
  });
});

const migration021 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/021_research_live_safety_hardening.sql"),
  "utf8",
);

describe("RESEARCH migration 021 live-safety hardening", () => {
  it("does not recreate RESEARCH tables or rewrite migration 020", () => {
    expect(migration021).not.toMatch(/create table if not exists public\.research_runs/);
    expect(migration021).not.toMatch(/create table if not exists public\.research_ideas/);
    expect(migration).not.toMatch(/interrupted/);
    expect(migration).not.toMatch(/last_progress_at/);
  });

  it("adds interrupted status, progress, blocking uniqueness, and locked claim/recovery RPCs", () => {
    expect(migration021).toMatch(/add column if not exists last_progress_at timestamptz/);
    expect(migration021).toMatch(/'interrupted'/);
    expect(migration021).toMatch(/research_runs_blocking_fingerprint_uidx/);
    expect(migration021).toMatch(/for update/);
    expect(migration021).toMatch(/outcome', 'recovery_required'/);
    expect(migration021).toMatch(/create or replace function public\.claim_research_recovery/);
    expect(migration021).toMatch(/create or replace function public\.finalize_research_run/);
    expect(migration021).toMatch(/outcome', 'claimed_recovery'/);
    expect(migration021).toMatch(/outcome', 'recovery_busy'/);
  });

  it("adds execution generation, closed lifecycle, idea uniqueness, and fenced RPCs", () => {
    expect(migration021).toMatch(/add column if not exists execution_generation bigint not null default 1/);
    expect(migration021).toMatch(/add column if not exists closed_at timestamptz/);
    expect(migration021).toMatch(/'closed'/);
    expect(migration021).toMatch(/add column if not exists request_key text/);
    expect(migration021).toMatch(/research_ideas_run_request_compact_uidx/);
    expect(migration021).toMatch(
      /status in \('requested', 'running', 'interrupted', 'partial', 'failed'\)/,
    );
    expect(migration021).toMatch(/create or replace function public\.claim_research_request/);
    expect(migration021).toMatch(/create or replace function public\.persist_research_request_result/);
    expect(migration021).toMatch(/create or replace function public\.close_research_run/);
    expect(migration021).toMatch(/p_execution_generation bigint/);
    expect(migration021).toMatch(/execution_generation = execution_generation \+ 1/);
    expect(migration021).toMatch(/outcome', 'superseded'/);
  });

  it("keeps new RPCs service_role only", () => {
    expect(migration021).toMatch(
      /revoke all on function public\.claim_research_recovery\(uuid, uuid\) from anon/,
    );
    expect(migration021).toMatch(
      /revoke all on function public\.claim_research_recovery\(uuid, uuid\) from authenticated/,
    );
    expect(migration021).toMatch(
      /grant execute on function public\.claim_research_recovery\(uuid, uuid\) to service_role/,
    );
    expect(migration021).toMatch(
      /revoke all on function public\.finalize_research_run.*from anon/,
    );
    expect(migration021).toMatch(
      /revoke all on function public\.claim_research_request\(uuid, uuid, bigint, text\) from anon/,
    );
    expect(migration021).toMatch(
      /revoke all on function public\.persist_research_request_result.*from authenticated/,
    );
    expect(migration021).toMatch(
      /revoke all on function public\.close_research_run\(uuid, uuid\) from public/,
    );
    expect(migration021).toMatch(
      /grant execute on function public\.close_research_run\(uuid, uuid\) to service_role/,
    );
    expect(migration021).not.toMatch(/grant execute on function public\.claim_research_recovery.*to anon/);
    expect(migration021).not.toMatch(/grant execute on function public\.claim_research_request.*to anon/);
    expect(migration021).not.toMatch(/grant execute on function public\.close_research_run.*to anon/);
  });
});
