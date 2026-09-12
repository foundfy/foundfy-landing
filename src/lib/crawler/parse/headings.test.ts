import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { MAX_HEADINGS_PER_LEVEL, extractBoundedHeadings } from "./headings";

describe("H2/H3 extraction", () => {
  it("keeps meaningful headings and drops empty, chrome, and duplicates", () => {
    const $ = cheerio.load(`<!doctype html>
      <html>
        <body>
          <nav><h2>Main navigation</h2></nav>
          <aside><h2>Categories</h2></aside>
          <main>
            <h2>  Silk dyeing  </h2>
            <h2>Silk dyeing</h2>
            <h3></h3>
            <h3>Beginner workshop</h3>
            <h3>Advanced workshop</h3>
          </main>
          <footer><h2>Footer</h2></footer>
        </body>
      </html>`);

    expect(extractBoundedHeadings($, 2)).toEqual(["Silk dyeing"]);
    expect(extractBoundedHeadings($, 3)).toEqual([
      "Beginner workshop",
      "Advanced workshop",
    ]);
  });

  it("caps headings per level and preserves order", () => {
    const headings = Array.from(
      { length: MAX_HEADINGS_PER_LEVEL + 5 },
      (_, index) => `<h2>Section ${index + 1}</h2>`,
    ).join("");
    const $ = cheerio.load(`<main>${headings}</main>`);
    const extracted = extractBoundedHeadings($, 2);

    expect(extracted).toHaveLength(MAX_HEADINGS_PER_LEVEL);
    expect(extracted[0]).toBe("Section 1");
    expect(extracted[MAX_HEADINGS_PER_LEVEL - 1]).toBe(
      `Section ${MAX_HEADINGS_PER_LEVEL}`,
    );
  });
});
