import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/005_website_scan_history_idx.sql",
);

async function checkMigrationApplied(): Promise<{
  columnExists: boolean;
  indexExists: boolean;
  error?: string;
}> {
  const supabase = getSupabaseAdmin();

  const { error: columnError } = await supabase
    .from("crawl_runs")
    .select("observations_materialized_at")
    .limit(1);

  const columnExists = !columnError;

  const { data: runs, error: runsError } = await supabase
    .from("crawl_runs")
    .select("id, website_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (runsError) {
    return {
      columnExists,
      indexExists: false,
      error: runsError.message,
    };
  }

  if (!runs?.length) {
    return { columnExists, indexExists: columnExists };
  }

  const websiteId = runs[0]?.website_id;
  if (!websiteId) {
    return { columnExists, indexExists: columnExists };
  }

  const { error: indexProbeError } = await supabase
    .from("crawl_runs")
    .select("id")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    columnExists,
    indexExists: !indexProbeError,
    error: indexProbeError?.message,
  };
}

async function main() {
  const before = await checkMigrationApplied();

  if (before.columnExists) {
    console.log("Migration 005 already applied: observations_materialized_at exists.");
    console.log(
      JSON.stringify({
        columnExists: before.columnExists,
        indexProbeOk: before.indexExists,
      }),
    );
    return;
  }

  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
  console.error("Migration 005 is not applied yet.");
  console.error("Apply manually in Supabase SQL Editor:\n");
  console.error(migrationSql);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
