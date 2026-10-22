import { listObserveCandidatesForOwner } from "@/lib/observe/observe";
import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { researchErrorResponse, observeJson } from "@/lib/research/http";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string; ideaId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { websiteId, ideaId } = await context.params;
  if (!isValidUuid(websiteId) || !isValidUuid(ideaId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const view = await listObserveCandidatesForOwner({
      websiteId,
      ideaId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return researchErrorResponse(error, "Unable to load pages to observe right now.");
  }
}
