export type RescanResponse = {
  crawlRunId: string;
  websiteId: string;
  reusedActiveScan?: boolean;
  error?: string;
};

export type RescanActionResult =
  | { ok: true; crawlRunId: string; reusedActiveScan: boolean }
  | { ok: false; error: string };

export function buildRescanRequestPath(websiteId: string): string {
  return `/api/websites/${websiteId}/scan`;
}

export function buildScanNavigationHref(crawlRunId: string): string {
  return `/scan/${crawlRunId}`;
}

export function parseRescanResponse(
  response: Response,
  payload: RescanResponse,
): RescanActionResult {
  if (!response.ok || !payload.crawlRunId) {
    return {
      ok: false,
      error: payload.error ?? "Unable to start scan right now.",
    };
  }

  return {
    ok: true,
    crawlRunId: payload.crawlRunId,
    reusedActiveScan: payload.reusedActiveScan === true,
  };
}
