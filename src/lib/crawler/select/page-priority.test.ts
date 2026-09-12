import { describe, expect, it } from "vitest";
import { MAX_PAGES_PER_CRAWL } from "../types";
import {
  classifyPagePath,
  scorePageUrl,
  selectRepresentativeUrls,
  selectSitemapEnqueueUrls,
} from "./page-priority";

describe("page selection scoring", () => {
  it("deprioritizes utility pages regardless of source", () => {
    const utilityUrls = [
      "https://example.com/login",
      "https://example.com/es/cuenta",
      "https://example.com/cart",
      "https://example.com/checkout",
      "https://example.com/privacy-policy",
      "https://example.com/gizlilik",
      "https://example.com/cookies",
      "https://example.com/search?q=silk",
      "https://example.com/tr/giris",
    ];

    for (const url of utilityUrls) {
      expect(classifyPagePath(url)).toBe("utility");
      expect(scorePageUrl(url, "sitemap")).toBeLessThan(
        scorePageUrl("https://example.com/about", "internal"),
      );
    }
  });

  it("prioritizes homepage, identity, and category pages", () => {
    const homepage = scorePageUrl("https://example.com/", "seed");
    const about = scorePageUrl("https://example.com/hakkimizda", "navigation");
    const nosotros = scorePageUrl("https://example.com/es/nosotros", "sitemap");
    const services = scorePageUrl("https://example.com/hizmetler", "navigation");
    const article = scorePageUrl("https://example.com/blog/2021/old-story", "sitemap");
    const login = scorePageUrl("https://example.com/login", "navigation");

    expect(homepage).toBe(100);
    expect(about).toBeGreaterThan(nosotros);
    expect(nosotros).toBeGreaterThan(services);
    expect(services).toBeGreaterThan(article);
    expect(article).toBeGreaterThan(login);
    expect(
      scorePageUrl("https://example.com/ca/la-seda", "navigation"),
    ).toBeGreaterThan(article);
    expect(MAX_PAGES_PER_CRAWL).toBe(10);
  });

  it("selects a representative mix across discovered locales", () => {
    const selected = selectRepresentativeUrls(
      [
        { url: "https://example.com/", source: "seed" },
        { url: "https://example.com/ca", source: "navigation" },
        { url: "https://example.com/es", source: "navigation" },
        { url: "https://example.com/en", source: "navigation" },
        { url: "https://example.com/ca/sobre-nosaltres", source: "navigation" },
        { url: "https://example.com/es/nosotros", source: "sitemap" },
        { url: "https://example.com/ca/botiga", source: "sitemap" },
        { url: "https://example.com/ca/2021/old-one", source: "sitemap" },
        { url: "https://example.com/ca/2021/old-two", source: "sitemap" },
        { url: "https://example.com/ca/2022/old-three", source: "sitemap" },
        { url: "https://example.com/ca/2022/old-four", source: "sitemap" },
        { url: "https://example.com/ca/2023/old-five", source: "sitemap" },
        { url: "https://example.com/login", source: "navigation" },
        { url: "https://example.com/cart", source: "navigation" },
      ],
      MAX_PAGES_PER_CRAWL,
    );

    expect(selected).toHaveLength(10);
    expect(selected.some((url) => url.endsWith("/ca") || url.includes("/ca/"))).toBe(true);
    expect(selected.some((url) => url.endsWith("/es") || url.includes("/es/"))).toBe(true);
    expect(selected.some((url) => url.endsWith("/en"))).toBe(true);
    expect(selected.some((url) => url.includes("nosotros") || url.includes("sobre-nosaltres"))).toBe(
      true,
    );
    expect(selected).not.toContain("https://example.com/login");
    expect(selected).not.toContain("https://example.com/cart");
    expect(selected.filter((url) => /\/20\d{2}\//.test(url)).length).toBeLessThanOrEqual(4);
  });

  it("enqueues the best sitemap URLs instead of document order", () => {
    const sitemapUrls = [
      "https://example.com/login",
      "https://example.com/cart",
      ...Array.from({ length: 30 }, (_, index) => `https://example.com/blog/2020/post-${index}`),
      "https://example.com/hakkimizda",
      "https://example.com/hizmetler",
    ];

    const enqueued = selectSitemapEnqueueUrls(sitemapUrls);

    expect(enqueued).toHaveLength(25);
    expect(enqueued.map((item) => item.url)).toContain("https://example.com/hakkimizda");
    expect(enqueued.map((item) => item.url)).toContain("https://example.com/hizmetler");
    expect(enqueued.map((item) => item.url)).not.toContain("https://example.com/login");
    expect(enqueued.map((item) => item.url)).not.toContain("https://example.com/cart");
    expect(enqueued[0]?.priority ?? 0).toBeGreaterThan(enqueued[24]?.priority ?? 0);
  });
});
