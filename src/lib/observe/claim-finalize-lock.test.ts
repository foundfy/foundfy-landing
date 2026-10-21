import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration026 = readFileSync(
  path.join(__dirname, "../../../supabase/migrations/026_targeted_observation_claim.sql"),
  "utf8",
);

describe("claim/finalize shared lifecycle lock", () => {
  it("uses the same website-scoped transaction lock and never reverse-orders row locks", () => {
    const claim = migration026.slice(
      migration026.indexOf("create or replace function public.claim_targeted_observation"),
      migration026.indexOf("create or replace function public.finalize_targeted_observation"),
    );
    const finalize = migration026.slice(
      migration026.indexOf("create or replace function public.finalize_targeted_observation"),
    );
    const lock = "hashtext('targeted_observe_lifecycle')";
    expect(claim).toContain(lock);
    expect(finalize).toContain(lock);
    expect(claim.indexOf("pg_advisory_xact_lock")).toBeLessThan(claim.indexOf("for update") === -1 ? claim.length : claim.indexOf("for update"));
    expect(claim.indexOf("pg_advisory_xact_lock")).toBeLessThan(claim.indexOf("insert into public.crawl_runs"));
    expect(finalize.indexOf("pg_advisory_xact_lock")).toBeLessThan(finalize.indexOf("for update"));
    expect(finalize.indexOf("select obs.website_id")).toBeLessThan(finalize.indexOf("pg_advisory_xact_lock"));
    expect(migration026).toMatch(/Does not serialize site_sample crawl completion/);
    expect(migration026).not.toMatch(/serializes normal site_sample/);
  });
});
