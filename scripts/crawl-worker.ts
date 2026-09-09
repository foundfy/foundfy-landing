import { processCrawlQueue } from "../src/lib/crawler/worker/process-queue";

async function main() {
  const preferredRunId = process.argv[2];

  try {
    const result = await processCrawlQueue({
      preferredRunId,
      maxRuns: preferredRunId ? 1 : 3,
    });

    if (result.processedRunIds.length === 0) {
      console.log("No queued crawl runs found.");
      process.exit(0);
    }

    console.log(`Processed crawl runs: ${result.processedRunIds.join(", ")}`);
    if (result.reclaimed.failedQueued.length || result.reclaimed.failedRunning.length) {
      console.log("Reclaimed stale runs:", result.reclaimed);
    }
    process.exit(0);
  } catch (error) {
    console.error("Crawl worker failed:", error);
    process.exit(1);
  }
}

void main();
