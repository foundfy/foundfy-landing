"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { visibleGoogleIndexingForWebsite } from "@/lib/foundations/evaluate";
import {
  emptyIndexingSnapshot,
  googleIndexingFromResponse,
  googleIndexingLoadErrorFromResponse,
  shouldCommitGoogleIndexingResponse,
} from "@/lib/foundations/indexing-input";
import type {
  GoogleIndexingEvidenceInput,
  StoredGoogleIndexingEvidence,
} from "@/lib/foundations/types";

export type GoogleIndexingEvidenceController = {
  snapshot: StoredGoogleIndexingEvidence;
  checking: boolean;
  check: () => void;
  applyPilotEligibility: (eligible: boolean) => void;
};

type IndexingFetchPayload = GoogleIndexingEvidenceInput | { error?: string; code?: string };

export function useGoogleIndexingEvidence(websiteId: string): GoogleIndexingEvidenceController {
  const websiteIdRef = useRef(websiteId);
  websiteIdRef.current = websiteId;
  const generationRef = useRef(0);
  const [snapshot, setSnapshot] = useState<StoredGoogleIndexingEvidence>(() =>
    emptyIndexingSnapshot(websiteId),
  );
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    generationRef.current += 1;
    setSnapshot(emptyIndexingSnapshot(websiteId));
    setChecking(false);
    return () => {
      generationRef.current += 1;
    };
  }, [websiteId]);

  const applyPilotEligibility = useCallback((eligible: boolean) => {
    const currentWebsiteId = websiteIdRef.current;
    setSnapshot((current) => {
      if (current.websiteId !== currentWebsiteId) {
        return current;
      }

      if (!eligible) {
        return {
          websiteId: currentWebsiteId,
          evidence: { kind: "pilot_ineligible" },
          loadError: null,
        };
      }

      if (current.evidence?.kind === "pilot_ineligible") {
        return emptyIndexingSnapshot(currentWebsiteId);
      }

      return current;
    });
  }, []);

  const check = useCallback(async () => {
    const requestedWebsiteId = websiteIdRef.current;
    const requestGeneration = ++generationRef.current;
    setChecking(true);

    let status: number | null = null;
    let payload: IndexingFetchPayload = {};
    try {
      const response = await fetch(
        `/api/websites/${requestedWebsiteId}/observe/indexing/check`,
        { method: "POST", cache: "no-store" },
      );
      status = response.status;
      payload = (await response.json().catch(() => ({}))) as IndexingFetchPayload;
    } catch {
      status = null;
      payload = {};
    }

    if (
      !shouldCommitGoogleIndexingResponse({
        cancelled: false,
        requestedWebsiteId,
        currentWebsiteId: websiteIdRef.current,
        requestGeneration,
        latestGeneration: generationRef.current,
      })
    ) {
      return;
    }

    const mappedStatus = status ?? 0;
    setSnapshot({
      websiteId: requestedWebsiteId,
      evidence: googleIndexingFromResponse(mappedStatus, payload),
      loadError: googleIndexingLoadErrorFromResponse(
        mappedStatus,
        "error" in payload ? payload.error : undefined,
      ),
    });
    setChecking(false);
  }, []);

  return {
    snapshot: visibleGoogleIndexingForWebsite(snapshot, websiteId),
    checking,
    check,
    applyPilotEligibility,
  };
}
