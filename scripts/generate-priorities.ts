import { generatePrioritiesForCrawlRun } from "../src/lib/priorities/db/repository";
import { formatPriorityPreviewLine } from "../src/lib/priorities/preview-format";
import { listObservations } from "../src/lib/observations/db/repository";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run priorities:generate -- <crawlRunId>");
    process.exit(1);
  }

  const result = await generatePrioritiesForCrawlRun(crawlRunId);
  const observations = await listObservations(crawlRunId);
  const observationById = new Map(observations.map((item) => [item.id, item]));

  console.log(`Generated ${result.generatedCount} priorities for ${crawlRunId}\n`);

  for (const priority of result.priorities) {
    console.log(
      formatPriorityPreviewLine({
        priority,
        observation: observationById.get(priority.observationId),
      }),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
