import {
  inspectRelatedDemandAfterObservationForOwner,
  inspectRelatedDemandForOwner,
} from "@/lib/decisions/inspect";
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

  let targetedObservationId: string | null = null;
  try {
    const body = (await request.json()) as { targetedObservationId?: unknown };
    targetedObservationId =
      typeof body.targetedObservationId === "string" ? body.targetedObservationId : null;
  } catch {
    targetedObservationId = null;
  }

  try {
    const inspection = targetedObservationId
      ? await inspectRelatedDemandAfterObservationForOwner({
          websiteId,
          ideaId,
          sessionToken: readObserveSessionToken(request),
          targetedObservationId,
        })
      : await inspectRelatedDemandForOwner({
          websiteId,
          ideaId,
          sessionToken: readObserveSessionToken(request),
        });
    return observeJson({ inspection });
  } catch (error) {
    return researchErrorResponse(error, "Unable to check existing pages right now.");
  }
}
