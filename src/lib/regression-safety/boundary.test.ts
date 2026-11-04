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
  const load = read("./load.ts");
  const blob = [compare, observe, display, types, load].join("\n");
  const page = read("../../components/site/SitePageView.tsx");
  const script = read("../../../scripts/check-regression-safety.ts");

  it("does not add ACT adapters, CMS connectors, OAuth, Google, or DataForSEO", () => {
    expect(blob).not.toMatch(/from \"@\/lib\/(actions\/github|gsc|research|decisions\/generate)/);
    expect(blob).not.toMatch(/urlInspection|sitemaps\.submit|request indexing/i);
    expect(blob).not.toMatch(/dataforseo|DataForSEO|googleapis/i);
    expect(blob).not.toMatch(/wordpress|webflow|cms_connections/i);
    expect(compare).not.toMatch(/fetch\(|ssrfSafeFetch/);
    expect(load).not.toMatch(/startCrawl|processCrawl|ssrfSafeFetch/);
    expect(script).not.toMatch(/startCrawl|processCrawl/);
  });

  it("uses one additive pages.social_metadata column and does not rewrite historical rows", () => {
    const migrations = readdirSync(path.join(__dirname, "../../../supabase/migrations"));
    expect(migrations.filter((name) => /regression|social_meta|og_image|twitter_image/i.test(name))).toEqual([
      "028_page_social_metadata.sql",
    ]);
    expect(read("../../../supabase/migrations/028_page_social_metadata.sql")).toMatch(
      /add column if not exists social_metadata jsonb/,
    );
    expect(read("../../../supabase/migrations/028_page_social_metadata.sql")).toMatch(
      /Do not backfill historical rows/,
    );
    expect(read("../crawler/db/repository.ts")).toMatch(/social_metadata: serializeCollectedSocialMetadata/);
    expect(read("../crawler/db/repository.ts")).not.toMatch(/from\("pages"\)\s*\.update/);
  });

  it("does not auto-compare the latest two crawls or add a public owner workflow", () => {
    expect(page).not.toMatch(/evaluateManualSeoRegression|regression-safety|evaluatePersistedManualSeoRegression/);
    expect(compare).toMatch(/baseline must complete before the verification crawl/);
    expect(load).toMatch(/baselineCrawlId/);
    expect(load).not.toMatch(/latest two|order\(\"completed_at\"/);
    expect(script).toMatch(/spec.json/);
  });

  it("does not claim Foundfy published an owner-applied change", () => {
    expect(display).toContain("The owner published this change");
    expect(display).not.toMatch(/Foundfy published this change/);
  });
});
