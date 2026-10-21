import { observeCandidateForOwner } from "@/lib/observe/observe";
import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { researchErrorResponse, observeJson } from "@/lib/research/http";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string; ideaId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId, ideaId } = await context.params;
  if (!isValidUuid(websiteId) || !isValidUuid(ideaId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  let queueItemId: string | null = null;
  try {
    const body = (await request.json()) as { queueItemId?: unknown };
    queueItemId = typeof body.queueItemId === "string" ? body.queueItemId : null;
  } catch {
    queueItemId = null;
  }

  if (!queueItemId || !isValidUuid(queueItemId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const result = await observeCandidateForOwner({
      websiteId,
      ideaId,
      sessionToken: readObserveSessionToken(request),
      queueItemId,
    });
    return observeJson(result);
  } catch (error) {
    return researchErrorResponse(error, "Unable to observe that page right now.");
  }
}
