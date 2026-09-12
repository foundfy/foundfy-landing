import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export const DAILY_NEW_CRAWL_LIMIT = 30;
export const DAILY_CRAWL_LIMIT_STATUS = 429;
export const DAILY_CRAWL_LIMIT_MESSAGE =
  "Foundfy has reached today's beta analysis limit. Try again tomorrow.";

export class DailyCrawlLimitReachedError extends Error {
  readonly status = DAILY_CRAWL_LIMIT_STATUS;

  constructor(message = DAILY_CRAWL_LIMIT_MESSAGE) {
    super(message);
    this.name = "DailyCrawlLimitReachedError";
  }
}

export function getUtcDayStart(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function isDailyCrawlLimitReachedError(
  error: unknown,
): error is DailyCrawlLimitReachedError {
  return (
    error instanceof DailyCrawlLimitReachedError ||
    (error instanceof Error && error.name === "DailyCrawlLimitReachedError")
  );
}

export async function countCrawlsCreatedSince(since: Date): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("crawl_runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());

  if (error) {
    throw new Error(`Failed to count today's crawl runs: ${error.message}`);
  }

  return count ?? 0;
}

export async function countNewCrawlsCreatedToday(now = new Date()): Promise<number> {
  return countCrawlsCreatedSince(getUtcDayStart(now));
}

export async function assertCanCreateNewCrawl(now = new Date()): Promise<void> {
  const createdToday = await countNewCrawlsCreatedToday(now);

  if (createdToday >= DAILY_NEW_CRAWL_LIMIT) {
    throw new DailyCrawlLimitReachedError();
  }
}
