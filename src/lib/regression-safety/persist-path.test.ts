import { describe, expect, it } from "vitest";
import { parseHtmlPage } from "@/lib/crawler/parse/page";
import { serializeCollectedSocialMetadata } from "@/lib/crawler/social-metadata";
import type { CrawlRunSummary } from "@/lib/crawler/types";
import type { PersistedPageMetadataRow } from "@/lib/crawler/db/repository";
import type { StoredObservation } from "@/lib/observations/types";
import { formatOperatorRegressionReport } from "./display";
import { evaluatePersistedManualSeoRegression, type RegressionSafetyStores } from "./load";
import type { PersistedRegressionCheckInput } from "./types";

const WEBSITE = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const OTHER_WEBSITE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ABOUT = "https://selcukdemirci.me/about";
const HOST = "selcukdemirci.me";
const IMAGE = "https://selcukdemirci.me/opengraph-image.jpg";
const OLD_DESC =
  "Barcelona-based, originally from Istanbul. I work across film and design, directing music videos, commercials and branded films, alongside creative direction and visual identities.";
const NEW_DESC =
  "Selcuk Demirci is a Barcelona-based film director and creative director, originally from Istanbul, working across film and design.";

function aboutHtml(input: {
  description: string;
  images: boolean;
  htmlDescription?: string | null;
}): string {
  const htmlDescription =
    input.htmlDescription === undefined ? input.description : input.htmlDescription;
  const descriptionTag =
    htmlDescription == null ? "" : `<meta name="description" content="${htmlDescription}" />`;
  const imageTags = input.images
    ? `
          <meta property="og:image" content="${IMAGE}" />
          <meta property="og:image:alt" content="Portrait" />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:image" content="${IMAGE}" />
          <meta name="twitter:image:alt" content="Portrait" />`
    : "";

  return `<!doctype html>
    <html>
      <head>
        <title>About · Selcuk Demirci</title>
        ${descriptionTag}
        <meta property="og:description" content="${input.description}" />
        ${imageTags}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:description" content="${input.description}" />
        <link rel="canonical" href="${ABOUT}" />
      </head>
      <body><h1>About</h1></body>
    </html>`;
}

function completedRun(
  id: string,
  completedAt: string,
  websiteId = WEBSITE,
): CrawlRunSummary {
  return {
    id,
    websiteId,
    status: "completed",
    hostname: HOST,
    seedUrl: "https://selcukdemirci.me/",
    purpose: "site_sample",
    maxPages: 10,
    pagesCrawled: 1,
    pagesDiscovered: 1,
    errorMessage: null,
    startedAt: completedAt,
    completedAt,
    createdAt: completedAt,
  };
}

function insertParsedPage(
  pages: PersistedPageMetadataRow[],
  input: {
    crawlRunId: string;
    websiteId: string;
    html: string;
    url?: string;
  },
): PersistedPageMetadataRow {
  const url = input.url ?? ABOUT;
  const parsed = parseHtmlPage(
    {
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      headers: { "content-type": "text/html" },
      body: input.html,
    },
    HOST,
  );

  const existing = pages.find(
    (page) => page.crawlRunId === input.crawlRunId && page.requestedUrl === parsed.requestedUrl,
  );
  if (existing) {
    return existing;
  }

  const row: PersistedPageMetadataRow = {
    crawlRunId: input.crawlRunId,
    websiteId: input.websiteId,
    requestedUrl: parsed.requestedUrl,
    finalUrl: parsed.finalUrl,
    statusCode: parsed.statusCode,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    canonical: parsed.canonical,
    robotsMeta: parsed.robotsMeta,
    socialMetadata: serializeCollectedSocialMetadata(parsed),
  };
  pages.push(row);
  return row;
}

function createStores() {
  const runs = new Map<string, CrawlRunSummary>();
  const pages: PersistedPageMetadataRow[] = [];
  const observations = new Map<string, StoredObservation[]>();
  const stores: RegressionSafetyStores = {
    getCrawlRunSummary: async (crawlRunId) => runs.get(crawlRunId) ?? null,
    listPageMetadataForCrawlRun: async (crawlRunId) =>
      pages.filter((page) => page.crawlRunId === crawlRunId),
    listObservations: async (crawlRunId) => observations.get(crawlRunId) ?? [],
  };
  return { runs, pages, observations, stores };
}

function spec(
  overrides: Partial<PersistedRegressionCheckInput> = {},
): PersistedRegressionCheckInput {
  return {
    websiteId: WEBSITE,
    baselineCrawlId: "baseline-1",
    verificationCrawlId: "verify-1",
    urls: [ABOUT],
    expectedChanges: [{ url: ABOUT, field: "meta_description", after: NEW_DESC }],
    preserveFields: ["title", "canonical", "og_image", "twitter_image"],
    ...overrides,
  };
}

describe("persisted regression-safety evidence path", () => {
  it("FAIL when newly collected social images are present in baseline and absent after publication", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-1", completedRun("verify-1", "2026-11-04T11:00:00.000Z"));
    insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    insertParsedPage(pages, {
      crawlRunId: "verify-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: false }),
    });

    const report = await evaluatePersistedManualSeoRegression(spec(), stores);
    expect(pages.find((page) => page.crawlRunId === "baseline-1")?.socialMetadata).toMatchObject({
      og_image: IMAGE,
      twitter_image: IMAGE,
    });
    expect(pages.find((page) => page.crawlRunId === "verify-1")?.socialMetadata).toMatchObject({
      og_image: null,
      twitter_image: null,
    });
    expect(report.verdict).toBe("fail");
    expect(
      report.checks.some(
        (check) => check.field === "og_image" && check.outcome === "removed" && check.result === "fail",
      ),
    ).toBe(true);
    expect(
      report.checks.some(
        (check) =>
          check.field === "twitter_image" && check.outcome === "removed" && check.result === "fail",
      ),
    ).toBe(true);
    expect(formatOperatorRegressionReport(report)).toMatch(/owner published/i);
    expect(formatOperatorRegressionReport(report)).not.toMatch(/Foundfy published this change/i);
  });

  it("PASS when a later verification crawl restores previously observed social images", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-restored", completedRun("verify-restored", "2026-11-04T12:00:00.000Z"));
    insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    insertParsedPage(pages, {
      crawlRunId: "verify-restored",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: true }),
    });

    const report = await evaluatePersistedManualSeoRegression(
      spec({ verificationCrawlId: "verify-restored" }),
      stores,
    );
    expect(report.verdict).toBe("pass");
    expect(
      report.checks.filter((check) => check.field === "og_image" || check.field === "twitter_image"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "og_image", outcome: "unchanged", result: "pass" }),
        expect.objectContaining({ field: "twitter_image", outcome: "unchanged", result: "pass" }),
      ]),
    );
    expect(report.limitations.join(" ")).toMatch(/does not mean a social platform rendered a preview/i);
  });

  it("NOT VERIFIED when historical pages have no collected social_metadata", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-1", completedRun("verify-1", "2026-11-04T11:00:00.000Z"));
    const historical = insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    historical.socialMetadata = null;
    insertParsedPage(pages, {
      crawlRunId: "verify-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: true }),
    });

    const report = await evaluatePersistedManualSeoRegression(spec(), stores);
    expect(report.verdict).toBe("not_verified");
    expect(
      report.checks.some(
        (check) => check.field === "og_image" && check.result === "not_verified" && check.outcome === "unknown",
      ),
    ).toBe(true);
    expect(formatOperatorRegressionReport(report)).toMatch(/NOT VERIFIED/);
  });

  it("does not treat an OG description fallback as an observed HTML meta description", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-1", completedRun("verify-1", "2026-11-04T11:00:00.000Z"));
    const baseline = insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true, htmlDescription: null }),
    });
    insertParsedPage(pages, {
      crawlRunId: "verify-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: true }),
    });

    expect(baseline.metaDescription).toBe(OLD_DESC);
    expect(baseline.socialMetadata).toMatchObject({
      html_meta_description: null,
      og_description: OLD_DESC,
    });

    const report = await evaluatePersistedManualSeoRegression(spec(), stores);
    expect(
      report.checks.some(
        (check) =>
          check.field === "meta_description" &&
          check.role === "expected_change" &&
          check.before.presence === "absent",
      ),
    ).toBe(true);
  });

  it("keeps baseline page rows unchanged when a later crawl inserts the same URL", async () => {
    const { pages } = createStores();
    const baseline = insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    const before = structuredClone(baseline);
    insertParsedPage(pages, {
      crawlRunId: "verify-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: false }),
    });
    const retry = insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: false }),
    });

    expect(retry).toBe(baseline);
    expect(baseline).toEqual(before);
    expect(pages.filter((page) => page.crawlRunId === "baseline-1")).toHaveLength(1);
    expect(pages.filter((page) => page.crawlRunId === "verify-1")).toHaveLength(1);
  });

  it("NOT VERIFIED when another requested URL has no persisted page in the compared crawls", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-restored", completedRun("verify-restored", "2026-11-04T12:00:00.000Z"));
    insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    insertParsedPage(pages, {
      crawlRunId: "verify-restored",
      websiteId: WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: true }),
    });

    const report = await evaluatePersistedManualSeoRegression(
      spec({
        verificationCrawlId: "verify-restored",
        urls: [ABOUT, "https://selcukdemirci.me/work"],
      }),
      stores,
    );
    expect(report.checks.some((check) => check.result === "fail")).toBe(false);
    expect(report.verdict).toBe("not_verified");
    expect(formatOperatorRegressionReport(report)).toMatch(/NOT VERIFIED/);
  });

  it("does not compare crawls from another website", async () => {
    const { runs, pages, stores } = createStores();
    runs.set("baseline-1", completedRun("baseline-1", "2026-11-04T10:00:00.000Z"));
    runs.set("verify-1", completedRun("verify-1", "2026-11-04T11:00:00.000Z", OTHER_WEBSITE));
    insertParsedPage(pages, {
      crawlRunId: "baseline-1",
      websiteId: WEBSITE,
      html: aboutHtml({ description: OLD_DESC, images: true }),
    });
    insertParsedPage(pages, {
      crawlRunId: "verify-1",
      websiteId: OTHER_WEBSITE,
      html: aboutHtml({ description: NEW_DESC, images: true }),
    });

    const report = await evaluatePersistedManualSeoRegression(spec(), stores);
    expect(report.verdict).toBe("not_verified");
    expect(report.checks).toEqual([]);
    expect(report.summary).toMatch(/same website/i);
  });
});
