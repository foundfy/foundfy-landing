import { NextResponse } from "next/server";
import { OBSERVE_SESSION_COOKIE } from "@/lib/gsc/config";
import {
  buildClearedSessionCookieOptions,
  readObserveSessionToken,
} from "@/lib/gsc/cookie";
import { disconnectObserveOwner } from "@/lib/gsc/observe";
import { ObserveAuthError } from "@/lib/gsc/types";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  try {
    await disconnectObserveOwner({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      OBSERVE_SESSION_COOKIE,
      "",
      buildClearedSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof ObserveAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unable to disconnect.";
    if (message === "Website not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[Observe] Failed to disconnect Google account:", message);
    return NextResponse.json(
      { error: "Unable to disconnect right now." },
      { status: 500 },
    );
  }
}
