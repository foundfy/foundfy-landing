import { processCrawlRun } from "../src/lib/crawler/worker/process-run";

async function main() {
  const preferredRunId = process.argv[2];

  try {
    const crawlRunId = await processCrawlRun(preferredRunId);

    if (!crawlRunId) {
      console.log("No queued crawl runs found.");
      process.exit(0);
    }

    console.log(`Processed crawl run: ${crawlRunId}`);
    process.exit(0);
  } catch (error) {
    console.error("Crawl worker failed:", error);
    process.exit(1);
  }
}

void main();
