import { generateDecisionsForWebsite } from "@/lib/decisions/generate";
import { loadDecisionsForWebsite } from "@/lib/decisions/load";
import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
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
    const sessionToken = readObserveSessionToken(request);
    await generateDecisionsForWebsite({ websiteId, sessionToken });
    const view = await loadDecisionsForWebsite({ websiteId, sessionToken });
    return observeJson(view);
  } catch (error) {
    return observeErrorResponse(error, "Foundfy couldn't prioritize actions right now.");
  }
}
