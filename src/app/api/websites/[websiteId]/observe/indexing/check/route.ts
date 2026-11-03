import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { checkGoogleIndexing } from "@/lib/gsc/indexing-check";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const evidence = await checkGoogleIndexing({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(evidence);
  } catch (error) {
    return observeErrorResponse(error, "Google indexing data couldn't be loaded right now.");
  }
}
