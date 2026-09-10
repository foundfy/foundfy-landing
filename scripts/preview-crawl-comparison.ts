import { loadCompletedCrawlResults } from "../src/lib/findings/load-completed-results";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    throw new Error("Usage: tsx --env-file=.env.local scripts/preview-crawl-comparison.ts <crawlRunId>");
  }

  const result = await loadCompletedCrawlResults(crawlRunId);

  const samples = {
    still_present: result.findings.find(
      (finding) => finding.changeStatus === "still_present",
    ),
    new: result.findings.find((finding) => finding.changeStatus === "new"),
    fixed: result.comparison?.fixedFindings[0] ?? null,
  };

  console.log(
    JSON.stringify(
      {
        crawlRunId,
        comparison: result.comparison ?? null,
        samples,
        unverifiedCount: result.comparison?.unverified ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
