"use client";

import { useEffect, useRef, useState } from "react";
import {
  easeProgress,
  getProgressTarget,
} from "@/lib/analysis/crawl-progress";
import type { CrawlLifecycleStatus } from "@/lib/analysis/crawl-status";

const FRAME_MS = 80;

export function useCrawlProgressAnimation(input: {
  crawlStatus: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  maxPages: number;
  onCompletionReady?: () => void;
}) {
  const { crawlStatus, pagesCrawled, maxPages, onCompletionReady } = input;
  const [displayProgress, setDisplayProgress] = useState(0);
  const runningStartedAtRef = useRef<number | null>(null);
  const completionNotifiedRef = useRef(false);
  const onCompletionReadyRef = useRef(onCompletionReady);

  onCompletionReadyRef.current = onCompletionReady;

  useEffect(() => {
    if (crawlStatus === "running" && runningStartedAtRef.current === null) {
      runningStartedAtRef.current = Date.now();
    }

    if (crawlStatus === "queued" || crawlStatus === null) {
      runningStartedAtRef.current = null;
      completionNotifiedRef.current = false;
    }
  }, [crawlStatus]);

  useEffect(() => {
    if (!crawlStatus || crawlStatus === "failed") {
      return;
    }

    let frameId = 0;
    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      const runningElapsedMs =
        crawlStatus === "running" && runningStartedAtRef.current
          ? now - runningStartedAtRef.current
          : 0;

      const target = getProgressTarget(
        crawlStatus,
        pagesCrawled,
        maxPages,
        runningElapsedMs,
      );

      setDisplayProgress((current) => {
        const next =
          crawlStatus === "completed" ? 1 : easeProgress(current, target);

        if (
          crawlStatus === "completed" &&
          next >= 0.995 &&
          !completionNotifiedRef.current
        ) {
          completionNotifiedRef.current = true;
          onCompletionReadyRef.current?.();
        }

        return next;
      });

      frameId = window.setTimeout(tick, FRAME_MS);
    };

    frameId = window.setTimeout(tick, FRAME_MS);

    return () => {
      window.clearTimeout(frameId);
    };
  }, [crawlStatus, pagesCrawled, maxPages]);

  return displayProgress;
}
