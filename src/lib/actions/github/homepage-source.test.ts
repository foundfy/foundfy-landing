import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_DESCRIPTION_FILE_PATH,
  parseHomepageDescriptionSource,
  renderHomepageDescriptionSource,
} from "./homepage-source";

const COPY = "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.";

describe("homepage description source", () => {
  it("round-trips null and a string through the canonical file", () => {
    expect(parseHomepageDescriptionSource(renderHomepageDescriptionSource(null))).toBeNull();
    expect(parseHomepageDescriptionSource(renderHomepageDescriptionSource(COPY))).toBe(COPY);
  });

  it("refuses unexpected file structure", () => {
    expect(() => parseHomepageDescriptionSource("export const OTHER = null;\n")).toThrow("unexpected_source_shape");
    expect(() =>
      parseHomepageDescriptionSource(`${renderHomepageDescriptionSource(COPY)}\nexport const extra = 1;\n`),
    ).toThrow("unexpected_source_shape");
    expect(() => parseHomepageDescriptionSource("export const HOMEPAGE_META_DESCRIPTION = 'no';\n")).toThrow(
      "unexpected_source_shape",
    );
    expect(() => parseHomepageDescriptionSource(renderHomepageDescriptionSource(""))).toThrow(
      "unexpected_source_shape",
    );
  });

  it("targets only the canonical homepage-description file", () => {
    expect(HOMEPAGE_DESCRIPTION_FILE_PATH).toBe("src/lib/seo/homepage-description.ts");
  });
});
