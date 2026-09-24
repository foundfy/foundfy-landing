import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { syncSearchAnalytics } from "@/lib/gsc/sync";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const evidence = await syncSearchAnalytics({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(evidence);
  } catch (error) {
    return observeErrorResponse(error, "Google Search data couldn't be refreshed right now.");
  }
}
