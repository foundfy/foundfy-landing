import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function verifyTable(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("observation_priorities").select("id").limit(1);

  if (!error) {
    return true;
  }

  console.error("observation_priorities table check failed:", error.message);
  return false;
}

async function main() {
  if (await verifyTable()) {
    console.log("observation_priorities table is already available.");
    return;
  }

  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/003_priorities_phase2b.sql",
  );
  const migrationSql = readFileSync(migrationPath, "utf8");

  console.log("The observation_priorities table is not available yet.");
  console.log("Apply this migration manually in Supabase SQL Editor:\n");
  console.log(migrationPath);
  console.log("\n--- migration SQL ---\n");
  console.log(migrationSql);
  console.log("\n--- end migration SQL ---\n");
  console.log(
    "After applying, rerun: npm run crawl:verify-setup && npm run priorities:generate -- <crawlRunId>",
  );

  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
