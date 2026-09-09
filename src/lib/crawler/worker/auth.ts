export function isCrawlWorkerAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.CRAWL_WORKER_SECRET;

  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}
