import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";
import { validatePublicHttpUrl } from "../src/lib/crawler/url/normalize";

const REQUIRED_TABLES = [
  "websites",
  "crawl_runs",
  "pages",
  "links",
  "crawl_queue",
  "crawl_site_artifacts",
  "observations",
] as const;

async function main() {
  const validated = validatePublicHttpUrl("https://foundfy.me");
  console.log("URL normalization:", validated);

  const supabase = getSupabaseAdmin();

  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1);

    if (error) {
      console.error(`Table check failed (${table}):`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      process.exit(1);
    }

    console.log(`Table ok: ${table}`);
  }

  console.log("Crawl setup verification passed.");
}

main().catch((error) => {
  console.error("Crawl setup verification failed:", error);
  process.exit(1);
});
