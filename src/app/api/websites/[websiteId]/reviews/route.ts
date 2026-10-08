import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { actionErrorResponse } from "@/lib/actions/http";
import { listCanonicalReviewsForOwner, submitCanonicalReview } from "@/lib/actions/review";
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
    const payload = await listCanonicalReviewsForOwner({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(payload);
  } catch (error) {
    return actionErrorResponse(error, "Unable to load canonical reviews right now.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      decisionId?: unknown;
      outcome?: unknown;
    };
    if (typeof body.decisionId !== "string" || !isValidUuid(body.decisionId)) {
      return observeJson({ error: "A valid decisionId is required." }, 400);
    }

    const view = await submitCanonicalReview({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      decisionId: body.decisionId,
      outcome: body.outcome,
    });
    return observeJson(view);
  } catch (error) {
    return actionErrorResponse(error, "Foundfy couldn't save this review right now.");
  }
}
