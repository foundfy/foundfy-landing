import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

import {
  findLatestCompatibleResearchRun,
  findLatestReadableCompletedRunForFingerprint,
  listReadableCompletedResearchRuns,
  RESEARCH_READABLE_COMPLETED_PAGE_SIZE,
} from "./repository";

type QueryCalls = {
  eq: Array<[string, unknown]>;
  is: Array<[string, unknown]>;
  order: Array<[string, unknown]>;
  range: Array<[number, number]>;
  limit: number[];
};

function runRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
    website_id: "site-1",
    site_model_id: "model-1",
    site_model_confirmed_at: "2026-10-15T12:37:56.457+00:00",
    requested_by: "owner-1",
    gsc_sync_id: null,
    gsc_queries_truncated: true,
    country_key: "ES",
    country_name: "Spain",
    location_code: 2724,
    language_codes: ["es"],
    offering_seeds: ["Materiales para pintura sobre seda"],
    provider: "dataforseo",
    provider_environment: "live",
    status: "completed",
    request_fingerprint: "fp-es",
    request_ledger: [],
    provider_cost: 0.09,
    failure_code: null,
    failure_message: null,
    created_at: "2026-10-15T12:54:32.806Z",
    started_at: "2026-10-15T12:54:33.000Z",
    completed_at: "2026-10-15T12:54:36.952Z",
    updated_at: "2026-10-15T12:54:36.952Z",
    last_progress_at: "2026-10-15T12:54:36.952Z",
    execution_generation: 1,
    closed_at: null,
    ...overrides,
  };
}

function createQuery(result: { data: unknown; error: null }) {
  const calls: QueryCalls = { eq: [], is: [], order: [], range: [], limit: [] };
  const query = {
    calls,
    select: () => query,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return query;
    },
    is: (column: string, value: unknown) => {
      calls.is.push([column, value]);
      return query;
    },
    order: (column: string, options: unknown) => {
      calls.order.push([column, options]);
      return query;
    },
    range: (from: number, to: number) => {
      calls.range.push([from, to]);
      return Promise.resolve(result);
    },
    limit: (value: number) => {
      calls.limit.push(value);
      return query;
    },
    maybeSingle: () => Promise.resolve(result),
  };
  return query;
}

describe("RESEARCH persisted-read repository queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pages through all completed unclosed runs instead of applying a global history cap", async () => {
    const firstPage = Array.from({ length: RESEARCH_READABLE_COMPLETED_PAGE_SIZE }, (_, index) =>
      runRow({
        id: `other-${index}`,
        request_fingerprint: `fp-other-${index}`,
      }),
    );
    const spanish = runRow();
    const queries: Array<ReturnType<typeof createQuery>> = [];
    fromMock.mockImplementation(() => {
      const query = createQuery({
        data: queries.length === 0 ? firstPage : [spanish],
        error: null,
      });
      queries.push(query);
      return query;
    });

    const runs = await listReadableCompletedResearchRuns({
      websiteId: "site-1",
      environment: "live",
    });

    expect(runs).toHaveLength(RESEARCH_READABLE_COMPLETED_PAGE_SIZE + 1);
    expect(runs.some((run) => run.id === spanish.id)).toBe(true);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.calls.range).toEqual([[0, RESEARCH_READABLE_COMPLETED_PAGE_SIZE - 1]]);
    expect(queries[1]?.calls.range).toEqual([
      [RESEARCH_READABLE_COMPLETED_PAGE_SIZE, RESEARCH_READABLE_COMPLETED_PAGE_SIZE * 2 - 1],
    ]);
    expect(queries[0]?.calls.eq).toEqual([
      ["website_id", "site-1"],
      ["provider_environment", "live"],
      ["status", "completed"],
    ]);
    expect(queries[0]?.calls.is).toEqual([["closed_at", null]]);
    expect(queries[0]?.calls.order).toEqual([
      ["completed_at", { ascending: false, nullsFirst: false }],
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(queries[0]?.calls.limit).toEqual([]);
  });

  it("loads the current readable completed run for one fingerprint without a website-wide window", async () => {
    const spanish = runRow();
    const query = createQuery({ data: spanish, error: null });
    fromMock.mockReturnValue(query);

    const run = await findLatestReadableCompletedRunForFingerprint({
      websiteId: "site-1",
      fingerprint: "fp-es",
    });

    expect(run?.id).toBe(spanish.id);
    expect(query.calls.eq).toEqual([
      ["website_id", "site-1"],
      ["request_fingerprint", "fp-es"],
      ["status", "completed"],
    ]);
    expect(query.calls.is).toEqual([["closed_at", null]]);
    expect(query.calls.order).toEqual([
      ["completed_at", { ascending: false, nullsFirst: false }],
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.calls.limit).toEqual([1]);
    expect(query.calls.range).toEqual([]);
  });

  it("loads the latest execution run with created_at then id ordering", async () => {
    const latest = runRow({ status: "failed", completed_at: null });
    const query = createQuery({ data: latest, error: null });
    fromMock.mockReturnValue(query);

    const run = await findLatestCompatibleResearchRun({
      websiteId: "site-1",
      environment: "live",
    });

    expect(run?.id).toBe(latest.id);
    expect(query.calls.order).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.calls.limit).toEqual([1]);
  });
});
