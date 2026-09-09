import { describe, expect, it } from "vitest";
import { isSitemapIndex, parseSitemapXml } from "./sitemap";

describe("parseSitemapXml", () => {
  it("parses urlset entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://foundfy.me/</loc></url>
        <url><loc>https://foundfy.me/about</loc></url>
      </urlset>`;

    expect(parseSitemapXml(xml, "https://foundfy.me")).toEqual([
      "https://foundfy.me/",
      "https://foundfy.me/about",
    ]);
  });

  it("parses sitemap index entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://foundfy.me/sitemap-pages.xml</loc></sitemap>
      </sitemapindex>`;

    expect(parseSitemapXml(xml, "https://foundfy.me")).toEqual([
      "https://foundfy.me/sitemap-pages.xml",
    ]);
    expect(isSitemapIndex(xml)).toBe(true);
  });
});
