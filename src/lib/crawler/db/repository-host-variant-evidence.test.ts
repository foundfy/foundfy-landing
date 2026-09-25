import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_HOST_VARIANT_EVIDENCE_ORDER_COLUMN,
  PAGE_HOST_VARIANT_EVIDENCE_SELECT,
  listPageHostVariantEvidence,
} from "./repository";

const orderMock = vi.fn();
const neqMock = vi.fn();
const limitMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

function awaitable(result: unknown) {
  return {
    then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

describe("listPageHostVariantEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const success = {
      data: [
        {
          requested_url: "https://example.com/ca",
          final_url: "https://example.com/ca",
          canonical: "https://example.com/ca",
          content_hash: "abc",
          redirect_chain: [],
          status_code: 200,
        },
      ],
      error: null,
    };

    neqMock.mockImplementation(() => awaitable(success));
    limitMock.mockImplementation(() => {
      const query = awaitable(success) as ReturnType<typeof awaitable> & { neq: typeof neqMock };
      query.neq = neqMock;
      return query;
    });
    orderMock.mockReturnValue({ limit: limitMock });
    eqMock.mockReturnValue({ order: orderMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockImplementation((table: string) => {
      if (table !== "pages") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { select: selectMock };
    });
  });

  it("orders production pages by fetched_at, not created_at", async () => {
    await listPageHostVariantEvidence("website-1", { excludeCrawlRunId: "run-2" });

    expect(fromMock).toHaveBeenCalledWith("pages");
    expect(selectMock).toHaveBeenCalledWith(PAGE_HOST_VARIANT_EVIDENCE_SELECT);
    expect(orderMock).toHaveBeenCalledWith("fetched_at", { ascending: false });
    expect(orderMock.mock.calls.some((call) => call[0] === "created_at")).toBe(false);
    expect(PAGE_HOST_VARIANT_EVIDENCE_ORDER_COLUMN).toBe("fetched_at");
    expect(neqMock).toHaveBeenCalledWith("crawl_run_id", "run-2");
  });

  it("matches the production pages schema and never queries pages.created_at", () => {
    const schema = readFileSync(
      path.join(__dirname, "../../../../supabase/migrations/001_crawler_phase1.sql"),
      "utf8",
    );
    const pagesStart = schema.indexOf("create table if not exists public.pages");
    const linksStart = schema.indexOf("create table if not exists public.links");
    const pagesBody = schema.slice(pagesStart, linksStart);
    const source = readFileSync(path.join(__dirname, "repository.ts"), "utf8");
    const fnStart = source.indexOf("export async function listPageHostVariantEvidence");
    const fnEnd = source.indexOf("export async function findPageByRequestedUrl");
    const fnBody = source.slice(fnStart, fnEnd);

    expect(pagesBody).toContain("fetched_at timestamptz");
    expect(pagesBody).not.toMatch(/^\s*created_at /m);
    expect(fnBody).toContain("PAGE_HOST_VARIANT_EVIDENCE_ORDER_COLUMN");
    expect(fnBody).not.toContain('"created_at"');
    expect(fnBody).not.toContain("'created_at'");
    expect(PAGE_HOST_VARIANT_EVIDENCE_SELECT.split(",").map((part) => part.trim())).toEqual([
      "requested_url",
      "final_url",
      "canonical",
      "content_hash",
      "redirect_chain",
      "status_code",
    ]);
  });

  it("throws when the pages query fails so callers can fail open", async () => {
    const failure = {
      data: null,
      error: { message: "column pages.created_at does not exist" },
    };
    limitMock.mockImplementation(() => awaitable(failure));

    await expect(listPageHostVariantEvidence("website-1")).rejects.toThrow(
      "Failed to load page host-variant evidence: column pages.created_at does not exist",
    );
  });
});
