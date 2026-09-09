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
    expect(parsed.htmlLang).toBe("en");
    expect(parsed.internalLinks).toEqual([
      { url: "https://foundfy.me/about", anchorText: "About" },
    ]);
    expect(parsed.externalLinks).toEqual([
      { url: "https://twitter.com/foundfy", anchorText: "Twitter" },
    ]);
    expect(parsed.imageCount).toBe(2);
    expect(parsed.missingAltCount).toBe(1);
    expect(parsed.jsonLdTypes).toEqual(["Organization"]);
    expect(parsed.wordCount).toBeGreaterThan(5);
  });
});
