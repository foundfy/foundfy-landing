import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("ACT v0 source boundary", () => {
  it("does not call OpenAI, crawler workers, or CMS providers", () => {
    const lifecycle = read("./lifecycle.ts");
    const db = read("./db.ts");
    const mutation = read("./mutation.ts");
    const source = [lifecycle, db, mutation].join("\n");

    expect(source).not.toMatch(/openai|OpenAI/i);
    expect(source).not.toMatch(/generateObservationsForCrawlRun|persistFindings|createJob|from \"@\/lib\/findings|from \"@\/lib\/jobs/);
    expect(source).not.toMatch(/from \"@\/lib\/crawler/);
    expect(source).not.toMatch(/wordpress|drupal|shopify|wp-json|jsonapi/i);
    expect(lifecycle).not.toMatch(/generateDecisionsForWebsite/);
    expect(lifecycle).toMatch(/staleReasonForRun/);
    expect(lifecycle).toMatch(/adapter_not_connected/);
    expect(mutation).toMatch(/mutation_spec|buildMutationSpec/);
    expect(mutation).not.toMatch(/write_payload/);
  });

  it("keeps ACT off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const pageView = read("../../components/site/SitePageView.tsx");

    expect(overviewLoader).not.toMatch(/from \"@\/lib\/actions|action_runs/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/actions|actions\/prepare/);
    expect(pageView).toContain("SiteDecisionsSection");
  });

  it("does not reuse GSC tokens for CMS writes", () => {
    const lifecycle = read("./lifecycle.ts");
    expect(lifecycle).not.toMatch(/decryptSecret|refreshGoogleAccessToken|webmasters/);
    expect(lifecycle).not.toMatch(/cms_connections|wordpress|drupal/);
  });
});
