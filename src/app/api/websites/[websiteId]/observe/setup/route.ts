import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { setupSearchPresence } from "@/lib/gsc/setup";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      domain?: unknown;
      siteUrl?: unknown;
    };
    const view = await setupSearchPresence({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      requestedDomain: body.domain ?? body.siteUrl,
    });
    return observeJson(view);
  } catch (error) {
    return observeErrorResponse(error, "Unable to set up Search Console right now.");
  }
}
