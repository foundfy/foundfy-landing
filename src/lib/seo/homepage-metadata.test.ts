import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as scanMetadata } from "@/app/scan/layout";
import { metadata as siteMetadata } from "@/app/site/layout";
import { parseHtmlPage } from "@/lib/crawler/parse/page";
import { PRIVACY_INTRO } from "@/lib/privacy/content";
import {
  HOMEPAGE_META_DESCRIPTION_TO_RESTORE,
  homepageMetadata,
} from "./homepage-metadata";

const layoutSource = readFileSync(
  path.join(__dirname, "../../app/layout.tsx"),
  "utf8",
);
const privacySource = readFileSync(
  path.join(__dirname, "../../app/privacy/page.tsx"),
  "utf8",
);
const homepageSource = readFileSync(
  path.join(__dirname, "../../app/page.tsx"),
  "utf8",
);

describe("temporary homepage missing-meta validation", () => {
  it("records the exact homepage description to restore", () => {
    expect(HOMEPAGE_META_DESCRIPTION_TO_RESTORE).toBe(
      "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.",
    );
    expect(layoutSource).toContain(
      `const siteDescription =\n  "${HOMEPAGE_META_DESCRIPTION_TO_RESTORE}";`,
    );
    expect(layoutSource).toContain("description: siteDescription");
    expect(layoutSource).toContain("title: siteTitle");
    expect(layoutSource).toContain('canonical: "/"');
  });

  it("unsets homepage name=description and og:description only", () => {
    expect(homepageSource).toContain("export const metadata = homepageMetadata");
    expect(homepageMetadata.description).toBeNull();
    expect(homepageMetadata.openGraph).toBeDefined();
    expect(homepageMetadata.openGraph).not.toHaveProperty("description");
    expect(homepageMetadata.openGraph).toMatchObject({
      title: "Foundfy | Be found wherever people search.",
      url: "/",
      siteName: "Foundfy",
      locale: "en_US",
      type: "website",
    });
    expect(homepageMetadata).not.toHaveProperty("title");
    expect(homepageMetadata).not.toHaveProperty("alternates");
    expect(homepageMetadata).not.toHaveProperty("robots");
    expect(homepageMetadata).not.toHaveProperty("twitter");
  });

  it("leaves privacy, scan, and site metadata on their existing descriptions", () => {
    expect(privacySource).toContain("description: PRIVACY_INTRO");
    expect(privacySource).toContain('title: "Privacy | Foundfy"');
    expect(privacySource).toContain('canonical: "/privacy"');
    expect(PRIVACY_INTRO.length).toBeGreaterThan(0);

    expect(scanMetadata).not.toHaveProperty("description");
    expect(siteMetadata).not.toHaveProperty("description");
    expect(scanMetadata.robots).toEqual({ index: false, follow: false });
    expect(siteMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("is treated as missing meta even if twitter:description remains", () => {
    const html = `<!doctype html>
      <html lang="en">
        <head>
          <title>Foundfy | Be found wherever people search.</title>
          <link rel="canonical" href="https://www.foundfy.me/" />
          <meta property="og:title" content="Foundfy | Be found wherever people search." />
          <meta name="twitter:description" content="${HOMEPAGE_META_DESCRIPTION_TO_RESTORE}" />
        </head>
        <body><h1>Foundfy</h1></body>
      </html>`;

    const parsed = parseHtmlPage(
      {
        requestedUrl: "https://foundfy.me/",
        finalUrl: "https://foundfy.me/",
        statusCode: 200,
        redirectChain: [],
        headers: { "content-type": "text/html" },
        body: html,
      },
      "foundfy.me",
    );

    expect(parsed.title).toBe("Foundfy | Be found wherever people search.");
    expect(parsed.canonical).toBe("https://www.foundfy.me/");
    expect(parsed.metaDescription).toBeNull();
  });
});
