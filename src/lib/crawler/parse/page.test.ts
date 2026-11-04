import { describe, expect, it } from "vitest";
import { parseHtmlPage } from "./page";
import type { FetchResult } from "../types";

function buildFetchResult(body: string, overrides: Partial<FetchResult> = {}): FetchResult {
  return {
    requestedUrl: "https://foundfy.me/",
    finalUrl: "https://foundfy.me/",
    statusCode: 200,
    redirectChain: [],
    headers: {
      "content-type": "text/html",
      "x-robots-tag": "index, follow",
    },
    body,
    ...overrides,
  };
}

describe("parseHtmlPage", () => {
  it("extracts core SEO and content signals", () => {
    const html = `<!doctype html>
      <html lang="en">
        <head>
          <title>Foundfy</title>
          <meta name="description" content="Search visibility for startups" />
          <meta name="robots" content="index,follow" />
          <link rel="canonical" href="https://foundfy.me/" />
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Organization","name":"Foundfy"}
          </script>
        </head>
        <body>
          <h1>Understand visibility</h1>
          <h2>Why now</h2>
          <p>Foundfy helps founders improve search visibility with clarity.</p>
          <a href="/about">About</a>
          <a href="https://twitter.com/foundfy">Twitter</a>
          <img src="/logo.png" alt="Foundfy logo" />
          <img src="/hero.png" />
        </body>
      </html>`;

    const parsed = parseHtmlPage(buildFetchResult(html), "foundfy.me");

    expect(parsed.title).toBe("Foundfy");
    expect(parsed.metaDescription).toBe("Search visibility for startups");
    expect(parsed.canonical).toBe("https://foundfy.me/");
    expect(parsed.robotsMeta).toBe("index,follow");
    expect(parsed.xRobotsTag).toBe("index, follow");
    expect(parsed.h1).toEqual(["Understand visibility"]);
    expect(parsed.h2).toEqual(["Why now"]);
    expect(parsed.h3).toEqual([]);
    expect(parsed.htmlLang).toBe("en");
    expect(parsed.urlLocale).toBeNull();
    expect(parsed.navLabels).toEqual([]);
    expect(parsed.mainExcerpt).toContain("Foundfy helps founders");
    expect(parsed.mainExcerpt?.length).toBeLessThanOrEqual(1000);
    expect(parsed.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.internalLinks).toEqual([
      { url: "https://foundfy.me/about", anchorText: "About" },
    ]);
    expect(parsed.externalLinks).toEqual([
      { url: "https://twitter.com/foundfy", anchorText: "Twitter" },
    ]);
    expect(parsed.imageCount).toBe(2);
    expect(parsed.missingAltCount).toBe(1);
    expect(parsed.jsonLdTypes).toEqual(["Organization"]);
    expect(parsed.jsonLdProperties).toEqual([
      { type: "Organization", name: "Foundfy" },
    ]);
    expect(parsed.wordCount).toBeGreaterThan(5);
    expect(parsed.socialMetadata).toEqual({
      ogDescription: null,
      ogImage: null,
      ogImageAlt: null,
      ogImageType: null,
      ogImageWidth: null,
      ogImageHeight: null,
      twitterCard: null,
      twitterDescription: null,
      twitterImage: null,
      twitterImageAlt: null,
    });
  });

  it("keeps name=description independent from Open Graph and Twitter image tags", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>About</title>
          <meta name="description" content="About the director." />
          <meta property="og:description" content="About the director." />
          <meta property="og:image" content="https://example.com/opengraph-image.jpg" />
          <meta property="og:image:alt" content="Portrait" />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:description" content="About the director." />
          <meta name="twitter:image" content="https://example.com/opengraph-image.jpg" />
          <meta name="twitter:image:alt" content="Portrait" />
        </head>
        <body><h1>About</h1></body>
      </html>`;

    const parsed = parseHtmlPage(buildFetchResult(html), "foundfy.me");
    expect(parsed.metaDescription).toBe("About the director.");
    expect(parsed.socialMetadata?.ogDescription).toBe("About the director.");
    expect(parsed.socialMetadata?.ogImage).toBe("https://example.com/opengraph-image.jpg");
    expect(parsed.socialMetadata?.ogImageWidth).toBe("1200");
    expect(parsed.socialMetadata?.twitterImage).toBe("https://example.com/opengraph-image.jpg");
    expect(parsed.socialMetadata?.twitterCard).toBe("summary_large_image");
  });

  it("does not treat a missing twitter:image as the Open Graph image", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <meta name="description" content="About the director." />
          <meta property="og:description" content="About the director." />
          <meta property="og:image" content="https://example.com/opengraph-image.jpg" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:description" content="About the director." />
        </head>
        <body></body>
      </html>`;

    const parsed = parseHtmlPage(buildFetchResult(html), "foundfy.me");
    expect(parsed.socialMetadata?.ogImage).toBe("https://example.com/opengraph-image.jpg");
    expect(parsed.socialMetadata?.twitterImage).toBeNull();
  });

  it("still falls back to og:description for stored metaDescription when name=description is absent", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <meta property="og:description" content="OG only." />
        </head>
        <body></body>
      </html>`;

    const parsed = parseHtmlPage(buildFetchResult(html), "foundfy.me");
    expect(parsed.metaDescription).toBe("OG only.");
    expect(parsed.socialMetadata?.ogDescription).toBe("OG only.");
  });
});
