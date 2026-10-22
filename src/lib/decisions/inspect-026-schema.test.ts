import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(__dirname, "../../../supabase/migrations");
const migration025 = readFileSync(
  path.join(migrationsDir, "025_targeted_observe_foundation.sql"),
  "utf8",
);
const migration026 = readFileSync(
  path.join(migrationsDir, "026_targeted_observation_claim.sql"),
  "utf8",
);

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

const CLAIM_IDENTITY =
  "public.claim_targeted_observation(uuid, uuid, uuid, uuid, text, uuid, text)";
const FINALIZE_IDENTITY =
  "public.finalize_targeted_observation(uuid, text, uuid, text)";

describe("migration 026 targeted observation claim", () => {
  it("does not modify frozen 025", () => {
    expect(sha256(migration025)).toBe(
      "749cc08f107c6128e473d488ceb294abf7512306608005b90515dec2b35ec884",
    );
  });

  it("uses the exact 026 filename and does not introduce 027", () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("026"))).toEqual([
      "026_targeted_observation_claim.sql",
    ]);
    expect(files.filter((name) => name.startsWith("027"))).toEqual([]);
  });

  it("adds source_inspect_run_id NOT NULL FK RESTRICT", () => {
    expect(migration026).toMatch(/add column source_inspect_run_id uuid not null/);
    expect(migration026).toMatch(
      /references public\.decision_runs \(id\)\s+on delete restrict/s,
    );
  });

  it("adds source_research_idea_id with composite FK RESTRICT", () => {
    expect(migration026).toMatch(/add column source_research_idea_id uuid not null/);
    expect(migration026).toMatch(/targeted_observations_source_research_idea_website_fk/);
    expect(migration026).toMatch(
      /foreign key \(source_research_idea_id, website_id\)\s+references public\.research_ideas \(id, website_id\)\s+on delete restrict/s,
    );
  });

  it("drops then recreates analyzed reuse unique as idea-scoped", () => {
    const dropAt = migration026.indexOf(
      "drop index if exists public.targeted_observations_analyzed_reuse_uidx",
    );
    const createAt = migration026.indexOf(
      "create unique index targeted_observations_analyzed_reuse_uidx",
    );
    expect(dropAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(dropAt);
    expect(migration026).not.toMatch(
      /create unique index if not exists targeted_observations_analyzed_reuse_uidx/,
    );
    expect(migration026).toMatch(
      /create unique index targeted_observations_analyzed_reuse_uidx\s+on public\.targeted_observations \(\s+website_id,\s+source_crawl_run_id,\s+source_research_idea_id,\s+requested_url_key\s+\)\s+where status = 'analyzed'/s,
    );
  });

  it("defines claim with exactly seven args and no caller URL or idea", () => {
    expect(migration026).toMatch(
      /create or replace function public\.claim_targeted_observation\(\s+p_website_id uuid,\s+p_source_crawl_run_id uuid,\s+p_source_queue_id uuid,\s+p_source_inspect_run_id uuid,\s+p_requested_url_key text,\s+p_requested_by uuid,\s+p_selection_mode text\s+\)/s,
    );
    expect(migration026).not.toMatch(/p_requested_url /);
    expect(migration026).not.toMatch(/p_source_research_idea_id/);
    expect(migration026).toMatch(/v_source_queue_url/);
    expect(migration026).toMatch(/from public\.crawl_queue q/);
  });

  it("requires T0 no_obvious_match_in_current_crawl", () => {
    expect(migration026).toMatch(/inspection_state <> 'no_obvious_match_in_current_crawl'/);
    expect(migration026).toMatch(/targeted_observation_id is not null/);
  });

  it("uses the frozen latest usable site_sample ordering", () => {
    expect(migration026).toMatch(/cr\.purpose = 'site_sample'/);
    expect(migration026).toMatch(/cr\.status = 'completed'/);
    expect(migration026).toMatch(/cr\.pages_crawled > 0/);
    expect(migration026).toMatch(
      /order by cr\.completed_at desc nulls last,\s+cr\.created_at desc/s,
    );
  });

  it("returns exactly four claim statuses", () => {
    expect(migration026).toMatch(/'status', 'stale_source'/);
    expect(migration026).toMatch(/'status', 'reused'/);
    expect(migration026).toMatch(/'status', 'already_running'/);
    expect(migration026).toMatch(/'status', 'claimed'/);
    expect(migration026).not.toMatch(/'status', 'queued'/);
  });

  it("rolls back crawl and observation inserts in the same unique_violation block", () => {
    const claim = migration026.slice(
      migration026.indexOf("create or replace function public.claim_targeted_observation"),
      migration026.indexOf("create or replace function public.finalize_targeted_observation"),
    );
    expect(claim).toMatch(/insert into public\.crawl_runs/);
    expect(claim).toMatch(/insert into public\.targeted_observations/);
    expect(claim).toMatch(/exception\s+when unique_violation then/s);
    const rollbackAt = claim.indexOf("when unique_violation then");
    expect(claim.indexOf("insert into public.crawl_runs")).toBeGreaterThan(-1);
    expect(claim.indexOf("insert into public.targeted_observations")).toBeGreaterThan(-1);
    expect(rollbackAt).toBeGreaterThan(claim.indexOf("insert into public.targeted_observations"));
    expect(claim.indexOf("insert into public.crawl_runs")).toBeLessThan(rollbackAt);
  });

  it("defines finalize with four args and writes both terminals", () => {
    expect(migration026).toContain(FINALIZE_IDENTITY.replace("public.", "function public."));
    expect(migration026).toMatch(
      /create or replace function public\.finalize_targeted_observation\(\s+p_observation_id uuid,\s+p_status text,\s+p_result_page_id uuid,\s+p_failure_reason text\s+\)/s,
    );
    expect(migration026).toMatch(/status = 'analyzed'/);
    expect(migration026).toMatch(/status = 'completed'/);
    expect(migration026).toMatch(/status = 'fetch_failed'/);
    expect(migration026).toMatch(/status = 'failed'/);
    expect(migration026).not.toMatch(/last_crawled_at/);
  });

  it("uses the same website-scoped lifecycle advisory lock in claim and finalize before row locks", () => {
    const lock = /pg_advisory_xact_lock\(\s+hashtext\('targeted_observe_lifecycle'\),\s+hashtext\(v_website_id::text\)\s+\)/s;
    expect(migration026.match(new RegExp(lock, "g"))?.length).toBe(2);
    expect(migration026).toMatch(/Does not serialize site_sample crawl completion/);
    const claim = migration026.slice(
      migration026.indexOf("create or replace function public.claim_targeted_observation"),
      migration026.indexOf("create or replace function public.finalize_targeted_observation"),
    );
    const finalize = migration026.slice(
      migration026.indexOf("create or replace function public.finalize_targeted_observation"),
    );
    expect(claim.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(claim.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      claim.indexOf("insert into public.crawl_runs"),
    );
    expect(finalize.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(finalize.indexOf("pg_advisory_xact_lock")).toBeLessThan(finalize.indexOf("for update"));
  });

  it("grants both RPCs to service_role only", () => {
    expect(migration026).toMatch(
      new RegExp(`revoke all on function ${CLAIM_IDENTITY.replace(/[()]/g, "\\$&")} from public`),
    );
    expect(migration026).toMatch(
      new RegExp(`revoke all on function ${CLAIM_IDENTITY.replace(/[()]/g, "\\$&")} from anon`),
    );
    expect(migration026).toMatch(
      new RegExp(
        `revoke all on function ${CLAIM_IDENTITY.replace(/[()]/g, "\\$&")} from authenticated`,
      ),
    );
    expect(migration026).toMatch(
      new RegExp(`grant execute on function ${CLAIM_IDENTITY.replace(/[()]/g, "\\$&")} to service_role`),
    );
    expect(migration026).toMatch(
      new RegExp(`revoke all on function ${FINALIZE_IDENTITY.replace(/[()]/g, "\\$&")} from public`),
    );
    expect(migration026).toMatch(
      new RegExp(`grant execute on function ${FINALIZE_IDENTITY.replace(/[()]/g, "\\$&")} to service_role`),
    );
    expect(migration026).toMatch(/security definer/g);
    expect(migration026).toMatch(/set search_path = public/g);
  });

  it("does not rewrite website-delete FKs or replace the T1 RPC", () => {
    expect(migration026).not.toMatch(/on delete cascade/);
    expect(migration026).not.toMatch(/persist_research_inspect_decision_with_observation/);
    expect(migration026).not.toMatch(/025_targeted_observe_foundation/);
  });
});
