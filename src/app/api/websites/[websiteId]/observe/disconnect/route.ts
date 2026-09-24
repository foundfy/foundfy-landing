import { NextResponse } from "next/server";
import { OBSERVE_SESSION_COOKIE } from "@/lib/gsc/config";
import {
  buildClearedSessionCookieOptions,
  readObserveSessionToken,
} from "@/lib/gsc/cookie";
import { observeErrorResponse } from "@/lib/gsc/http";
import { disconnectObserveOwner } from "@/lib/gsc/observe";
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
    return observeErrorResponse(error, "Unable to disconnect right now.");
  }
}
