import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { actionErrorResponse } from "@/lib/actions/http";
import { cancelAction } from "@/lib/actions/lifecycle";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string; actionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId, actionId } = await context.params;

  if (!isValidUuid(websiteId) || !isValidUuid(actionId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const view = await cancelAction({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      actionId,
    });
    return observeJson(view);
  } catch (error) {
    return actionErrorResponse(error, "Foundfy couldn't cancel this change right now.");
  }
}
