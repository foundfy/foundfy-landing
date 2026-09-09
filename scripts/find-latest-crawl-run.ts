import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function main() {
  const hostname = process.argv[2] ?? "foundfy.me";
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, status, pages_crawled, completed_at, websites!inner(hostname)")
    .eq("websites.hostname", hostname)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`No completed crawl run found for ${hostname}.`);
  }

  console.log(JSON.stringify({ crawlRunId: data.id, status: data.status, pagesCrawled: data.pages_crawled, completedAt: data.completed_at }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
