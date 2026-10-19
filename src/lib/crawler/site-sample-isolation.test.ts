import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, "../../..", relativePath), "utf8");
}

describe("site_sample isolation of general site state", () => {
  it("positively filters site_sample on latest/active/history selectors", () => {
    const websites = read("src/lib/websites/repository.ts");
    expect(websites).toMatch(/eq\("purpose", CRAWL_RUN_PURPOSE_SITE_SAMPLE\)/);
    expect(websites).toMatch(/export async function findLatestUsableCrawlRun/);
    expect(websites).toMatch(/export async function findActiveCrawlRunForWebsite/);
    expect(websites).toMatch(/export async function listCrawlRunsForWebsite/);
    expect(websites).not.toMatch(/neq\("purpose"/);
    expect(websites).not.toMatch(/purpose !=/);
  });

  it("keeps worker claim, reclaim, recover, and process on site_sample only", () => {
    const repo = read("src/lib/crawler/db/repository.ts");
    const processRun = read("src/lib/crawler/worker/process-run.ts");
    const reclaim = read("src/lib/crawler/worker/reclaim-stale.ts");
    const recover = read("src/lib/crawler/worker/recover-stale-run.ts");
    expect(repo).toMatch(/eq\("purpose", CRAWL_RUN_PURPOSE_SITE_SAMPLE\)/);
    expect(repo).toMatch(/isNonSiteSamplePurpose/);
    expect(processRun).toMatch(/isNonSiteSamplePurpose\(claimed\.purpose\)/);
    expect(reclaim).toMatch(/eq\("purpose", CRAWL_RUN_PURPOSE_SITE_SAMPLE\)/);
    expect(recover).toMatch(/isNonSiteSamplePurpose\(summary\.purpose\)/);
    expect(repo).not.toMatch(/neq\("purpose"/);
  });

  it("keeps previous crawl, VERIFY, findings, and scan routes off targeted runs", () => {
    expect(read("src/lib/findings/comparison/previous-crawl.ts")).toMatch(
      /eq\("purpose", CRAWL_RUN_PURPOSE_SITE_SAMPLE\)/,
    );
    expect(read("src/lib/actions/db.ts")).toMatch(
      /eq\("purpose", "site_sample"\)/,
    );
    expect(read("src/lib/findings/load-for-run.ts")).toMatch(/isNonSiteSamplePurpose/);
    expect(read("src/lib/websites/findings-count.ts")).toMatch(/isNonSiteSamplePurpose/);
    expect(read("src/app/api/crawl/[id]/route.ts")).toMatch(/isNonSiteSamplePurpose\(summary\.purpose\)/);
    expect(read("src/lib/site-model/repository.ts")).toMatch(/isNonSiteSamplePurpose/);
    expect(read("src/lib/site-model/load-for-website.ts")).toMatch(/isNonSiteSamplePurpose/);
    expect(read("src/lib/decisions/inspect-db.ts")).toMatch(
      /is\("targeted_observation_id", null\)/,
    );
  });

  it("keeps latest-crawl scripts on site_sample", () => {
    expect(read("scripts/find-latest-crawl-run.ts")).toMatch(/eq\("purpose", "site_sample"\)/);
    expect(read("scripts/diff-consecutive-crawls.ts")).toMatch(/eq\("purpose", "site_sample"\)/);
    expect(read("scripts/find-multi-crawl-sites.ts")).toMatch(/eq\("purpose", "site_sample"\)/);
  });

  it("keeps daily quota all-purpose", () => {
    const quota = read("src/lib/crawler/daily-crawl-limit.ts");
    expect(quota).toMatch(/from\("crawl_runs"\)/);
    expect(quota).not.toMatch(/purpose/);
  });
});
