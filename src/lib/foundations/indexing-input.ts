import { GOOGLE_ACCESS_EXPIRED_ERROR } from "./google-input";
import type { GoogleIndexingEvidenceInput, StoredGoogleIndexingEvidence } from "./types";

export function shouldCommitGoogleIndexingResponse(input: {
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

export function googleIndexingFromResponse(
  status: number,
  payload: GoogleIndexingEvidenceInput | { error?: string; code?: string },
): GoogleIndexingEvidenceInput {
  if (status === 401) {
    if ("error" in payload && payload.error === GOOGLE_ACCESS_EXPIRED_ERROR) {
      return { kind: "expired" };
    }
    return { kind: "no_session" };
  }

  if (status === 403) {
    if ("code" in payload && payload.code === "pilot_ineligible") {
      return { kind: "pilot_ineligible" };
    }
    return { kind: "not_connected" };
  }

  if (status < 200 || status >= 300) {
    const code =
      "code" in payload &&
      (payload.code === "quota" || payload.code === "malformed" || payload.code === "unavailable")
        ? payload.code
        : "unavailable";
    return { kind: "unavailable", code };
  }

  if ("kind" in payload && payload.kind === "checked") {
    return payload;
  }

  return { kind: "unavailable", code: "malformed" };
}

export function googleIndexingLoadErrorFromResponse(
  status: number,
  error: string | undefined,
): string | null {
  if (status >= 200 && status < 300) {
    return null;
  }

  return typeof error === "string" && error.length > 0 ? error : null;
}

export function emptyIndexingSnapshot(websiteId: string): StoredGoogleIndexingEvidence {
  return {
    websiteId,
    evidence: { kind: "not_checked" },
    loadError: null,
  };
}

export function nextGoogleIndexingSnapshot(input: {
  previous: StoredGoogleIndexingEvidence;
  websiteId: string;
  status: number;
  payload: GoogleIndexingEvidenceInput | { error?: string; code?: string };
}): StoredGoogleIndexingEvidence {
  const evidence = googleIndexingFromResponse(input.status, input.payload);
  const loadError = googleIndexingLoadErrorFromResponse(
    input.status,
    "error" in input.payload ? input.payload.error : undefined,
  );

  if (evidence.kind === "checked") {
    return {
      websiteId: input.websiteId,
      evidence,
      loadError: null,
    };
  }

  if (
    input.previous.websiteId === input.websiteId &&
    input.previous.evidence?.kind === "checked"
  ) {
    return {
      websiteId: input.websiteId,
      evidence: input.previous.evidence,
      loadError: loadError ?? "Foundfy could not complete a new Google indexing check.",
    };
  }

  return {
    websiteId: input.websiteId,
    evidence,
    loadError,
  };
}
