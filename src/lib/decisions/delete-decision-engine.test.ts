import { beforeEach, describe, expect, it, vi } from "vitest";

type Filter = [op: "eq" | "not", column: string, ...args: unknown[]];
type DeleteCall = { table: string; filters: Filter[] };

const calls: DeleteCall[] = [];
let failures: Array<{ table: string; withTargetedFilter?: boolean; message: string }> = [];

function matchesFailure(call: DeleteCall) {
  return failures.find(
    (failure) =>
      failure.table === call.table &&
      (failure.withTargetedFilter === undefined ||
        failure.withTargetedFilter ===
          call.filters.some((filter) => filter[0] === "not" && filter[1] === "targeted_observation_id")),
  );
}

function deleteBuilder(table: string) {
  const call: DeleteCall = { table, filters: [] };
  calls.push(call);
  const builder = {
    eq(column: string, value: unknown) {
      call.filters.push(["eq", column, value]);
      return builder;
    },
    not(column: string, operator: string, value: unknown) {
      call.filters.push(["not", column, operator, value]);
      return builder;
    },
    then(resolve: (result: { error: { message: string } | null }) => void) {
      const failure = matchesFailure(call);
      resolve({ error: failure ? { message: failure.message } : null });
    },
  };
  return builder;
}

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      return {
        delete: () => deleteBuilder(table),
        select() {
          throw new Error(`cleanup must not read ${table}`);
        },
        update() {
          throw new Error(`cleanup must not update ${table}`);
        },
        insert() {
          throw new Error(`cleanup must not insert into ${table}`);
        },
      };
    },
    rpc() {
      throw new Error("cleanup must not call RPCs");
    },
  }),
}));

import { deleteDecisionEngineForWebsite } from "./db";

const WEBSITE = "11111111-1111-4111-8111-111111111111";
const OTHER_WEBSITE = "22222222-2222-4222-8222-222222222222";

const expectedSequence = (websiteId: string): DeleteCall[] => [
  {
    table: "decision_runs",
    filters: [
      ["eq", "website_id", websiteId],
      ["not", "targeted_observation_id", "is", null],
    ],
  },
  { table: "targeted_observations", filters: [["eq", "website_id", websiteId]] },
  { table: "decision_runs", filters: [["eq", "website_id", websiteId]] },
];

describe("deleteDecisionEngineForWebsite (Google disconnect / property-change cleanup)", () => {
  beforeEach(() => {
    calls.length = 0;
    failures = [];
  });

  it("deletes T1 runs, then the website's targeted observations, then the remaining runs", async () => {
    await deleteDecisionEngineForWebsite(WEBSITE);
    expect(calls).toEqual(expectedSequence(WEBSITE));
  });

  it("completes when the website has no targeted observations (each delete simply matches no rows)", async () => {
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
  });

  it("deletes a targeted observation that is still running: no status filter on the observation delete", async () => {
    await deleteDecisionEngineForWebsite(WEBSITE);
    const observationDelete = calls.find((call) => call.table === "targeted_observations");
    expect(observationDelete?.filters).toEqual([["eq", "website_id", WEBSITE]]);
  });

  it("scopes every delete to the requested website only", async () => {
    await deleteDecisionEngineForWebsite(WEBSITE);
    await deleteDecisionEngineForWebsite(OTHER_WEBSITE);
    expect(calls).toEqual([...expectedSequence(WEBSITE), ...expectedSequence(OTHER_WEBSITE)]);
    for (const call of calls) {
      const websiteFilters = call.filters.filter((filter) => filter[1] === "website_id");
      expect(websiteFilters).toHaveLength(1);
      expect(websiteFilters[0][0]).toBe("eq");
    }
  });

  it("does not touch Research, crawls, pages or historical ACT records", async () => {
    await deleteDecisionEngineForWebsite(WEBSITE);
    const tables = new Set(calls.map((call) => call.table));
    expect([...tables].sort()).toEqual(["decision_runs", "targeted_observations"]);
    for (const preserved of [
      "research_ideas",
      "research_runs",
      "crawl_runs",
      "pages",
      "actions",
      "action_attempts",
      "action_verifications",
      "action_evidence_refs",
    ]) {
      expect(tables.has(preserved)).toBe(false);
    }
  });

  it("refuses an empty website id without issuing any delete", async () => {
    await expect(deleteDecisionEngineForWebsite("")).rejects.toThrow(/website id is required/);
    expect(calls).toHaveLength(0);
  });

  it("propagates a T1 run delete error and stops before deleting observations", async () => {
    failures = [{ table: "decision_runs", withTargetedFilter: true, message: "boom-t1" }];
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).rejects.toThrow(
      "Failed to delete Decision Engine data: boom-t1",
    );
    expect(calls).toHaveLength(1);
  });

  it("propagates a targeted observation delete error and stops before deleting the remaining runs", async () => {
    failures = [{ table: "targeted_observations", message: "violates foreign key constraint" }];
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).rejects.toThrow(
      "Failed to delete targeted observations: violates foreign key constraint",
    );
    expect(calls.map((call) => call.table)).toEqual(["decision_runs", "targeted_observations"]);
  });

  it("propagates a remaining-run delete error (e.g. RESTRICT from a racing observation)", async () => {
    failures = [{ table: "decision_runs", withTargetedFilter: false, message: "restrict violation" }];
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).rejects.toThrow(
      "Failed to delete Decision Engine data: restrict violation",
    );
    expect(calls).toHaveLength(3);
  });

  it("is safe to retry after a partial cleanup: the same website-scoped sequence completes", async () => {
    failures = [{ table: "targeted_observations", message: "temporary outage" }];
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).rejects.toThrow(/temporary outage/);

    failures = [];
    calls.length = 0;
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).resolves.toBeUndefined();
    expect(calls).toEqual(expectedSequence(WEBSITE));

    calls.length = 0;
    await expect(deleteDecisionEngineForWebsite(WEBSITE)).resolves.toBeUndefined();
    expect(calls).toEqual(expectedSequence(WEBSITE));
  });
});
