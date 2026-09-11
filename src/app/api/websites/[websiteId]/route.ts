import { NextResponse } from "next/server";
import { loadWebsiteOverview } from "@/lib/websites/load-overview";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  try {
    const overview = await loadWebsiteOverview(websiteId);

    if (!overview) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }

    return NextResponse.json(overview, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Website] Failed to load overview:", error);
    return NextResponse.json(
      { error: "Unable to load website overview right now." },
      { status: 500 },
    );
  }
}
