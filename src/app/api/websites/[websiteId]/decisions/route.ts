import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { loadDecisionsForWebsite } from "@/lib/decisions/load";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const view = await loadDecisionsForWebsite({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return observeErrorResponse(error, "Unable to load priorities right now.");
  }
}
