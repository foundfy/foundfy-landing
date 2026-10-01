import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { actionErrorResponse } from "@/lib/actions/http";
import { listActionsForWebsite } from "@/lib/actions/lifecycle";
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
    const payload = await listActionsForWebsite({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(payload);
  } catch (error) {
    return actionErrorResponse(error, "Unable to load prepared changes right now.");
  }
}
