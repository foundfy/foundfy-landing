import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OBSERVE_STALE_RUNNING_MS } from "@/lib/observe/types";
import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_RESPONSE_BYTES } from "../types";
import {
  PREFETCH_REQUIRED_REMAINING_BUDGET_MS,
  PREFETCH_STALE_SAFETY_MARGIN_MS,
  remainingObserveLifecycleMs,
  SsrfValidationError,
  targetedObserveFetch,
} from "./targeted-observe-fetch";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const mockedLookup = vi.mocked(lookup);

function mockPublicDns() {
  mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
}

function hangingHtmlResponse(): Response {
  return new Response(
    new ReadableStream({
      start() {
        // Headers exist; the body never completes.
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/html" },
    },
  );
}

function slowHtmlResponse(chunkDelayMs: number, chunks: number): Response {
  const encoder = new TextEncoder();
  let sent = 0;
  return new Response(
    new ReadableStream({
      async pull(controller) {
        if (sent >= chunks) {
          controller.close();
          return;
        }
        sent += 1;
        await new Promise((resolve) => {
          setTimeout(resolve, chunkDelayMs);
        });
        controller.enqueue(encoder.encode("<html>"));
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/html" },
    },
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function freshLifecycle() {
  return { startedAt: new Date().toISOString() };
}

function lifecycleWithRemaining(remainingMs: number, nowMs = Date.now()) {
  return {
    startedAt: new Date(nowMs + remainingMs - OBSERVE_STALE_RUNNING_MS).toISOString(),
  };
}

async function runUntil(work: () => Promise<unknown>, ms: number): Promise<unknown> {
  let captured: unknown;
  const pending = work().then(
    (value) => {
      captured = value;
      return value;
    },
    (error: unknown) => {
      captured = error;
    },
  );
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await pending;
  return captured;
}

async function runUntilHopTimeout(work: () => Promise<unknown>): Promise<unknown> {
  return runUntil(work, FETCH_TIMEOUT_MS);
}

describe("targetedObserveFetch", () => {
  it("rejects userinfo and non-standard ports before fetch", async () => {
    await expect(
      targetedObserveFetch("https://user:pass@example.com/page", "example.com", freshLifecycle()),
    ).rejects.toBeInstanceOf(SsrfValidationError);
    await expect(
      targetedObserveFetch("https://example.com:8080/page", "example.com", freshLifecycle()),
    ).rejects.toBeInstanceOf(SsrfValidationError);
  });

  it("rejects off-site redirects before following them", async () => {
    mockPublicDns();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://other.test/away" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "Redirect is not same-site." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects HTTPS to HTTP downgrade before the next fetch", async () => {
    mockPublicDns();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://example.com/final" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "HTTPS downgrade is not allowed." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks SSRF before fetch when DNS is private", async () => {
    mockedLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "Hostname resolves to a blocked address." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts a response whose headers return but whose body never completes", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(hangingHtmlResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await runUntilHopTimeout(() =>
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    );
    expect(result).toMatchObject({ message: "Request timed out." });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cannot keep a slow streamed body alive beyond the hop timeout", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(slowHtmlResponse(4_000, 8));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runUntilHopTimeout(() =>
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    );
    expect(result).toMatchObject({ message: "Request timed out." });
  });

  it("still enforces the 2 MiB streaming size limit", async () => {
    mockPublicDns();
    const oversized = new Uint8Array(MAX_RESPONSE_BYTES + 1);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(oversized, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "Response exceeds size limit." });
  });

  it("gives each redirect a fresh hop timeout instead of an already-expired timer", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 9_000);
        });
        return new Response(null, {
          status: 302,
          headers: { Location: "https://example.com/final" },
        });
      })
      .mockResolvedValueOnce(hangingHtmlResponse());
    vi.stubGlobal("fetch", fetchMock);

    let settled: unknown;
    const pending = targetedObserveFetch(
      "https://example.com/start",
      "example.com",
      freshLifecycle(),
    ).then(
      (value) => {
        settled = value;
        return value;
      },
      (error: unknown) => {
        settled = error;
      },
    );

    await vi.advanceTimersByTimeAsync(9_000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBeUndefined();

    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await pending;
    expect(settled).toMatchObject({ message: "Request timed out." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("completes a normal HTML body inside the hop timeout", async () => {
    mockPublicDns();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><title>ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await targetedObserveFetch(
      "https://example.com/start",
      "example.com",
      freshLifecycle(),
    );
    expect(result.body).toContain("ok");
    expect(result.statusCode).toBe(200);
    expect(result.finalUrl).toBe("https://example.com/start");
  });

  it("clears the hop timer on redirect, abort, size-limit, and thrown-error paths", async () => {
    mockPublicDns();
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "https://example.com/next" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "Redirect response missing Location header." });
    expect(vi.getTimerCount()).toBe(0);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(MAX_RESPONSE_BYTES + 1), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    ).rejects.toMatchObject({ message: "Response exceeds size limit." });
    expect(vi.getTimerCount()).toBe(0);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(hangingHtmlResponse());
    const aborted = await runUntilHopTimeout(() =>
      targetedObserveFetch("https://example.com/start", "example.com", freshLifecycle()),
    );
    expect(aborted).toMatchObject({ message: "Request timed out." });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the hop-bounded HTTP ceiling below stale-running recovery", () => {
    const maxHttpLifecycleMs = (MAX_REDIRECTS + 1) * FETCH_TIMEOUT_MS;
    expect(maxHttpLifecycleMs).toBe(60_000);
    expect(maxHttpLifecycleMs).toBeLessThan(OBSERVE_STALE_RUNNING_MS);
    expect(OBSERVE_STALE_RUNNING_MS - maxHttpLifecycleMs).toBeGreaterThanOrEqual(60_000);
  });

  it("does not fetch when DNS resolves after the stale boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const lifecycle = freshLifecycle();
    mockedLookup.mockImplementation(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, OBSERVE_STALE_RUNNING_MS + 1_000);
      });
      return [{ address: "93.184.216.34", family: 4 }] as never;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runUntil(
      () => targetedObserveFetch("https://example.com/start", "example.com", lifecycle),
      OBSERVE_STALE_RUNNING_MS + 1_000,
    );
    expect(result).toMatchObject({ message: "Request timed out." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start a hop with less than one full FETCH_TIMEOUT_MS of remaining budget", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch(
        "https://example.com/start",
        "example.com",
        lifecycleWithRemaining(FETCH_TIMEOUT_MS - 1),
      ),
    ).rejects.toMatchObject({ message: "Request timed out." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a hop when remaining lifecycle budget exceeds the required prefetch budget", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><title>ok</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const remaining = PREFETCH_REQUIRED_REMAINING_BUDGET_MS + 1;
    expect(remainingObserveLifecycleMs(lifecycleWithRemaining(remaining).startedAt)).toBe(
      remaining,
    );

    const result = await targetedObserveFetch(
      "https://example.com/start",
      "example.com",
      lifecycleWithRemaining(remaining),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.body).toContain("ok");
  });

  it("does not fetch a redirect hop whose DNS consumed the remaining lifecycle budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const lifecycle = freshLifecycle();
    mockedLookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, OBSERVE_STALE_RUNNING_MS - FETCH_TIMEOUT_MS);
        });
        return [{ address: "93.184.216.34", family: 4 }] as never;
      });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.com/final" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runUntil(
      () => targetedObserveFetch("https://example.com/start", "example.com", lifecycle),
      OBSERVE_STALE_RUNNING_MS - FETCH_TIMEOUT_MS,
    );
    expect(result).toMatchObject({ message: "Request timed out." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.com/start");
  });

  it("uses persisted observation startedAt, not a fresh local timer after delayed continuation", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const persistedStartedAt = new Date().toISOString();
    vi.setSystemTime(new Date("2026-10-21T12:02:10.000Z"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      targetedObserveFetch("https://example.com/start", "example.com", {
        startedAt: persistedStartedAt,
      }),
    ).rejects.toMatchObject({ message: "Request timed out." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Date.now() - Date.parse(persistedStartedAt)).toBe(130_000);
  });

  it("does not start a hop with exactly FETCH_TIMEOUT_MS remaining plus insufficient safety margin", async () => {
    mockPublicDns();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(PREFETCH_STALE_SAFETY_MARGIN_MS).toBeGreaterThan(0);
    expect(PREFETCH_REQUIRED_REMAINING_BUDGET_MS).toBe(
      FETCH_TIMEOUT_MS + PREFETCH_STALE_SAFETY_MARGIN_MS,
    );

    await expect(
      targetedObserveFetch(
        "https://example.com/start",
        "example.com",
        lifecycleWithRemaining(FETCH_TIMEOUT_MS),
      ),
    ).rejects.toMatchObject({ message: "Request timed out." });
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      targetedObserveFetch(
        "https://example.com/start",
        "example.com",
        lifecycleWithRemaining(PREFETCH_REQUIRED_REMAINING_BUDGET_MS),
      ),
    ).rejects.toMatchObject({ message: "Request timed out." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
