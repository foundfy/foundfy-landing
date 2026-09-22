import { NextResponse } from "next/server";
import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { resolveObserveOwnerView } from "@/lib/gsc/observe";
import { ObserveAuthError } from "@/lib/gsc/types";
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
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  try {
    const view = await resolveObserveOwnerView({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });

    return NextResponse.json(view, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof ObserveAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unable to load observe state.";
    if (message === "Website not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[Observe] Failed to load owner state:", message);
    return NextResponse.json(
      { error: "Unable to load Google connection state right now." },
      { status: 500 },
    );
  }
}
