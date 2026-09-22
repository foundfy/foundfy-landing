import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

const REQUIRED_TABLES = [
  "google_identities",
  "google_oauth_tokens",
  "gsc_observe_owners",
  "gsc_oauth_states",
  "gsc_owner_sessions",
] as const;

async function main() {
  const supabase = getSupabaseAdmin();
  const missing: string[] = [];

  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      missing.push(`${table}: ${error.message}`);
    } else {
      console.log(`Table ok: ${table}`);
    }
  }

  if (missing.length > 0) {
    console.error("GSC OAuth tables missing or unreadable:");
    for (const line of missing) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  console.log("GSC OAuth setup verification passed.");
}

main().catch((error) => {
  console.error("GSC OAuth setup verification failed:", error);
  process.exit(1);
});
