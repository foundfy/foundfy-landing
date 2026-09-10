import { previewPrioritiesForCrawlRun } from "../src/lib/priorities/db/repository";
import { formatPriorityPreviewLine } from "../src/lib/priorities/preview-format";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run priorities:preview -- <crawlRunId>");
    process.exit(1);
  }

  const result = await previewPrioritiesForCrawlRun(crawlRunId);
  const observationById = new Map(
    result.observations.map((item) => [item.id, item]),
  );

  console.log(`Preview priorities for ${crawlRunId} (${result.priorities.length} active observations)\n`);

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
