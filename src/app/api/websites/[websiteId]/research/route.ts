import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { researchErrorResponse, observeJson } from "@/lib/research/http";
import { loadResearchForOwner } from "@/lib/research/load";
import { startResearchForOwner } from "@/lib/research/start";
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
    const view = await loadResearchForOwner({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(view);
  } catch (error) {
    return researchErrorResponse(error, "Unable to load related demand right now.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;
  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const selectedOfferings = Array.isArray(record.selectedOfferings)
    ? record.selectedOfferings.filter((item): item is string => typeof item === "string")
    : undefined;
  const languages = Array.isArray(record.languages)
    ? record.languages.filter((item): item is string => typeof item === "string")
    : undefined;
  const countryKey = typeof record.countryKey === "string" ? record.countryKey : undefined;

  try {
    const view = await startResearchForOwner({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      selectedOfferings,
      countryKey,
      languages,
    });
    return observeJson(view, 201);
  } catch (error) {
    return researchErrorResponse(error, "Unable to research related demand right now.");
  }
}
