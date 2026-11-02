"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { visibleGoogleEvidenceForWebsite } from "@/lib/foundations/evaluate";
import {
  googleInputFromResponse,
  googlePerformanceLoadErrorFromResponse,
  googlePerformanceViewFromResponse,
  shouldCommitGooglePerformanceResponse,
  shouldRetryGooglePerformanceAttempt,
} from "@/lib/foundations/google-input";
import type { StoredGooglePerformanceEvidence } from "@/lib/foundations/types";

export type GooglePerformanceEvidenceController = {
  snapshot: StoredGooglePerformanceEvidence;
  reload: () => void;
};

type GooglePerformanceFetchResult = {
  status: number | null;
  payload: {
    status?: string;
    empty?: boolean;
    windowDays?: number;
    summary?: { queriesReported?: number };
    error?: string;
  };
};

function snapshotFromFetch(
  websiteId: string,
  result: GooglePerformanceFetchResult,
): StoredGooglePerformanceEvidence {
  if (result.status === null) {
    return {
      websiteId,
      evidence: { kind: "unavailable" },
      view: null,
      loadError: null,
    };
  }

  return {
    websiteId,
    evidence: googleInputFromResponse(result.status, result.payload),
    view: googlePerformanceViewFromResponse(result.status, result.payload),
    loadError: googlePerformanceLoadErrorFromResponse(result.status, result.payload.error),
  };
}

export function useGooglePerformanceEvidence(
  websiteId: string,
): GooglePerformanceEvidenceController {
  const websiteIdRef = useRef(websiteId);
  websiteIdRef.current = websiteId;
  const generationRef = useRef(0);
  const [google, setGoogle] = useState<StoredGooglePerformanceEvidence>({
    websiteId,
    evidence: null,
    view: null,
    loadError: null,
  });

  const runLoad = useCallback(async (requestedWebsiteId: string) => {
    const requestGeneration = ++generationRef.current;
    setGoogle((current) =>
      current.websiteId === requestedWebsiteId
        ? current
        : { websiteId: requestedWebsiteId, evidence: null, view: null, loadError: null },
    );

    async function fetchOnce(): Promise<GooglePerformanceFetchResult> {
      try {
        const response = await fetch(
          `/api/websites/${requestedWebsiteId}/observe/search-analytics`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as GooglePerformanceFetchResult["payload"];
        return { status: response.status, payload };
      } catch {
        return { status: null, payload: {} };
      }
    }

    function canCommit(): boolean {
      return shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId,
        currentWebsiteId: websiteIdRef.current,
        requestGeneration,
        latestGeneration: generationRef.current,
      });
    }

    const first = await fetchOnce();
    const result =
      shouldRetryGooglePerformanceAttempt({ attempt: 0, status: first.status }) && canCommit()
        ? await fetchOnce()
        : first;

    if (!canCommit()) {
      return;
    }

    setGoogle(snapshotFromFetch(requestedWebsiteId, result));
  }, []);

  useEffect(() => {
    void runLoad(websiteId);
    return () => {
      generationRef.current += 1;
    };
  }, [websiteId, runLoad]);

  const reload = useCallback(() => {
    void runLoad(websiteIdRef.current);
  }, [runLoad]);

  return {
    snapshot: visibleGoogleEvidenceForWebsite(google, websiteId),
    reload,
  };
}
