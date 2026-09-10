import { generatePrioritiesForCrawlRun } from "../src/lib/priorities/db/repository";
import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function main() {
  const crawlRunId = process.argv[2];

  if (!crawlRunId) {
    console.error("Usage: npm run priorities:verify-idempotency -- <crawlRunId>");
    process.exit(1);
  }

  const first = await generatePrioritiesForCrawlRun(crawlRunId);
  const second = await generatePrioritiesForCrawlRun(crawlRunId);

  const supabase = getSupabaseAdmin();
  const { data: activeRows, error: activeError } = await supabase
    .from("observation_priorities")
    .select("id, observation_id, rule_key, subject_key, priority_score, rank, status")
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active")
    .order("rank", { ascending: true });

  if (activeError) {
    throw new Error(activeError.message);
  }

  const { count: totalCount, error: totalError } = await supabase
    .from("observation_priorities")
    .select("id", { count: "exact", head: true })
    .eq("crawl_run_id", crawlRunId);

  if (totalError) {
    throw new Error(totalError.message);
  }

  const activeCount = activeRows?.length ?? 0;
  const uniqueObservationIds = new Set(
    activeRows?.map((row) => row.observation_id) ?? [],
  );

  console.log(
    JSON.stringify(
      {
        crawlRunId,
        firstRunCount: first.generatedCount,
        secondRunCount: second.generatedCount,
        activeCount,
        totalCount,
        uniqueActiveObservationIds: uniqueObservationIds.size,
        idempotent:
          first.generatedCount === second.generatedCount &&
          activeCount === uniqueObservationIds.size &&
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
