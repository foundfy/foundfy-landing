import { NextResponse } from "next/server";
import { confirmWebsiteSiteModel } from "@/lib/site-model/confirm";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const siteDescription =
    typeof record.siteDescription === "string" ? record.siteDescription : "";

  try {
    const siteModel = await confirmWebsiteSiteModel({
      websiteId,
      fields: {
        siteDescription,
        offers: asStringArray(record.offers),
        audiences: asStringArray(record.audiences),
        locations: asStringArray(record.locations),
      },
    });

    return NextResponse.json({ siteModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm site model.";
    if (message === "Website not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message === "A short description is required to confirm this site." ||
      message === "No completed crawl is available to confirm." ||
      message === "Site model is not available yet."
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[Site Model] Failed to confirm interpretation:", message);
    return NextResponse.json(
      { error: "Unable to confirm this site understanding right now." },
      { status: 500 },
    );
  }
}
