import { NextResponse } from "next/server";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { ResearchGateError, ResearchProviderError } from "./errors";

export function researchErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof ResearchGateError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  if (error instanceof ResearchProviderError) {
    const status =
      error.code === "unauthorized"
        ? 502
        : error.code === "rate_limited"
          ? 429
          : 502;
    return NextResponse.json(
      { error: fallback, code: error.code },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  return observeErrorResponse(error, fallback);
}

export { observeJson };
