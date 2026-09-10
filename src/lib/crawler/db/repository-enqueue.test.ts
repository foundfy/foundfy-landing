import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueUrl } from "./repository";

const upsertMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "crawl_queue") {
        return {
          upsert: upsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

describe("enqueueUrl deduplication", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("uses crawl_run_id + url conflict handling for sitemap and BFS rediscovery", async () => {
    await enqueueUrl({
      crawlRunId: "run-1",
      url: "https://example.com/about",
      depth: 0,
      priority: 50,
    });
    await enqueueUrl({
      crawlRunId: "run-1",
      url: "https://example.com/about",
      depth: 1,
      priority: 10,
    });

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        crawl_run_id: "run-1",
        url: "https://example.com/about",
      }),
      { onConflict: "crawl_run_id,url", ignoreDuplicates: true },
    );
  });

  it("allows the same requested URL in different crawl runs", async () => {
    await enqueueUrl({
      crawlRunId: "run-1",
      url: "https://example.com/about",
    });
    await enqueueUrl({
      crawlRunId: "run-2",
      url: "https://example.com/about",
    });

    expect(upsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ crawl_run_id: "run-1" }),
      { onConflict: "crawl_run_id,url", ignoreDuplicates: true },
    );
    expect(upsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ crawl_run_id: "run-2" }),
      { onConflict: "crawl_run_id,url", ignoreDuplicates: true },
    );
  });
});
