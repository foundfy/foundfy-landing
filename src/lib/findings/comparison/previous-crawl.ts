import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export type PreviousCompletedCrawlRun = {
  id: string;
  completedAt: string;
};

export async function findPreviousCompletedCrawlRun(input: {
  websiteId: string;
  currentCrawlRunId: string;
}): Promise<PreviousCompletedCrawlRun | null> {
  const supabase = getSupabaseAdmin();

  const { data: currentRun, error: currentError } = await supabase
    .from("crawl_runs")
    .select("completed_at")
    .eq("id", input.currentCrawlRunId)
    .eq("status", "completed")
    .maybeSingle();

  if (currentError) {
    throw new Error(
      `Failed to load current crawl run for comparison: ${currentError.message}`,
    );
  }

  if (!currentRun?.completed_at) {
    return null;
  }

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, completed_at")
    .eq("website_id", input.websiteId)
    .eq("status", "completed")
    .neq("id", input.currentCrawlRunId)
    .lte("completed_at", currentRun.completed_at)
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find previous completed crawl run: ${error.message}`,
    );
  }

  if (!data?.completed_at) {
    return null;
  }

  return {
    id: data.id,
    completedAt: data.completed_at,
  };
}
