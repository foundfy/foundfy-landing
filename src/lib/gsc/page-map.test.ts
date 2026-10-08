import { describe, expect, it } from "vitest";
import { mapGscPageUrl, pageComparisonKey, type FoundfyPageRef } from "./page-map";

const pages: FoundfyPageRef[] = [
  {
    id: "page-home",
    requestedUrl: "https://www.foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    canonical: "https://www.foundfy.me/",
  },
  {
    id: "page-about",
    requestedUrl: "https://www.foundfy.me/about",
    finalUrl: "https://www.foundfy.me/about/",
    canonical: "https://www.foundfy.me/about",
  },
];

describe("GSC page URL mapping", () => {
  it("maps an exact Foundfy URL confidently", () => {
    expect(mapGscPageUrl("https://www.foundfy.me/", pages)).toBe("page-home");
  });

  it("treats www/apex and trailing slash as the same page", () => {
    expect(pageComparisonKey("http://foundfy.me/about/")).toBe(
      pageComparisonKey("https://www.foundfy.me/about"),
    );
    expect(mapGscPageUrl("http://foundfy.me/about/", pages)).toBe("page-about");
  });

  it("keeps unmatched GSC URLs with a null page id", () => {
    expect(mapGscPageUrl("https://www.foundfy.me/unseen-landing", pages)).toBeNull();
  });

  it("still joins GSC demand through a locale-home canonical", () => {
    const crawlPages: FoundfyPageRef[] = [
      {
        id: "page-es",
        requestedUrl: "https://www.dbhobby.com/es",
        finalUrl: "https://www.dbhobby.com/es",
        canonical: "https://www.dbhobby.com/es/pintura-en-seda",
      },
    ];

    expect(mapGscPageUrl("https://www.dbhobby.com/es/pintura-en-seda", crawlPages)).toBe("page-es");
  });
});
