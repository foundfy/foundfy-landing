import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeCollectedSocialMetadata } from "../social-metadata";
import {
  PAGE_REGRESSION_EVIDENCE_SELECT,
  listPageMetadataForCrawlRun,
  saveParsedPage,
} from "./repository";

const parsedPage = {
  requestedUrl: "https://selcukdemirci.me/about",
  finalUrl: "https://selcukdemirci.me/about",
  statusCode: 200,
  redirectChain: [],
  title: "About",
  metaDescription: "About the director.",
  htmlMetaDescription: "About the director.",
  canonical: "https://selcukdemirci.me/about",
  robotsMeta: null,
  xRobotsTag: null,
  h1: [],
  h2: [],
  h3: [],
  htmlLang: "en",
  urlLocale: null,
  navLabels: [],
  navigationUrls: [],
  mainExcerpt: null,
  contentHash: "a".repeat(64),
  internalLinks: [],
  externalLinks: [],
  imageCount: 0,
  missingAltCount: 0,
  jsonLdTypes: [],
  jsonLdProperties: [],
  wordCount: 10,
  socialMetadata: {
    ogDescription: "About the director.",
    ogImage: "https://selcukdemirci.me/opengraph-image.jpg",
    ogImageAlt: "Portrait",
    ogImageType: "image/jpeg",
    ogImageWidth: "1200",
    ogImageHeight: "630",
    twitterCard: "summary_large_image",
    twitterDescription: "About the director.",
    twitterImage: "https://selcukdemirci.me/opengraph-image.jpg",
    twitterImageAlt: "Portrait",
  },
};

let insertPayload: Record<string, unknown> | null = null;
const insertSingleMock = vi.fn();
const listEqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

describe("page social metadata persistence", () => {
  beforeEach(() => {
    insertPayload = null;
    insertSingleMock.mockReset();
    listEqMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      if (table !== "pages") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert: (payload: Record<string, unknown>) => {
          insertPayload = payload;
          return {
            select: () => ({
              single: insertSingleMock,
            }),
          };
        },
        select: (columns: string) => ({
          eq: (column: string, value: string) => {
            listEqMock({ columns, column, value });
            return Promise.resolve({
              data: [
                {
                  crawl_run_id: "baseline-1",
                  website_id: "website-1",
                  requested_url: parsedPage.requestedUrl,
                  final_url: parsedPage.finalUrl,
                  status_code: 200,
                  title: parsedPage.title,
                  meta_description: parsedPage.metaDescription,
                  canonical: parsedPage.canonical,
                  robots_meta: null,
                  social_metadata: serializeCollectedSocialMetadata(parsedPage),
                },
                {
                  crawl_run_id: "historical-1",
                  website_id: "website-1",
                  requested_url: parsedPage.requestedUrl,
                  final_url: parsedPage.finalUrl,
                  status_code: 200,
                  title: parsedPage.title,
                  meta_description: parsedPage.metaDescription,
                  canonical: parsedPage.canonical,
                  robots_meta: null,
                  social_metadata: null,
                },
              ],
              error: null,
            });
          },
        }),
      };
    });
  });

  it("inserts collected social metadata on a new page row without updating existing rows", async () => {
    insertSingleMock.mockResolvedValueOnce({ data: { id: "page-1" }, error: null });

    await expect(
      saveParsedPage({
        crawlRunId: "baseline-1",
        websiteId: "website-1",
        parsed: parsedPage,
      }),
    ).resolves.toBe("page-1");

    expect(insertPayload).toMatchObject({
      crawl_run_id: "baseline-1",
      website_id: "website-1",
      requested_url: parsedPage.requestedUrl,
      meta_description: "About the director.",
      social_metadata: {
        html_meta_description: "About the director.",
        og_image: "https://selcukdemirci.me/opengraph-image.jpg",
        twitter_image: "https://selcukdemirci.me/opengraph-image.jpg",
        og_image_width: "1200",
        twitter_card: "summary_large_image",
      },
    });
    expect(fromMock.mock.calls.some((call) => call[0] === "pages")).toBe(true);
    expect(JSON.stringify(insertPayload)).not.toMatch(/"update"/);
  });

  it("loads null social_metadata as not collected and objects as collected", async () => {
    const rows = await listPageMetadataForCrawlRun("baseline-1");
    expect(listEqMock).toHaveBeenCalledWith({
      columns: PAGE_REGRESSION_EVIDENCE_SELECT,
      column: "crawl_run_id",
      value: "baseline-1",
    });
    expect(rows[0]?.socialMetadata).toMatchObject({
      og_image: "https://selcukdemirci.me/opengraph-image.jpg",
    });
    expect(rows[1]?.socialMetadata).toBeNull();
  });
});
