import { describe, expect, it } from "vitest";
import { FinalUrlDeduplicator } from "./final-url-dedup";

describe("FinalUrlDeduplicator", () => {
  it("treats www variant as duplicate after non-www redirects to www", () => {
    const dedup = new FinalUrlDeduplicator();

    dedup.registerCrawledPage({
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
    });

    expect(dedup.isDuplicateBeforeFetch("https://www.foundfy.me/")).toBe(true);
    expect(dedup.getCrawledFinalUrls()).toEqual(["https://www.foundfy.me/"]);
  });

  it("skips duplicate after fetch when redirect resolves to an already crawled final URL", () => {
    const dedup = new FinalUrlDeduplicator();

    dedup.registerCrawledPage({
      requestedUrl: "https://www.foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      redirectChain: [],
    });

    expect(dedup.isDuplicateBeforeFetch("https://foundfy.me/")).toBe(false);
    expect(
      dedup.isDuplicateAfterFetch("https://foundfy.me/", "https://www.foundfy.me/"),
    ).toBe(true);
  });

  it("keeps different paths on the same site as separate final URLs", () => {
    const dedup = new FinalUrlDeduplicator();

    dedup.registerCrawledPage({
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
    });

    expect(dedup.isDuplicateBeforeFetch("https://www.foundfy.me/about")).toBe(false);
    expect(
      dedup.isDuplicateAfterFetch(
        "https://foundfy.me/about",
        "https://www.foundfy.me/about",
      ),
    ).toBe(false);
  });

  it("records redirect hops as aliases of the same final URL", () => {
    const dedup = new FinalUrlDeduplicator();

    dedup.registerCrawledPage({
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
    });

    expect(dedup.isDuplicateBeforeFetch("https://foundfy.me/")).toBe(true);
  });
});
