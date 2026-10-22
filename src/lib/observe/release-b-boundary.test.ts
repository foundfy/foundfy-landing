import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Release B observe boundaries", () => {
  const observe = [
    read("./observe.ts"),
    read("./db.ts"),
    read("./fetch-page.ts"),
    read("./candidates.ts"),
    read("./robots.ts"),
    read("./ranking.ts"),
  ].join("\n");
  const inspect = read("../decisions/inspect.ts");
  const t1 = read("../decisions/inspect-t1-db.ts");
  const fetch = read("../crawler/security/targeted-observe-fetch.ts");
  const create = read("../crawler/db/repository.ts");
  const panel = read("../../components/site/SiteObserveIdeaPanel.tsx");
  const research = read("../../components/site/SiteResearchSection.tsx");

  it("keeps createCrawlRun site_sample-only and uses claim RPC for targeted crawls", () => {
    expect(create).toMatch(/purpose: CRAWL_RUN_PURPOSE_SITE_SAMPLE/);
    expect(create).not.toMatch(/purpose: CRAWL_RUN_PURPOSE_TARGETED_OBSERVE/);
    expect(observe).toMatch(/claim_targeted_observation/);
    expect(observe).toMatch(/finalize_targeted_observation/);
    expect(observe).not.toMatch(/from\(["']targeted_observations["']\)[\s\S]{0,200}\.insert/s);
    expect(observe).not.toMatch(/processCrawlRun/);
    expect(observe).not.toMatch(/enqueueUrl/);
  });

  it("does not enable live research or call providers/OpenAI/GSC sync", () => {
    expect(observe).not.toMatch(/RESEARCH_LIVE_ENABLED/);
    expect(observe).not.toMatch(/openai|OpenAI|dataforseo|DataForSEO/i);
    expect(observe).not.toMatch(/syncSearchAnalytics|refreshGoogleAccessToken/);
    expect(inspect).not.toMatch(/openai|OpenAI|dataforseo/i);
    expect(t1).toMatch(/persist_research_inspect_decision_with_observation/);
    expect(t1).not.toMatch(/p_rank|p_priority_band|p_scoring/);
  });

  it("observes only via queueItemId and owner auth", () => {
    const route = read("../../app/api/websites/[websiteId]/research/ideas/[ideaId]/observe/route.ts");
    const candidates = read(
      "../../app/api/websites/[websiteId]/research/ideas/[ideaId]/observe-candidates/route.ts",
    );
    expect(route).toMatch(/queueItemId/);
    expect(route).not.toMatch(/requestedUrl|rawUrl|targetUrl/);
    expect(route).toMatch(/requireObserveOwner|observeCandidateForOwner/);
    expect(candidates).toMatch(/listObserveCandidatesForOwner/);
    expect(panel).toMatch(/queueItemId: candidate.queueItemId/);
    expect(panel).toMatch(/targetedObservationId/);
    expect(research).toMatch(/no_obvious_match_in_current_crawl/);
  });

  it("validates every targeted redirect hop before requesting it", () => {
    expect(fetch).toMatch(/validatePublicHttpUrl/);
    expect(fetch).toMatch(/HTTPS downgrade is not allowed/);
    expect(fetch).toMatch(/Redirect is not same-site/);
    expect(fetch).toMatch(/MAX_REDIRECTS/);
    expect(fetch).toMatch(/redirect: "manual"/);
  });
});
