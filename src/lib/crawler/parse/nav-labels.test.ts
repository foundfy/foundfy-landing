import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { MAX_NAV_LABELS, extractNavLabels } from "./nav-labels";

describe("navigation labels", () => {
  it("normalizes, dedupes, and ignores non-nav links", () => {
    const $ = cheerio.load(`<!doctype html>
      <html>
        <body>
          <nav>
            <a href="/ca">  Home  </a>
            <a href="/ca/la-seda">La Seda</a>
            <a href="/ca">Home</a>
            <a href="/login">Login</a>
          </nav>
          <main>
            <a href="/article">Old article</a>
          </main>
        </body>
      </html>`);

    expect(extractNavLabels($)).toEqual(["Home", "La Seda", "Login"]);
  });

  it("caps labels", () => {
    const links = Array.from(
      { length: MAX_NAV_LABELS + 8 },
      (_, index) => `<a href="/p/${index}">Item ${index}</a>`,
    ).join("");
    const $ = cheerio.load(`<nav>${links}</nav>`);

    expect(extractNavLabels($)).toHaveLength(MAX_NAV_LABELS);
  });
});
