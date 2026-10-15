import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_PERSIST_RPC_PARAMS = [
  "p_run_id",
  "p_website_id",
  "p_execution_generation",
  "p_request_key",
  "p_status",
  "p_provider_task_id",
  "p_idea_count",
  "p_provider_cost",
  "p_failure_code",
  "p_ideas",
] as const;

const ELEVEN_PERSIST_RPC_PARAMS = [...OLD_PERSIST_RPC_PARAMS, "p_provider_result_count"] as const;
const TWELVE_PERSIST_RPC_PARAMS = [...ELEVEN_PERSIST_RPC_PARAMS, "p_filter_reason_counts"] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

function persistResultHeaders(
  sql: string,
): Array<{ params: string[]; header: string; extras: string; body: string }> {
  const headerRe =
    /create or replace function public\.persist_research_request_result\s*\(([\s\S]*?)\)\s*returns jsonb([\s\S]*?)as \$\$([\s\S]*?)\$\$;/g;
  const found: Array<{ params: string[]; header: string; extras: string; body: string }> = [];
  for (const match of sql.matchAll(headerRe)) {
    const header = match[1] ?? "";
    const params = [...header.matchAll(/\b(p_[a-z_]+)\s+[a-z]+/gi)].map((item) => item[1]);
    found.push({ params, header, extras: match[2] ?? "", body: match[3] ?? "" });
  }
  return found;
}

const migration022 = read("../../../supabase/migrations/022_research_result_provenance.sql");
const migration023 = read("../../../supabase/migrations/023_research_filter_provenance.sql");
const migration021 = read("../../../supabase/migrations/021_research_live_safety_hardening.sql");
const repository = read("./repository.ts");

describe("RESEARCH persist_research_request_result PostgREST compatibility", () => {
  const functions022 = persistResultHeaders(migration022);
  const tenArg022 = functions022.find((fn) => fn.params.length === 10);
  const elevenArg022 = functions022.find((fn) => fn.params.length === 11);
  const functions = persistResultHeaders(migration023);
  const tenArg = functions.find((fn) => fn.params.length === 10);
  const elevenArg = functions.find((fn) => fn.params.length === 11);
  const twelveArg = functions.find((fn) => fn.params.length === 12);

  it("keeps unique 10-arg and 11-arg signatures in immutable migration 022", () => {
    expect(functions022).toHaveLength(2);
    expect(tenArg022?.params).toEqual([...OLD_PERSIST_RPC_PARAMS]);
    expect(elevenArg022?.params).toEqual([...ELEVEN_PERSIST_RPC_PARAMS]);
    expect(elevenArg022?.header).not.toMatch(/default/i);
  });

  it("defines unique 10-arg, 11-arg, and 12-arg signatures with no defaults", () => {
    expect(functions).toHaveLength(3);
    expect(tenArg?.params).toEqual([...OLD_PERSIST_RPC_PARAMS]);
    expect(elevenArg?.params).toEqual([...ELEVEN_PERSIST_RPC_PARAMS]);
    expect(twelveArg?.params).toEqual([...TWELVE_PERSIST_RPC_PARAMS]);
    expect(twelveArg?.header).toMatch(/p_filter_reason_counts jsonb\s*$/);
    expect(tenArg?.header).not.toMatch(/default/i);
    expect(elevenArg?.header).not.toMatch(/default/i);
    expect(twelveArg?.header).not.toMatch(/default/i);
    expect(migration023).not.toMatch(/p_filter_reason_counts jsonb default/i);
    expect(migration023).not.toMatch(/p_provider_result_count integer default/i);
  });

  it("keeps the 10-arg and 11-arg functions as thin wrappers that delegate NULL provenance", () => {
    expect(tenArg?.body).toMatch(
      /return public\.persist_research_request_result\(\s*p_run_id,\s*p_website_id,\s*p_execution_generation,\s*p_request_key,\s*p_status,\s*p_provider_task_id,\s*p_idea_count,\s*p_provider_cost,\s*p_failure_code,\s*p_ideas,\s*null::integer,\s*null::jsonb\s*\)/s,
    );
    expect(elevenArg?.body).toMatch(
      /return public\.persist_research_request_result\(\s*p_run_id,\s*p_website_id,\s*p_execution_generation,\s*p_request_key,\s*p_status,\s*p_provider_task_id,\s*p_idea_count,\s*p_provider_cost,\s*p_failure_code,\s*p_ideas,\s*p_provider_result_count,\s*null::jsonb\s*\)/s,
    );
    expect(tenArg?.body).not.toMatch(/insert into public\.research_ideas/);
    expect(elevenArg?.body).not.toMatch(/insert into public\.research_ideas/);
    expect(twelveArg?.body).toMatch(/insert into public\.research_ideas/);
    expect(twelveArg?.body).toMatch(/filterReasonCounts/);
  });

  it("Scenario A: oldest 10-name payload matches only the 10-arg wrapper", () => {
    expect([...OLD_PERSIST_RPC_PARAMS]).toEqual(tenArg?.params);
    expect(OLD_PERSIST_RPC_PARAMS).not.toContain("p_provider_result_count");
    expect(OLD_PERSIST_RPC_PARAMS).not.toContain("p_filter_reason_counts");
    expect(migration021).toMatch(
      /create or replace function public\.persist_research_request_result\(\s*p_run_id uuid,\s*p_website_id uuid,\s*p_execution_generation bigint,\s*p_request_key text,\s*p_status text,\s*p_provider_task_id text,\s*p_idea_count integer,\s*p_provider_cost numeric,\s*p_failure_code text,\s*p_ideas jsonb\s*\)/s,
    );
  });

  it("Scenario B: current 11-name payload remains resolvable", () => {
    expect(elevenArg?.params).toEqual([...ELEVEN_PERSIST_RPC_PARAMS]);
    expect(elevenArg?.params).toContain("p_provider_result_count");
    expect(elevenArg?.params).not.toContain("p_filter_reason_counts");
  });

  it("Scenario C: new application 12-name payload matches only the 12-arg implementation", () => {
    const persistCall = repository.match(
      /callFenceRpc\(\s*"persist_research_request_result",\s*\{([\s\S]*?)\}\s*\)/,
    );
    expect(persistCall?.[1]).toBeTruthy();
    const sent = [...(persistCall?.[1].matchAll(/\b(p_[a-z_]+)\s*:/g) ?? [])].map((item) => item[1]);
    expect([...sent].sort()).toEqual([...TWELVE_PERSIST_RPC_PARAMS].sort());
    expect(sent).toContain("p_provider_result_count");
    expect(sent).toContain("p_filter_reason_counts");
    expect(sent).toHaveLength(TWELVE_PERSIST_RPC_PARAMS.length);
  });

  it("Scenario D: 10-name, 11-name, and 12-name PostgREST argument sets are not ambiguous", () => {
    expect(TWELVE_PERSIST_RPC_PARAMS).toHaveLength(OLD_PERSIST_RPC_PARAMS.length + 2);
    expect([...ELEVEN_PERSIST_RPC_PARAMS.slice(0, 10)]).toEqual([...OLD_PERSIST_RPC_PARAMS]);
    expect(tenArg?.params.join(",")).not.toBe(elevenArg?.params.join(","));
    expect(elevenArg?.params.join(",")).not.toBe(twelveArg?.params.join(","));
    expect(migration023).not.toMatch(
      /drop function if exists public\.persist_research_request_result/,
    );
    expect(tenArg?.extras).toMatch(/security definer/i);
    expect(elevenArg?.extras).toMatch(/security definer/i);
    expect(twelveArg?.extras).toMatch(/security definer/i);
    expect(tenArg?.extras).toMatch(/search_path = public/);
    expect(elevenArg?.extras).toMatch(/search_path = public/);
    expect(twelveArg?.extras).toMatch(/search_path = public/);
    expect(migration023).toMatch(/notify pgrst, 'reload schema'/);
  });
});
