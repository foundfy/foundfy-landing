import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { loadQueryOpportunities } from "@/lib/opportunities/load";
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
    const view = await loadQueryOpportunities({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return observeErrorResponse(error, "Unable to load search demand right now.");
  }
}
