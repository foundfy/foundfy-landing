import type { GooglePerformanceEvidenceInput, StoredGooglePerformanceEvidence } from "./types";

export const GOOGLE_PERFORMANCE_TRANSIENT_RETRY_LIMIT = 1;

export function shouldCommitGooglePerformanceResponse(input: {
  cancelled: boolean;
  requestedWebsiteId: string;
  currentWebsiteId: string;
  requestGeneration: number;
  latestGeneration: number;
}): boolean {
  return (
    !input.cancelled &&
    input.requestedWebsiteId === input.currentWebsiteId &&
    input.requestGeneration === input.latestGeneration
  );
}

export function isTransientGooglePerformanceFailure(status: number | null): boolean {
  if (status === 401 || status === 403) {
    return false;
  }

  if (status === null) {
    return true;
  }

  return status >= 500;
}

export function shouldRetryGooglePerformanceAttempt(input: {
  attempt: number;
  status: number | null;
  retryLimit?: number;
}): boolean {
  const retryLimit = input.retryLimit ?? GOOGLE_PERFORMANCE_TRANSIENT_RETRY_LIMIT;
  if (input.attempt >= retryLimit) {
    return false;
  }

  return isTransientGooglePerformanceFailure(input.status);
}

export const GOOGLE_ACCESS_EXPIRED_ERROR = "Google access expired. Connect Google again.";
export const GOOGLE_OWNER_SESSION_REQUIRED_ERROR = "Owner session required.";

export type GooglePerformanceResponsePayload = {
  status?: string;
  empty?: boolean;
  windowDays?: number;
  summary?: { queriesReported?: number };
  error?: string;
};

export function googlePerformanceLoadErrorFromResponse(
  status: number,
  error: string | undefined,
): string | null {
  if (status >= 200 && status < 300) {
    return null;
  }

  return typeof error === "string" && error.length > 0 ? error : null;
}

export function googleAccessRecoveryCopyFromLoadError(loadError: string | null): string | null {
  if (loadError === GOOGLE_ACCESS_EXPIRED_ERROR) {
    return GOOGLE_ACCESS_EXPIRED_ERROR;
  }

  return null;
}

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

export function googlePerformanceViewFromResponse(
  status: number,
  payload: unknown,
): unknown | null {
  if (status < 200 || status >= 300) {
    return null;
  }

  return payload;
}

export function googlePerformanceSnapshotFromResponse(input: {
  websiteId: string;
  status: number;
  payload: GooglePerformanceResponsePayload;
}): StoredGooglePerformanceEvidence {
  return {
    websiteId: input.websiteId,
    evidence: googleInputFromResponse(input.status, input.payload),
    view: googlePerformanceViewFromResponse(input.status, input.payload),
    loadError: googlePerformanceLoadErrorFromResponse(input.status, input.payload.error),
  };
}
