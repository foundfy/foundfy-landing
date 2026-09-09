import { loadCrawlEvidenceContext } from "../src/lib/observations/db/repository";
import { generateObservationDrafts } from "../src/lib/observations/engine";
import { UNSUPPORTED_RULES } from "../src/lib/observations/rules";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run observations:preview -- <crawlRunId>");
    process.exit(1);
  }

  const context = await loadCrawlEvidenceContext(crawlRunId);
  if (!context) {
    throw new Error("Crawl run not found.");
  }

  const observations = generateObservationDrafts(context);

  console.log(
    JSON.stringify(
      {
        crawlRunId,
        generatedCount: observations.length,
        observations: observations.map((observation) => ({
          ruleKey: observation.ruleKey,
          severity: observation.severity,
          category: observation.category,
          title: observation.title,
          pageUrl: observation.pageUrl,
          evidence: observation.evidence,
        })),
        unsupportedRules: UNSUPPORTED_RULES,
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
