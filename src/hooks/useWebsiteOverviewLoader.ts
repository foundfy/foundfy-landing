"use client";

import { useCallback, useEffect, useState } from "react";
import type { WebsiteOverview } from "@/lib/websites/types";

export type WebsiteOverviewViewState =
  | { phase: "loading" }
  | { phase: "not_found"; errorMessage: string }
  | { phase: "error"; errorMessage: string }
  | { phase: "ready"; overview: WebsiteOverview };

const FETCH_OPTIONS: RequestInit = {
  cache: "no-store",
};

export function useWebsiteOverviewLoader(websiteId: string) {
  const [state, setState] = useState<WebsiteOverviewViewState>({ phase: "loading" });

  const reload = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const response = await fetch(`/api/websites/${websiteId}`, FETCH_OPTIONS);
      const payload = (await response.json()) as WebsiteOverview & { error?: string };

      if (response.status === 404) {
        setState({
          phase: "not_found",
          errorMessage: payload.error ?? "Website not found.",
        });
        return;
      }

      if (!response.ok) {
        setState({
          phase: "error",
          errorMessage: payload.error ?? "Unable to load website overview.",
        });
        return;
      }

      setState({ phase: "ready", overview: payload });
    } catch {
      setState({
        phase: "error",
        errorMessage: "Unable to load website overview.",
      });
    }
  }, [websiteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
