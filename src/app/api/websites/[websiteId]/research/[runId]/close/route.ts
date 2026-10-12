import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { closeResearchForOwner } from "@/lib/research/close";
import { researchErrorResponse, observeJson } from "@/lib/research/http";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string; runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId, runId } = await context.params;
  if (!isValidUuid(websiteId) || !isValidUuid(runId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const view = await closeResearchForOwner({
      websiteId,
      runId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return researchErrorResponse(error, "Unable to close related demand research right now.");
  }
}
