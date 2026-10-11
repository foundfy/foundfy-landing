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
