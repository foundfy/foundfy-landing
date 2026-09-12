"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseRescanResponse } from "@/lib/site/rescan-action";

export function useRescanNavigation(websiteId: string | null) {
  const router = useRouter();
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  const scanAgain = async () => {
    if (!websiteId || isRescanning) {
      return;
    }

    setIsRescanning(true);
    setRescanError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/scan`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = await response.json();
      const result = parseRescanResponse(response, payload);

      if (!result.ok) {
        setRescanError(result.error);
        return;
      }

      router.push(`/scan/${result.crawlRunId}`);
    } catch {
      setRescanError("Unable to start scan right now.");
    } finally {
      setIsRescanning(false);
    }
  };

  return {
    scanAgain,
    isRescanning,
    rescanError,
  };
}
