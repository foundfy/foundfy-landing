import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("regression-safety v0 boundary", () => {
  const compare = read("./compare.ts");
  const observe = read("./observe.ts");
  const display = read("./display.ts");
  const types = read("./types.ts");
  const blob = [compare, observe, display, types].join("\n");
  const page = read("../../components/site/SitePageView.tsx");

  it("does not add ACT adapters, CMS connectors, OAuth, Google, or DataForSEO", () => {
    expect(blob).not.toMatch(/from \"@\/lib\/(actions\/github|gsc|research|decisions\/generate)/);
    expect(blob).not.toMatch(/urlInspection|sitemaps\.submit|request indexing/i);
    expect(blob).not.toMatch(/dataforseo|DataForSEO|googleapis/i);
    expect(blob).not.toMatch(/wordpress|webflow|cms_connections/i);
    expect(compare).not.toMatch(/fetch\(|ssrfSafeFetch/);
  });

  it("does not invent a persistence system or silently add a pages schema", () => {
    const migrations = readdirSync(path.join(__dirname, "../../../supabase/migrations"));
    expect(migrations.filter((name) => /regression|social_meta|og_image|twitter_image/i.test(name))).toEqual(
      [],
    );
    expect(blob).not.toMatch(/alter table|create table|from\(\"pages\"\)\.insert/);
    expect(read("../crawler/db/repository.ts")).not.toMatch(/og_image|twitter_image|social_metadata/);
  });

  it("does not auto-compare the latest two crawls on the owner site page", () => {
    expect(page).not.toMatch(/evaluateManualSeoRegression|regression-safety/);
    expect(compare).toMatch(/baseline must complete before the verification crawl/);
  });

  it("does not claim Foundfy published an owner-applied change", () => {
    expect(display).toContain("The owner published this change");
    expect(display).not.toMatch(/Foundfy published this change/);
  });
});
