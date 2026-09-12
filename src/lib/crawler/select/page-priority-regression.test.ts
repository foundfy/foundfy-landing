import { describe, expect, it } from "vitest";
import { MAX_PAGES_PER_CRAWL } from "../types";
import {
  type DiscoverySource,
  selectRepresentativeUrls,
  selectSitemapEnqueueUrls,
} from "./page-priority";

function selectWithLegacyPriority(
  seedUrl: string,
  sitemapUrls: string[],
  internalUrls: string[],
  limit = MAX_PAGES_PER_CRAWL,
): string[] {
  const seen = new Set<string>();
  const queue: Array<{ url: string; priority: number; order: number }> = [];
  let order = 0;

  const add = (url: string, priority: number) => {
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    queue.push({ url, priority, order });
    order += 1;
  };

  add(seedUrl, 100);
  for (const url of sitemapUrls.slice(0, 25)) {
    add(url, 50);
  }
  for (const url of internalUrls) {
    add(url, 10);
  }

  return queue
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.order - right.order;
    })
    .slice(0, limit)
    .map((item) => item.url);
}

function selectWithNewPriority(
  items: Array<{ url: string; source: DiscoverySource }>,
): string[] {
  return selectRepresentativeUrls(items, MAX_PAGES_PER_CRAWL);
}

describe("regression site selection (simulated URL lists)", () => {
  it("DBHobby: identity/education beats login/cart within 10 pages", () => {
    const seed = "https://dbhobby.example/";
    const sitemapUrls = [
      `${seed}login`,
      `${seed}cart`,
      `${seed}checkout`,
      `${seed}privacy`,
      ...Array.from({ length: 40 }, (_, index) => `${seed}blog/2019/article-${index}`),
      `${seed}ca/la-seda`,
      `${seed}ca`,
      `${seed}es`,
      `${seed}en`,
      `${seed}es/nosotros`,
    ];
    const navUrls = [
      `${seed}ca`,
      `${seed}es`,
      `${seed}en`,
      `${seed}ca/la-seda`,
      `${seed}login`,
      `${seed}cart`,
      `${seed}privacy`,
    ];

    const oldSelection = selectWithLegacyPriority(seed, sitemapUrls, navUrls);
    const newSelection = selectWithNewPriority([
      { url: seed, source: "seed" },
      ...sitemapUrls.map((url) => ({ url, source: "sitemap" as const })),
      ...navUrls.map((url) => ({ url, source: "navigation" as const })),
    ]);

    expect(oldSelection).toContain(`${seed}login`);
    expect(oldSelection).not.toContain(`${seed}ca/la-seda`);

    expect(newSelection[0]).toBe(seed);
    expect(newSelection).toContain(`${seed}ca/la-seda`);
    expect(newSelection.some((url) => url.endsWith("/es/nosotros") || url.endsWith("/es"))).toBe(
      true,
    );
    expect(newSelection).not.toContain(`${seed}login`);
    expect(newSelection).not.toContain(`${seed}cart`);
    expect(newSelection).toHaveLength(10);
  });

  it("EkoIQ: /hakkimizda and /dergi beat a 10-page pile of old articles", () => {
    const seed = "https://ekoiq.example/";
    const sitemapUrls = [
      ...Array.from({ length: 30 }, (_, index) => `${seed}2020/0${(index % 9) + 1}/eski-yazi-${index}`),
      `${seed}hakkimizda`,
      `${seed}dergi`,
      `${seed}iletisim`,
    ];
    const navUrls = [`${seed}hakkimizda`, `${seed}dergi`, `${seed}iletisim`];

    const oldSelection = selectWithLegacyPriority(seed, sitemapUrls, navUrls);
    const newSelection = selectWithNewPriority([
      { url: seed, source: "seed" },
      ...sitemapUrls.map((url) => ({ url, source: "sitemap" as const })),
      ...navUrls.map((url) => ({ url, source: "navigation" as const })),
    ]);

    expect(oldSelection.filter((url) => url.includes("/2020/")).length).toBeGreaterThanOrEqual(8);
    expect(oldSelection).not.toContain(`${seed}hakkimizda`);

    expect(newSelection).toContain(`${seed}hakkimizda`);
    expect(newSelection).toContain(`${seed}dergi`);
    expect(newSelection).toContain(`${seed}iletisim`);
    expect(newSelection.filter((url) => url.includes("/2020/")).length).toBeLessThan(
      oldSelection.filter((url) => url.includes("/2020/")).length,
    );
  });

  it("Foundfy: homepage first; tiny sitemap still discovers privacy without crowding", () => {
    const seed = "https://foundfy.me/";
    const sitemapUrls = [seed, `${seed}privacy`];

    const oldSelection = selectWithLegacyPriority(seed, sitemapUrls, [`${seed}privacy`]);
    const newSelection = selectWithNewPriority([
      { url: seed, source: "seed" },
      { url: `${seed}privacy`, source: "sitemap" },
    ]);
    const sitemapEnqueue = selectSitemapEnqueueUrls(sitemapUrls);

    expect(oldSelection[0]).toBe(seed);
    expect(newSelection[0]).toBe(seed);
    expect(newSelection).toContain(`${seed}privacy`);
    expect(sitemapEnqueue.map((item) => item.url)).toContain(`${seed}privacy`);
    expect(MAX_PAGES_PER_CRAWL).toBe(10);
  });
});
