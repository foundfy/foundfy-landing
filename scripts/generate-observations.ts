import { generateObservationsForCrawlRun } from "../src/lib/observations/db/repository";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run observations:generate -- <crawlRunId>");
    process.exit(1);
  }

  const result = await generateObservationsForCrawlRun(crawlRunId);

  console.log(
    JSON.stringify(
      {
        crawlRunId: result.crawlRunId,
        generatedCount: result.generatedCount,
        observations: result.observations.map((observation) => ({
          ruleKey: observation.ruleKey,
          severity: observation.severity,
          category: observation.category,
          title: observation.title,
          pageUrl: observation.pageUrl,
          evidence: observation.evidence,
        })),
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
