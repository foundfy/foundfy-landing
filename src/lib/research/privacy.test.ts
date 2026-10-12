import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("RESEARCH privacy lifecycle", () => {
  it("cascades website deletion and SET NULLs GSC without storing Google metrics on ideas", () => {
    const migration = read("../../../supabase/migrations/020_research_v0.sql");
    expect(migration).toMatch(/website_id uuid not null references public.websites \(id\) on delete cascade/);
    expect(migration).toMatch(/site_model_id uuid references public.site_models \(id\) on delete set null/);
    expect(migration).toMatch(/requested_by uuid references public.gsc_observe_owners \(id\) on delete set null/);
    expect(migration).toMatch(/gsc_sync_id uuid references public.gsc_search_syncs \(id\) on delete set null/);
    expect(migration).toMatch(/initial_gsc_sample_status/);
    expect(migration).not.toMatch(/clicks|impressions|ctr|position/);
    expect(migration).toMatch(/enable row level security/);
    expect(migration).not.toMatch(/grant all on public.research_runs to anon/);
  });

  it("does not delete RESEARCH during GSC disconnect", () => {
    const privacy = read("../actions/google-privacy.ts");
    expect(privacy).not.toMatch(/research_runs|research_ideas/);
  });

  it("keeps RESEARCH off the public website overview loader", () => {
    const overview = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    expect(overview).not.toMatch(/from \"@\/lib\/research|research_runs/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/research|loadResearchForOwner/);
  });

  it("keeps migration 021 RPCs off anon and authenticated", () => {
    const migration021 = read("../../../supabase/migrations/021_research_live_safety_hardening.sql");
    expect(migration021).toMatch(/revoke all on function public\.claim_research_recovery\(uuid, uuid\) from public/);
    expect(migration021).toMatch(/revoke all on function public\.claim_research_run\(uuid, text, timestamptz, jsonb\) from anon/);
    expect(migration021).not.toMatch(/grant execute on function public\.finalize_research_run.*to anon/);
    expect(migration021).toMatch(/revoke all on function public\.claim_research_request\(uuid, uuid, bigint, text\) from anon/);
    expect(migration021).toMatch(/revoke all on function public\.close_research_run\(uuid, uuid\) from authenticated/);
    expect(migration021).not.toMatch(/clicks|impressions|ctr|position/);
  });
});
