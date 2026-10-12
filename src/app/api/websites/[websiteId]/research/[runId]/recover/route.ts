import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { researchErrorResponse, observeJson } from "@/lib/research/http";
import { recoverResearchForOwner } from "@/lib/research/recover";
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
    const view = await recoverResearchForOwner({
      websiteId,
      runId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return researchErrorResponse(error, "Unable to recover related demand right now.");
  }
}
