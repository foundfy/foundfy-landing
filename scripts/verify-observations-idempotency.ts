import { generateObservationsForCrawlRun } from "../src/lib/observations/db/repository";
import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run observations:verify-idempotency -- <crawlRunId>");
    process.exit(1);
  }

  const first = await generateObservationsForCrawlRun(crawlRunId);
  const second = await generateObservationsForCrawlRun(crawlRunId);

  const supabase = getSupabaseAdmin();
  const { data: activeRows, error: activeError } = await supabase
    .from("observations")
    .select("id, rule_key, subject_key, status")
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active");

  if (activeError) {
    throw new Error(activeError.message);
  }

  const { count: totalCount, error: totalError } = await supabase
    .from("observations")
    .select("id", { count: "exact", head: true })
    .eq("crawl_run_id", crawlRunId);

  if (totalError) {
    throw new Error(totalError.message);
  }

  const activeCount = activeRows?.length ?? 0;
  const uniqueSubjectKeys = new Set(activeRows?.map((row) => row.subject_key) ?? []);

  console.log(
    JSON.stringify(
      {
        crawlRunId,
        firstRunCount: first.generatedCount,
        secondRunCount: second.generatedCount,
        activeCount,
        totalCount,
        uniqueActiveSubjectKeys: uniqueSubjectKeys.size,
        idempotent:
          first.generatedCount === second.generatedCount &&
          activeCount === uniqueSubjectKeys.size &&
          activeCount === first.generatedCount,
        activeRows,
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
