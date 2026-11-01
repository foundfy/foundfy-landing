import type { GooglePerformanceEvidenceInput } from "./types";

export function shouldCommitGooglePerformanceResponse(input: {
  cancelled: boolean;
  requestedWebsiteId: string;
  currentWebsiteId: string;
}): boolean {
  return !input.cancelled && input.requestedWebsiteId === input.currentWebsiteId;
}

export type GooglePerformanceResponsePayload = {
  status?: string;
  empty?: boolean;
  windowDays?: number;
  summary?: { queriesReported?: number };
};

export function googleInputFromResponse(
  status: number,
  payload: GooglePerformanceResponsePayload,
): GooglePerformanceEvidenceInput {
  if (status === 401) {
    return { kind: "no_session" };
  }

  if (status === 403) {
    return { kind: "not_connected" };
  }

  if (status < 200 || status >= 300) {
    return { kind: "unavailable" };
  }

  if (payload.status === "not_synced") {
    return { kind: "not_synced" };
  }

  if (payload.empty) {
    return { kind: "empty", windowDays: payload.windowDays ?? 28 };
  }

  return {
    kind: "reported",
    windowDays: payload.windowDays ?? 28,
    queriesReported: payload.summary?.queriesReported ?? 0,
  };
}
