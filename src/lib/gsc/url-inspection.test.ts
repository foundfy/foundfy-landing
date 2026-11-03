import { afterEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_URL_INSPECTION_INSPECT_URL } from "./config";
import { GoogleAuthExpiredError, GoogleIndexingError } from "./types";
import { inspectUrlIndexStatus } from "./url-inspection";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe("URL Inspection API client", () => {
  it("POSTs a read-only inspect request for the authorized property URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        inspectionResult: {
          indexStatusResult: {
            verdict: "PASS",
            coverageState: "Submitted and indexed",
          },
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await inspectUrlIndexStatus({
      accessToken: "access-token",
      inspectionUrl: "https://selcukdemirci.me/",
      siteUrl: "sc-domain:selcukdemirci.me",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(GOOGLE_URL_INSPECTION_INSPECT_URL);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      cache: "no-store",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      inspectionUrl: "https://selcukdemirci.me/",
      siteUrl: "sc-domain:selcukdemirci.me",
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(
      /urlNotifications|publish|request indexing|notify/i,
    );
    expect(result.verdict).toBe("PASS");
  });

  it("L/M. maps 401/403 to expired access and 429/5xx to indexing errors", async () => {
    async function inspectWithStatus(status: number) {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => "discard",
      }) as typeof fetch;
      return inspectUrlIndexStatus({
        accessToken: "access-token",
        inspectionUrl: "https://selcukdemirci.me/",
        siteUrl: "sc-domain:selcukdemirci.me",
      });
    }

    await expect(inspectWithStatus(401)).rejects.toBeInstanceOf(GoogleAuthExpiredError);
    await expect(inspectWithStatus(403)).rejects.toBeInstanceOf(GoogleAuthExpiredError);
    await expect(inspectWithStatus(429)).rejects.toMatchObject({
      name: "GoogleIndexingError",
      code: "quota",
    });
    await expect(inspectWithStatus(503)).rejects.toBeInstanceOf(GoogleIndexingError);
  });
});
