import { NextResponse } from "next/server";
import { OBSERVE_SESSION_COOKIE } from "@/lib/gsc/config";
import { buildSessionCookieOptions } from "@/lib/gsc/cookie";
import { completeGoogleOAuth } from "@/lib/gsc/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const completed = await completeGoogleOAuth({
    requestUrl: request.url,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    oauthError: url.searchParams.get("error"),
  });

  const redirectUrl = new URL(completed.redirectUrl, url.origin);
  const response = NextResponse.redirect(redirectUrl, 302);

  if (completed.sessionToken) {
    response.cookies.set(
      OBSERVE_SESSION_COOKIE,
      completed.sessionToken,
      buildSessionCookieOptions(),
    );
  }

  return response;
}
