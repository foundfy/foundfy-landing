import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ssrfSafeFetch, SsrfValidationError } from "./ssrf-fetch";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const mockedLookup = vi.mocked(lookup);

function mockPublicDns() {
  mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ssrfSafeFetch", () => {
  it("blocks localhost before fetch", async () => {
    await expect(ssrfSafeFetch("http://localhost/")).rejects.toBeInstanceOf(
      SsrfValidationError,
    );
  });

  it("blocks hostnames resolving to private addresses", async () => {
    mockedLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);

    await expect(ssrfSafeFetch("https://example.com/")).rejects.toBeInstanceOf(
      SsrfValidationError,
    );
  });

  it("follows redirects only after re-validating the target", async () => {
    mockPublicDns();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html><title>Final</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ssrfSafeFetch("https://example.com/start");

    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.redirectChain).toEqual([
      { url: "https://example.com/start", statusCode: 302 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects redirects to blocked hosts", async () => {
    mockPublicDns();

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/private" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(ssrfSafeFetch("https://example.com/start")).rejects.toBeInstanceOf(
      SsrfValidationError,
    );
  });

  it("enforces redirect limits", async () => {
    mockPublicDns();

    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.redirect("https://example.com/next", 302),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(ssrfSafeFetch("https://example.com/start")).rejects.toThrow(
      "Too many redirects.",
    );
  });

  it("follows WordPress-style trailing-slash redirects without looping", async () => {
    mockPublicDns();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: {
            Location: "https://example.com/article/",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html><title>Article</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ssrfSafeFetch("https://example.com/article");

    expect(result.finalUrl).toBe("https://example.com/article/");
    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/article",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/article/",
      expect.any(Object),
    );
    expect(mockedLookup).toHaveBeenCalled();
  });

  it("follows relative redirects and re-validates each hop", async () => {
    mockPublicDns();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "/relative-final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ssrfSafeFetch("https://example.com/start");

    expect(result.finalUrl).toBe("https://example.com/relative-final");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockedLookup).toHaveBeenCalled();
  });

  it("follows apex to www redirects", async () => {
    mockPublicDns();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: "https://www.example.com/" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ssrfSafeFetch("https://example.com/");

    expect(result.finalUrl).toBe("https://www.example.com/");
    expect(result.redirectChain).toEqual([
      { url: "https://example.com/", statusCode: 301 },
    ]);
  });

  it("still rejects genuine redirect loops that never stabilize", async () => {
    mockPublicDns();

    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      Response.redirect(`${url}?hop=${Math.random()}`, 302),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ssrfSafeFetch("https://example.com/loop"),
    ).rejects.toThrow("Too many redirects.");
  });
});
