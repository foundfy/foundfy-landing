import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

const crawlRunId = process.argv[2];

if (!crawlRunId) {
  console.error("Usage: tsx scripts/report-crawl-run.ts <crawlRunId>");
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .select(
      "id, status, seed_url, max_pages, pages_crawled, pages_discovered, error_message, started_at, completed_at, websites(hostname)",
    )
    .eq("id", crawlRunId)
    .single();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Crawl run not found");
  }

  const { data: pages } = await supabase
    .from("pages")
    .select(
      "requested_url, final_url, status_code, title, internal_link_count, external_link_count, word_count",
    )
    .eq("crawl_run_id", crawlRunId)
    .order("fetched_at", { ascending: true });

  const { count: linkCount } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("crawl_run_id", crawlRunId);

  const { data: artifacts } = await supabase
    .from("crawl_site_artifacts")
    .select("artifact_type, url, status_code, parsed")
    .eq("crawl_run_id", crawlRunId);

  const { data: queueIssues } = await supabase
    .from("crawl_queue")
    .select("url, status, skip_reason")
    .eq("crawl_run_id", crawlRunId)
    .in("status", ["failed", "skipped"]);

  const website = Array.isArray(run.websites) ? run.websites[0] : run.websites;

  console.log(
    JSON.stringify(
      {
        crawlRunId: run.id,
        hostname: website?.hostname ?? null,
        status: run.status,
        seedUrl: run.seed_url,
        maxPages: run.max_pages,
        pagesCrawled: run.pages_crawled,
        pagesDiscovered: run.pages_discovered,
        errorMessage: run.error_message,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        totalLinksStored: linkCount ?? 0,
        pages,
        artifacts,
        queueIssues,
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
