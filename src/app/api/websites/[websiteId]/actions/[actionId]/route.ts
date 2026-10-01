import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { actionErrorResponse } from "@/lib/actions/http";
import { getActionPreview, updateActionProposal } from "@/lib/actions/lifecycle";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string; actionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { websiteId, actionId } = await context.params;

  if (!isValidUuid(websiteId) || !isValidUuid(actionId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const view = await getActionPreview({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      actionId,
    });
    return observeJson(view);
  } catch (error) {
    return actionErrorResponse(error, "Unable to load this change right now.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { websiteId, actionId } = await context.params;

  if (!isValidUuid(websiteId) || !isValidUuid(actionId)) {
    return observeJson({ error: "Invalid id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { proposedValue?: unknown };
    const view = await updateActionProposal({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      actionId,
      proposedValue: body.proposedValue ?? null,
    });
    return observeJson(view);
  } catch (error) {
    return actionErrorResponse(error, "Foundfy couldn't save this draft right now.");
  }
}
