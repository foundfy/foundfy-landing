import { compareWithPreviousCrawl } from "../src/lib/findings/comparison/compare-crawls";
import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function main() {
  const hostname = process.argv[2] ?? "arngren.net";
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, completed_at, websites!inner(hostname)")
    .eq("websites.hostname", hostname)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const result = await compareWithPreviousCrawl(row.id);
    if (!result) {
      continue;
    }

    const { comparison } = result;
    if (
      comparison.fixed > 0 ||
      comparison.new > 0 ||
      comparison.unverified > 0
    ) {
      console.log(
        JSON.stringify(
          {
            crawlRunId: row.id,
            completedAt: row.completed_at,
            comparison,
          },
          null,
          2,
        ),
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
