import { afterEach, describe, expect, it, vi } from "vitest";
import { SEARCH_ANALYTICS_CAPS } from "./config";
import {
  fetchBoundedSearchAnalytics,
  parseSearchAnalyticsRows,
  querySearchAnalytics,
} from "./search-analytics";
import { GoogleAuthExpiredError, GoogleSearchAnalyticsError } from "./types";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllGlobals();
});

describe("Google Search Analytics query", () => {
  it("parses official row metrics and an empty response", () => {
    expect(parseSearchAnalyticsRows({})).toEqual([]);
    expect(
      parseSearchAnalyticsRows({
        rows: [
          {
            keys: ["https://www.foundfy.me/"],
            clicks: 9,
            impressions: 430,
            ctr: 0.02093,
            position: 8.4,
          },
        ],
      }),
    ).toEqual([
      {
        keys: ["https://www.foundfy.me/"],
        clicks: 9,
        impressions: 430,
        ctr: 0.02093,
        position: 8.4,
      },
    ]);
  });

  it("computes CTR when Google omitted it", () => {
    expect(
      parseSearchAnalyticsRows({
        rows: [{ keys: ["foundfy"], clicks: 2, impressions: 10, position: 4 }],
      })[0]?.ctr,
    ).toBe(0.2);
  });

  it("queries the official Search Analytics endpoint with the stored property URI", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        rows: [{ clicks: 36, impressions: 1240, ctr: 0.029, position: 12.1 }],
        responseAggregationType: "byProperty",
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await querySearchAnalytics({
      accessToken: "access-token",
      propertyUri: "sc-domain:foundfy.me",
      startDate: "2026-08-28",
      endDate: "2026-09-24",
      rowLimit: 1,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Afoundfy.me/searchAnalytics/query",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      startDate: "2026-08-28",
      endDate: "2026-09-24",
      type: "web",
      rowLimit: 1,
    });
    expect(result.rows[0]?.impressions).toBe(1240);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/refresh/i);
  });

  it("marks a dataset truncated when the Foundfy cap is reached", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        rows: Array.from({ length: SEARCH_ANALYTICS_CAPS.page }, (_, index) => ({
          keys: [`https://www.foundfy.me/p${index}`],
          clicks: 1,
          impressions: 10,
          ctr: 0.1,
          position: 5,
        })),
      }),
    }) as typeof fetch;

    const result = await fetchBoundedSearchAnalytics({
      accessToken: "access-token",
      propertyUri: "sc-domain:foundfy.me",
      startDate: "2026-08-28",
      endDate: "2026-09-24",
      dimensions: ["page"],
      cap: SEARCH_ANALYTICS_CAPS.page,
    });

    expect(result.rows).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it("paginates until the cap or a short page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          rows: [
            { keys: ["a"], clicks: 2, impressions: 10, ctr: 0.2, position: 3 },
            { keys: ["b"], clicks: 1, impressions: 8, ctr: 0.125, position: 4 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ rows: [] }),
      });
    global.fetch = fetchMock as typeof fetch;

    const result = await fetchBoundedSearchAnalytics({
      accessToken: "access-token",
      propertyUri: "sc-domain:foundfy.me",
      startDate: "2026-08-28",
      endDate: "2026-09-24",
      dimensions: ["query"],
      cap: 5,
      pageSize: 2,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).startRow).toBe(2);
  });

  it("maps expired Google access without returning tokens", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }) as typeof fetch;

    await expect(
      querySearchAnalytics({
        accessToken: "stale",
        propertyUri: "sc-domain:foundfy.me",
        startDate: "2026-08-28",
        endDate: "2026-09-24",
        rowLimit: 1,
      }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);
  });

  it("maps quota errors to a safe refresh failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }) as typeof fetch;

    await expect(
      querySearchAnalytics({
        accessToken: "access-token",
        propertyUri: "sc-domain:foundfy.me",
        startDate: "2026-08-28",
        endDate: "2026-09-24",
        rowLimit: 1,
      }),
    ).rejects.toMatchObject({ code: "quota" } satisfies Partial<GoogleSearchAnalyticsError>);
  });
});
