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

const NEW_PERSIST_RPC_PARAMS = [...OLD_PERSIST_RPC_PARAMS, "p_provider_result_count"] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

function persistResultHeaders(sql: string): Array<{ params: string[]; header: string; body: string }> {
  const headerRe =
    /create or replace function public\.persist_research_request_result\s*\(([\s\S]*?)\)\s*returns jsonb([\s\S]*?)as \$\$([\s\S]*?)\$\$;/g;
  const found: Array<{ params: string[]; header: string; body: string }> = [];
  for (const match of sql.matchAll(headerRe)) {
    const header = match[1] ?? "";
    const params = [...header.matchAll(/\b(p_[a-z_]+)\s+[a-z]+/gi)].map((item) => item[1]);
    found.push({ params, header, body: match[3] ?? "" });
  }
  return found;
}

const migration022 = read("../../../supabase/migrations/022_research_result_provenance.sql");
const migration021 = read("../../../supabase/migrations/021_research_live_safety_hardening.sql");
const repository = read("./repository.ts");

describe("RESEARCH persist_research_request_result PostgREST compatibility", () => {
  const functions = persistResultHeaders(migration022);
  const tenArg = functions.find((fn) => fn.params.length === 10);
  const elevenArg = functions.find((fn) => fn.params.length === 11);

  it("defines unique 10-arg and 11-arg signatures with no defaulted 11th argument", () => {
    expect(functions).toHaveLength(2);
    expect(tenArg?.params).toEqual([...OLD_PERSIST_RPC_PARAMS]);
    expect(elevenArg?.params).toEqual([...NEW_PERSIST_RPC_PARAMS]);
    expect(elevenArg?.header).toMatch(/p_provider_result_count integer\s*$/);
    expect(elevenArg?.header).not.toMatch(/default/i);
    expect(tenArg?.header).not.toMatch(/p_provider_result_count/);
    expect(migration022).not.toMatch(/p_provider_result_count integer default/i);
  });

  it("keeps the 10-arg function as a thin wrapper that delegates NULL provenance", () => {
    expect(tenArg?.body).toMatch(
      /return public\.persist_research_request_result\(\s*p_run_id,\s*p_website_id,\s*p_execution_generation,\s*p_request_key,\s*p_status,\s*p_provider_task_id,\s*p_idea_count,\s*p_provider_cost,\s*p_failure_code,\s*p_ideas,\s*null::integer\s*\)/s,
    );
    expect(tenArg?.body).not.toMatch(/insert into public\.research_ideas/);
    expect(tenArg?.body).not.toMatch(/providerResultCount/);
  });

  it("Scenario A: currently deployed 10-name payload matches only the 10-arg wrapper", () => {
    expect([...OLD_PERSIST_RPC_PARAMS]).toEqual(tenArg?.params);
    expect(OLD_PERSIST_RPC_PARAMS).not.toContain("p_provider_result_count");
    expect(migration021).toMatch(
      /create or replace function public\.persist_research_request_result\(\s*p_run_id uuid,\s*p_website_id uuid,\s*p_execution_generation bigint,\s*p_request_key text,\s*p_status text,\s*p_provider_task_id text,\s*p_idea_count integer,\s*p_provider_cost numeric,\s*p_failure_code text,\s*p_ideas jsonb\s*\)/s,
    );
  });

  it("Scenario B: new application 11-name payload matches only the 11-arg implementation", () => {
    const persistCall = repository.match(
      /callFenceRpc\(\s*"persist_research_request_result",\s*\{([\s\S]*?)\}\s*\)/,
    );
    expect(persistCall?.[1]).toBeTruthy();
    const sent = [...(persistCall?.[1].matchAll(/\b(p_[a-z_]+)\s*:/g) ?? [])].map((item) => item[1]);
    expect([...sent].sort()).toEqual([...NEW_PERSIST_RPC_PARAMS].sort());
    expect(sent).toContain("p_provider_result_count");
    expect(sent).toHaveLength(NEW_PERSIST_RPC_PARAMS.length);
  });

  it("Scenario C: 10-name and 11-name PostgREST argument sets are not ambiguous", () => {
    expect(NEW_PERSIST_RPC_PARAMS).toHaveLength(OLD_PERSIST_RPC_PARAMS.length + 1);
    expect([...NEW_PERSIST_RPC_PARAMS.slice(0, 10)]).toEqual([...OLD_PERSIST_RPC_PARAMS]);
    expect(tenArg?.params.join(",")).not.toBe(elevenArg?.params.join(","));
    expect(migration022).not.toMatch(
      /drop function if exists public\.persist_research_request_result\(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb\)/,
    );
  });
});
