import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";

async function main() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, status, completed_at, websites!inner(hostname)")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, Array<{ id: string; completedAt: string | null }>>();

  for (const row of data ?? []) {
    const website = Array.isArray(row.websites) ? row.websites[0] : row.websites;
    const hostname = website?.hostname;
    if (!hostname) {
      continue;
    }

    const list = grouped.get(hostname) ?? [];
    list.push({ id: row.id, completedAt: row.completed_at });
    grouped.set(hostname, list);
  }

  const multi = [...grouped.entries()]
    .filter(([, runs]) => runs.length >= 2)
    .map(([hostname, runs]) => ({ hostname, runs }));

  console.log(JSON.stringify(multi, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
