import { NextResponse } from "next/server";
import {
  GoogleAuthExpiredError,
  GoogleSearchAnalyticsError,
  ObserveAuthError,
  SearchConsoleNotConnectedError,
  UnverifiedPropertyError,
} from "@/lib/gsc/types";

export function observeErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof ObserveAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof GoogleAuthExpiredError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof UnverifiedPropertyError || error instanceof SearchConsoleNotConnectedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof GoogleSearchAnalyticsError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
  }

  const message = error instanceof Error ? error.message : fallback;
  if (message === "Website not found.") {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  console.error("[Observe]", fallback, message);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function observeJson(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
    },
  });
}
