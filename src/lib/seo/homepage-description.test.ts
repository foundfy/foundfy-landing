import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HOMEPAGE_META_DESCRIPTION } from "./homepage-description";
import { parseHomepageDescriptionSource } from "../actions/github/homepage-source";

describe("homepage metadata ownership", () => {
  it("exports a single deterministic homepage description symbol", () => {
    expect(typeof HOMEPAGE_META_DESCRIPTION === "string" || HOMEPAGE_META_DESCRIPTION === null).toBe(true);
  });

  it("keeps the source file in the adapter's canonical shape", () => {
    const source = readFileSync(path.join(__dirname, "homepage-description.ts"), "utf8");
    expect(parseHomepageDescriptionSource(source)).toBe(HOMEPAGE_META_DESCRIPTION);
  });

  it("lets the homepage override description without stripping layout defaults", () => {
    const page = readFileSync(path.join(__dirname, "../../app/page.tsx"), "utf8");
    const layout = readFileSync(path.join(__dirname, "../../app/layout.tsx"), "utf8");
    expect(page).toContain("HOMEPAGE_META_DESCRIPTION");
    expect(page).toContain("description: HOMEPAGE_META_DESCRIPTION");
    expect(layout).toContain("const siteDescription =");
    expect(layout).toContain("description: siteDescription");
  });
});
