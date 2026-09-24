import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_PAGES_PER_CRAWL } from "../types";
import {
  rankDiscoveredUrls,
  scorePageUrl,
  selectRepresentativeUrls,
  selectSitemapEnqueueUrls,
  type DiscoverySource,
} from "./page-priority";
import {
  GSC_QUEUE_PRIORITY,
  GSC_RESERVE_SLOTS,
  STRUCTURAL_RESERVE_SLOTS,
  UNSELECTED_QUEUE_PRIORITY,
  assignGscInformedQueuePriorities,
  gscDemandScore,
  gscDedupeKey,
  selectGscInformedCrawlUrls,
  type CrawlCandidate,
  type GscVisibilityPage,
} from "./gsc-informed-selection";

const DBHOBBY_SEED = "https://dbhobby.com/";

const dbhobbyCandidates: CrawlCandidate[] = [
  { url: DBHOBBY_SEED, source: "seed" },
  { url: "https://www.dbhobby.com/es", source: "navigation" },
  { url: "https://www.dbhobby.com/ca", source: "navigation" },
  { url: "https://www.dbhobby.com/en", source: "navigation" },
  { url: "https://www.dbhobby.com/es/pintura-en-seda", source: "navigation" },
  { url: "https://www.dbhobby.com/ca/pintura-en-seda", source: "navigation" },
  { url: "https://www.dbhobby.com/es/gutta-para-seda", source: "navigation" },
  { url: "https://www.dbhobby.com/es/nosotros", source: "sitemap" },
  { url: "https://www.dbhobby.com/ca/botiga", source: "sitemap" },
  { url: "https://www.dbhobby.com/login", source: "navigation" },
  { url: "https://www.dbhobby.com/cart", source: "navigation" },
  { url: "https://www.dbhobby.com/privacy", source: "sitemap" },
  ...Array.from({ length: 12 }, (_, index) => ({
    url: `https://www.dbhobby.com/es/arasilk-pintura-seda/color-${index}`,
    source: "sitemap" as const,
  })),
];

const dbhobbyGsc: GscVisibilityPage[] = [
  { url: "https://www.dbhobby.com/es/pintura-en-seda", impressions: 153, clicks: 26 },
  { url: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo", impressions: 133, clicks: 1 },
  { url: "https://dbhobby.com/es/gutta-para-seda", impressions: 96, clicks: 3 },
  { url: "https://dbhobby.com/", impressions: 69, clicks: 16 },
  { url: "https://www.dbhobby.com/ca/pintura-en-seda", impressions: 45, clicks: 5 },
  { url: "http://www.dbhobby.com/", impressions: 48, clicks: 3 },
];

const foundfyCandidates: CrawlCandidate[] = [
  { url: "https://foundfy.me/", source: "seed" },
  { url: "https://foundfy.me/privacy", source: "sitemap" },
];

function urlsOf(selected: ReturnType<typeof selectGscInformedCrawlUrls>): string[] {
  return selected.map((item) => item.url);
}

function asDiscovery(candidates: CrawlCandidate[]): Array<{ url: string; source: DiscoverySource }> {
  return candidates.map((candidate) => ({
    url: candidate.url,
    source: candidate.source === "verification" ? "navigation" : candidate.source,
  }));
}

describe("GSC-informed bounded crawl selection", () => {
  it("keeps existing crawl selection when GSC evidence is absent", () => {
    const baseline = selectRepresentativeUrls(asDiscovery(dbhobbyCandidates), MAX_PAGES_PER_CRAWL);
    const selected = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: [],
      hostname: "dbhobby.com",
    });

    expect(urlsOf(selected)).toEqual(baseline);
    expect(selected).toHaveLength(10);
    expect(MAX_PAGES_PER_CRAWL).toBe(10);
  });

  it("keeps foundfy.me structurally driven when GSC data is empty", () => {
    const baseline = selectRepresentativeUrls(asDiscovery(foundfyCandidates), MAX_PAGES_PER_CRAWL);
    const selected = selectGscInformedCrawlUrls({
      seedUrl: "https://foundfy.me/",
      candidates: foundfyCandidates,
      gscPages: [{ url: "https://foundfy.me/", impressions: 0, clicks: 0 }],
      hostname: "foundfy.me",
    });

    expect(urlsOf(selected)).toEqual(baseline);
    expect(selected[0]?.url).toBe("https://foundfy.me/");
    expect(selected.some((item) => item.reason === "gsc_visibility")).toBe(false);
  });

  it("lets a structurally undiscovered high-demand GSC page enter the candidate set", () => {
    const selected = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: dbhobbyGsc,
      hostname: "dbhobby.com",
    });
    const cianotipo = selected.find((item) => item.url.includes("set-de-cianotipo"));

    expect(dbhobbyCandidates.some((item) => item.url.includes("set-de-cianotipo"))).toBe(false);
    expect(cianotipo?.url).toBe("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo");
    expect(cianotipo?.source).toBe("gsc_visibility");
    expect(cianotipo?.reason).toBe("gsc_visibility");
  });

  it("lets a high relative-demand GSC page compete for the 10-page budget", () => {
    const selected = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: dbhobbyGsc,
      hostname: "dbhobby.com",
    });

    expect(selected).toHaveLength(10);
    expect(urlsOf(selected).some((url) => url.includes("set-de-cianotipo"))).toBe(true);
    expect(urlsOf(selected).some((url) => url.includes("gutta-para-seda"))).toBe(true);
    expect(gscDemandScore(dbhobbyGsc[1]!, 153)).toBeGreaterThan(gscDemandScore(dbhobbyGsc[2]!, 153));
  });

  it("gives click-bearing pages a stronger GSC signal than impression-only peers", () => {
    const ranked = selectGscInformedCrawlUrls({
      seedUrl: "https://example.com/",
      candidates: [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/about", source: "navigation" },
        { url: "https://example.com/es", source: "navigation" },
      ],
      gscPages: [
        { url: "https://example.com/a", impressions: 100, clicks: 0 },
        { url: "https://example.com/b", impressions: 100, clicks: 4 },
        { url: "https://example.com/c", impressions: 20, clicks: 1 },
      ],
      hostname: "example.com",
    });
    const gscSelected = ranked.filter((item) => item.reason === "gsc_visibility").map((item) => item.url);

    expect(gscSelected[0]).toBe("https://example.com/b");
    expect(gscDemandScore({ impressions: 100, clicks: 4 }, 100)).toBeGreaterThan(
      gscDemandScore({ impressions: 100, clicks: 0 }, 100),
    );
  });

  it("does not let GSC consume all 10 slots", () => {
    const gscPages = Array.from({ length: 20 }, (_, index) => ({
      url: `https://example.com/product-${index}`,
      impressions: 200 - index,
      clicks: 1,
    }));
    const selected = selectGscInformedCrawlUrls({
      seedUrl: "https://example.com/",
      candidates: [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/about", source: "navigation" },
        { url: "https://example.com/es", source: "navigation" },
        { url: "https://example.com/ca", source: "navigation" },
        { url: "https://example.com/services", source: "navigation" },
        { url: "https://example.com/contact", source: "navigation" },
        { url: "https://example.com/shop", source: "navigation" },
        ...gscPages.map((page) => ({ url: page.url, source: "sitemap" as const })),
      ],
      gscPages,
      hostname: "example.com",
    });
    const gscCount = selected.filter((item) => item.reason === "gsc_visibility").length;

    expect(selected).toHaveLength(10);
    expect(gscCount).toBe(GSC_RESERVE_SLOTS);
    expect(gscCount).toBeLessThan(10);
    expect(selected.some((item) => item.reason === "seed" || item.url === "https://example.com/")).toBe(true);
    expect(selected.some((item) => item.reason === "identity")).toBe(true);
    expect(selected.some((item) => item.reason === "locale_home")).toBe(true);
  });

  it("preserves homepage/seed, identity, and locale coverage", () => {
    const selected = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: dbhobbyGsc,
      hostname: "dbhobby.com",
    });

    expect(selected[0]?.reason).toBe("seed");
    expect(urlsOf(selected)).toContain(DBHOBBY_SEED);
    expect(selected.some((item) => item.reason === "identity")).toBe(true);
    expect(selected.filter((item) => item.reason === "locale_home").length).toBeGreaterThanOrEqual(1);
    expect(
      selected.filter((item) =>
        ["seed", "homepage", "identity", "locale_home", "category_service"].includes(item.reason),
      ).length,
    ).toBeGreaterThanOrEqual(STRUCTURAL_RESERVE_SLOTS - 1);
  });

  it("keeps utility pages penalized even when they appear in GSC", () => {
    const selected = selectGscInformedCrawlUrls({
      seedUrl: "https://example.com/",
      candidates: [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/about", source: "navigation" },
        { url: "https://example.com/login", source: "navigation" },
        { url: "https://example.com/cart", source: "navigation" },
      ],
      gscPages: [
        { url: "https://example.com/login", impressions: 400, clicks: 20 },
        { url: "https://example.com/cart", impressions: 300, clicks: 10 },
        { url: "https://example.com/hidden-product", impressions: 50, clicks: 2 },
      ],
      hostname: "example.com",
    });

    expect(urlsOf(selected)).not.toContain("https://example.com/login");
    expect(urlsOf(selected)).not.toContain("https://example.com/cart");
    expect(urlsOf(selected)).toContain("https://example.com/hidden-product");
  });

  it("dedupes www/apex and trailing-slash variants while keeping exact GSC provenance", () => {
    const selected = selectGscInformedCrawlUrls({
      seedUrl: "https://example.com/",
      candidates: [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/about", source: "navigation" },
        { url: "https://example.com/es/gutta-para-seda/", source: "navigation" },
      ],
      gscPages: [
        { url: "https://www.example.com/es/gutta-para-seda", impressions: 96, clicks: 3 },
        { url: "https://example.com/es/gutta-para-seda/", impressions: 40, clicks: 1 },
      ],
      hostname: "example.com",
    });
    const gutta = selected.filter((item) => item.url.includes("gutta-para-seda"));

    expect(gutta).toHaveLength(1);
    expect(gutta[0]?.url).toBe("https://www.example.com/es/gutta-para-seda");
    expect(gutta[0]?.reason).toBe("gsc_visibility");
    expect(gscDedupeKey("https://www.example.com/es/gutta-para-seda/")).toBe(
      gscDedupeKey("https://example.com/es/gutta-para-seda"),
    );
  });

  it("priority 88 cannot currently collide with a legitimate structural score", () => {
    const urls = [
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/es",
      "https://example.com/services",
      "https://example.com/blog/2020/post",
      "https://example.com/other-page",
      "https://example.com/login",
    ];
    const sources: DiscoverySource[] = ["navigation", "sitemap", "internal"];

    for (const url of urls) {
      for (const source of sources) {
        expect(scorePageUrl(url, source)).not.toBe(GSC_QUEUE_PRIORITY);
      }
    }

    const ranked = rankDiscoveredUrls(
      urls.flatMap((url) => sources.map((source) => ({ url, source }))),
    );
    const sitemapRanked = selectSitemapEnqueueUrls([
      "https://example.com/about",
      "https://example.com/es",
      "https://example.com/ca",
      "https://example.com/services",
      "https://example.com/shop",
      "https://example.com/blog/2020/post",
      "https://example.com/login",
    ]);

    expect(ranked.some((item) => item.priority === GSC_QUEUE_PRIORITY)).toBe(false);
    expect(sitemapRanked.some((item) => item.priority === GSC_QUEUE_PRIORITY)).toBe(false);
  });

  it("post-allocation priority 1 cannot outrank reserved structural or GSC slots", () => {
    const extraPosts = Array.from({ length: 12 }, (_, index) => ({
      url: `https://example.com/blog/2020/old-${index}`,
      source: "sitemap" as const,
    }));
    const unselectedUrl = "https://example.com/blog/2020/zzz-unselected";
    const selected = selectGscInformedCrawlUrls({
      seedUrl: "https://example.com/",
      candidates: [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/about", source: "navigation" },
        { url: unselectedUrl, source: "sitemap" },
        ...extraPosts,
      ],
      gscPages: [{ url: "https://example.com/visible", impressions: 80, clicks: 2 }],
      hostname: "example.com",
    });
    const updates = assignGscInformedQueuePriorities({
      items: [
        { id: "seed", url: "https://example.com/", status: "done", priority: 100 },
        { id: "gsc", url: "https://example.com/visible", status: "pending", priority: GSC_QUEUE_PRIORITY },
        { id: "zzz", url: unselectedUrl, status: "pending", priority: 53 },
        { id: "about", url: "https://example.com/about", status: "pending", priority: 99 },
      ],
      selected,
    });

    expect(urlsOf(selected)).not.toContain(unselectedUrl);
    expect(updates.find((item) => item.id === "zzz")?.priority).toBe(UNSELECTED_QUEUE_PRIORITY);
    expect(updates.find((item) => item.id === "about")?.priority ?? 99).toBeGreaterThan(
      UNSELECTED_QUEUE_PRIORITY,
    );
    expect(updates.find((item) => item.id === "gsc")?.priority ?? GSC_QUEUE_PRIORITY).toBeGreaterThan(
      UNSELECTED_QUEUE_PRIORITY,
    );
    expect(selected).toHaveLength(MAX_PAGES_PER_CRAWL);
    expect(urlsOf(selected)).toContain("https://example.com/visible");
  });

  it("DBHobby-like: Google-visible uncrawled pages compete for the 10-page budget", () => {
    const before = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      hostname: "dbhobby.com",
    });
    const after = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: dbhobbyGsc,
      hostname: "dbhobby.com",
    });

    expect(before).toHaveLength(10);
    expect(after).toHaveLength(10);
    expect(urlsOf(before)).not.toContain("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo");
    expect(urlsOf(after)).toContain("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo");
    expect(urlsOf(after).some((url) => url.includes("gutta-para-seda"))).toBe(true);
    expect(after.filter((item) => item.reason === "gsc_visibility").length).toBeLessThanOrEqual(GSC_RESERVE_SLOTS);
    expect(after.some((item) => item.reason === "seed")).toBe(true);
    expect(after).not.toContainEqual(expect.objectContaining({ url: "https://www.dbhobby.com/login" }));
  });

  it("does not import Decision Engine scoring or OpenAI", () => {
    const source = readFileSync(path.join(__dirname, "gsc-informed-selection.ts"), "utf8");
    const visibility = readFileSync(path.join(__dirname, "gsc-visibility.ts"), "utf8");
    const startCrawl = readFileSync(path.join(__dirname, "../start-crawl.ts"), "utf8");
    const processRun = readFileSync(path.join(__dirname, "../worker/process-run.ts"), "utf8");
    const decisionsCandidates = readFileSync(
      path.join(__dirname, "../../decisions/candidates.ts"),
      "utf8",
    );
    const decisionsScore = readFileSync(path.join(__dirname, "../../decisions/score.ts"), "utf8");

    for (const contents of [source, visibility, startCrawl, processRun]) {
      expect(contents).not.toMatch(/from \"@\/lib\/decisions/);
      expect(contents).not.toMatch(/openai|OpenAI/);
    }

    expect(decisionsCandidates).not.toMatch(/gsc-informed|GSC_QUEUE_PRIORITY|selectGscInformed/);
    expect(decisionsScore).not.toMatch(/gsc-informed|GSC_QUEUE_PRIORITY|selectGscInformed/);
  });

  it("simulation: exact selected 10 for DBHobby and foundfy.me", () => {
    const dbhobbyWithGsc = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      gscPages: dbhobbyGsc,
      hostname: "dbhobby.com",
    });
    const dbhobbyWithoutGsc = selectGscInformedCrawlUrls({
      seedUrl: DBHOBBY_SEED,
      candidates: dbhobbyCandidates,
      hostname: "dbhobby.com",
    });
    const foundfyEmptyGsc = selectGscInformedCrawlUrls({
      seedUrl: "https://foundfy.me/",
      candidates: foundfyCandidates,
      gscPages: [{ url: "https://foundfy.me/", impressions: 0, clicks: 0 }],
      hostname: "foundfy.me",
    });

    expect(dbhobbyWithGsc.map((item) => `${item.reason} ${item.source} ${item.url}`)).toMatchInlineSnapshot(`
      [
        "seed seed https://dbhobby.com/",
        "locale_home navigation https://www.dbhobby.com/ca",
        "locale_home navigation https://www.dbhobby.com/en",
        "locale_home navigation https://www.dbhobby.com/es",
        "identity sitemap https://www.dbhobby.com/es/nosotros",
        "gsc_visibility gsc_visibility https://www.dbhobby.com/es/pintura-en-seda",
        "gsc_visibility gsc_visibility https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        "gsc_visibility gsc_visibility https://dbhobby.com/es/gutta-para-seda",
        "sitemap sitemap https://www.dbhobby.com/es/arasilk-pintura-seda/color-0",
        "sitemap sitemap https://www.dbhobby.com/ca/botiga",
      ]
    `);
    expect(dbhobbyWithoutGsc.map((item) => `${item.reason} ${item.source} ${item.url}`)).toMatchInlineSnapshot(`
      [
        "seed seed https://dbhobby.com/",
        "locale_home navigation https://www.dbhobby.com/ca",
        "locale_home navigation https://www.dbhobby.com/en",
        "locale_home navigation https://www.dbhobby.com/es",
        "navigation navigation https://www.dbhobby.com/ca/pintura-en-seda",
        "identity sitemap https://www.dbhobby.com/es/nosotros",
        "sitemap sitemap https://www.dbhobby.com/ca/botiga",
        "navigation navigation https://www.dbhobby.com/es/gutta-para-seda",
        "navigation navigation https://www.dbhobby.com/es/pintura-en-seda",
        "sitemap sitemap https://www.dbhobby.com/es/arasilk-pintura-seda/color-0",
      ]
    `);
    expect(foundfyEmptyGsc.map((item) => `${item.reason} ${item.source} ${item.url}`)).toMatchInlineSnapshot(`
      [
        "seed seed https://foundfy.me/",
        "sitemap sitemap https://foundfy.me/privacy",
      ]
    `);
  });
});
