import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { bindObserveProperty } from "@/lib/gsc/properties";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { siteUrl?: unknown };
    const bound = await bindObserveProperty({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      siteUrl: typeof body.siteUrl === "string" ? body.siteUrl : null,
    });

    return observeJson({
      status: "search_console_connected",
      propertySelected: true,
      property: {
        siteUrl: bound.siteUrl,
        propertyType: bound.propertyType,
        permissionLevel: bound.permissionLevel,
      },
    });
  } catch (error) {
    return observeErrorResponse(error, "Unable to save the Search Console property right now.");
  }
}
