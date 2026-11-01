"use client";

import { useEffect, useRef, useState } from "react";
import { visibleGoogleEvidenceForWebsite } from "@/lib/foundations/evaluate";
import {
  googleInputFromResponse,
  shouldCommitGooglePerformanceResponse,
} from "@/lib/foundations/google-input";
import type { StoredGooglePerformanceEvidence } from "@/lib/foundations/types";

export function useGooglePerformanceEvidence(
  websiteId: string,
): StoredGooglePerformanceEvidence {
  const websiteIdRef = useRef(websiteId);
  websiteIdRef.current = websiteId;
  const [google, setGoogle] = useState<StoredGooglePerformanceEvidence>({
    websiteId,
    evidence: null,
  });

  useEffect(() => {
    let cancelled = false;
    const requestedWebsiteId = websiteId;
    setGoogle({ websiteId: requestedWebsiteId, evidence: null });

    async function loadGooglePerformance() {
      try {
        const response = await fetch(
          `/api/websites/${requestedWebsiteId}/observe/search-analytics`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          empty?: boolean;
          windowDays?: number;
          summary?: { queriesReported?: number };
        };

        if (
          !shouldCommitGooglePerformanceResponse({
            cancelled,
            requestedWebsiteId,
            currentWebsiteId: websiteIdRef.current,
          })
        ) {
          return;
        }

        setGoogle({
          websiteId: requestedWebsiteId,
          evidence: googleInputFromResponse(response.status, payload),
        });
      } catch {
        if (
          !shouldCommitGooglePerformanceResponse({
            cancelled,
            requestedWebsiteId,
            currentWebsiteId: websiteIdRef.current,
          })
        ) {
          return;
        }

        setGoogle({ websiteId: requestedWebsiteId, evidence: { kind: "unavailable" } });
      }
    }

    void loadGooglePerformance();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  return visibleGoogleEvidenceForWebsite(google, websiteId);
}
