import { NextResponse } from "next/server";
import { siteObservePath } from "@/lib/gsc/config";
import { GoogleOAuthNotConfiguredError, startGoogleOAuth } from "@/lib/gsc/oauth";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  try {
    const started = await startGoogleOAuth({
      websiteId,
      requestUrl: request.url,
    });

    return NextResponse.redirect(started.redirectUrl, 302);
  } catch (error) {
    if (error instanceof GoogleOAuthNotConfiguredError) {
      return NextResponse.redirect(new URL(siteObservePath(websiteId, "error"), request.url), 302);
    }

    const message = error instanceof Error ? error.message : "Unable to start Google connection.";
    if (message === "Website not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[Observe] Failed to start Google OAuth:", message);
    return NextResponse.json(
      { error: "Unable to start Google connection right now." },
      { status: 500 },
    );
  }
}
