import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { actionErrorResponse } from "@/lib/actions/http";
import { prepareAction } from "@/lib/actions/lifecycle";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { decisionId?: unknown };
    if (typeof body.decisionId !== "string" || !isValidUuid(body.decisionId)) {
      return observeJson({ error: "A valid decisionId is required." }, 400);
    }

    const view = await prepareAction({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      decisionId: body.decisionId,
    });
    return observeJson(view);
  } catch (error) {
    return actionErrorResponse(error, "Foundfy couldn't prepare this change right now.");
  }
}
