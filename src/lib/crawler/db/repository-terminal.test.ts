import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  markCrawlRunCompleted,
  markCrawlRunFailed,
  resetAbandonedProcessingQueueItems,
} from "./repository";

type QueryResult = { data: unknown; error: null };

function createRunUpdateChain(result: QueryResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqStartedAt = vi.fn(() => ({ select }));
  const eqStatus = vi.fn(() => ({ eq: eqStartedAt, select }));
  const inStatus = vi.fn(() => ({ eq: eqStartedAt, is: eqStartedAt, select }));
  const eqId = vi.fn(() => ({ in: inStatus, eq: eqStatus, is: eqStartedAt, select }));
  const update = vi.fn(() => ({ eq: eqId }));

  return {
    update,
    eqId,
    eqStatus,
    inStatus,
    eqStartedAt,
    select,
    maybeSingle,
  };
}

const runUpdateChain = createRunUpdateChain({ data: null, error: null });
const websiteUpdateMock = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));

const fromMock = vi.fn((table: string) => {
  if (table === "crawl_queue") {
    const queueEqStatus = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: "queue-1" }], error: null }),
    }));
    const queueEqRun = vi.fn(() => ({ eq: queueEqStatus }));
    return {
      update: vi.fn(() => ({ eq: queueEqRun })),
    };
  }

  if (table === "websites") {
    return { update: websiteUpdateMock };
  }

  return { update: runUpdateChain.update };
});

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

describe("crawl run terminal updates", () => {
  beforeEach(() => {
    runUpdateChain.update.mockClear();
    runUpdateChain.eqId.mockClear();
    runUpdateChain.inStatus.mockClear();
    runUpdateChain.eqStartedAt.mockClear();
    runUpdateChain.select.mockClear();
    runUpdateChain.maybeSingle.mockReset();
    runUpdateChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("does not overwrite a completed crawl when marking failed", async () => {
    const updated = await markCrawlRunFailed("run-1", "late worker failure");

    expect(updated).toBe(false);
    expect(runUpdateChain.inStatus).toHaveBeenCalledWith("status", ["queued", "running"]);
  });

  it("ignores stale worker failures when started_at no longer matches", async () => {
    const updated = await markCrawlRunFailed("run-1", "late worker failure", {
      expectedStartedAt: "2026-09-10T15:00:00.000Z",
    });

    expect(updated).toBe(false);
    expect(runUpdateChain.eqStartedAt).toHaveBeenCalledWith(
      "started_at",
      "2026-09-10T15:00:00.000Z",
    );
  });

  it("completes only running rows with the expected started_at lease", async () => {
    runUpdateChain.maybeSingle.mockResolvedValueOnce({ data: { id: "run-1" }, error: null });

    const updated = await markCrawlRunCompleted("run-1", "website-1", {
      expectedStartedAt: "2026-09-10T15:00:00.000Z",
    });

    expect(updated).toBe(true);
    expect(runUpdateChain.eqStatus).toHaveBeenCalledWith("status", "running");
    expect(runUpdateChain.eqStartedAt).toHaveBeenCalledWith(
      "started_at",
      "2026-09-10T15:00:00.000Z",
    );
  });

  it("resets only processing queue items for the crawl run", async () => {
    const count = await resetAbandonedProcessingQueueItems("run-1");

    expect(count).toBe(1);
    expect(fromMock).toHaveBeenCalledWith("crawl_queue");
  });
});
