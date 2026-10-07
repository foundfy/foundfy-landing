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
    const liveMeta = read("./live-meta.ts");
    const verify = read("./verify.ts");
    const verification = read("./verification.ts");
    const learn = read("./learn.ts");
    const learning = read("./learning.ts");
    const github = [
      read("./github/commit.ts"),
      read("./github/api.ts"),
      read("./github/auth.ts"),
      read("./github/config.ts"),
      read("./github/homepage-source.ts"),
      read("./github/target.ts"),
    ].join("\n");
    const source = [lifecycle, db, mutation, liveMeta, verify, verification, learn, learning, github].join("\n");

    expect(source).not.toMatch(/openai|OpenAI/i);
    expect(source).not.toMatch(/generateObservationsForCrawlRun|persistFindings|createJob|from \"@\/lib\/findings|from \"@\/lib\/jobs/);
    expect(source).not.toMatch(/from \"@\/lib\/crawler/);
    expect(source).not.toMatch(/wordpress|drupal|shopify|wp-json|jsonapi/i);
    expect(lifecycle).not.toMatch(/generateDecisionsForWebsite/);
    expect(lifecycle).toMatch(/staleReasonForRun/);
    expect(lifecycle).toMatch(/adapter_not_connected/);
    expect(lifecycle).toMatch(/blockIfUnsafe/);
    expect(mutation).toMatch(/mutation_spec|buildMutationSpec/);
    expect(mutation).not.toMatch(/write_payload/);
    expect(github).toMatch(/foundfy-act:/);
    expect(github).toMatch(/force: false/);
    expect(github).not.toMatch(/\bPAT\b|personal access token/i);
    expect(verify).not.toMatch(/from \"\.\/github|from \"\.\/lifecycle|from \"\.\/live-meta/);
    expect(verify).not.toMatch(/createAndEnqueueCrawl|start-crawl|generateObservationsForCrawlRun/);
    expect(verify).not.toMatch(/deploymentObserved|generateDecisionsForWebsite/);
    expect(learn).not.toMatch(/from \"\.\/github|createAndEnqueueCrawl|start-crawl|openai|OpenAI|refreshGoogleAccessToken|webmasters/i);
    expect(learning).not.toMatch(/decision_runs|searchDemandScore|issueImportance/);
    expect(read("./google-privacy.ts")).not.toMatch(/openai|OpenAI|createAndEnqueueCrawl|webmasters|from \"\.\/github/i);
    expect(db).toMatch(/\.gt\("completed_at", input.afterIso\)/);
  });

  it("keeps ACT off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const pageView = read("../../components/site/SitePageView.tsx");

    expect(overviewLoader).not.toMatch(/from \"@\/lib\/actions|action_runs|action_verifications|action_learning/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/actions|actions\/prepare/);
    expect(pageView).toContain("SiteDecisionsSection");
    expect(pageView).toContain("SiteActionsSection");
  });

  it("does not reuse GSC tokens for CMS writes", () => {
    const lifecycle = read("./lifecycle.ts");
    expect(lifecycle).not.toMatch(/decryptSecret|refreshGoogleAccessToken|webmasters/);
    expect(lifecycle).not.toMatch(/cms_connections|wordpress|drupal/);
  });
});
