"use client";

import { useEffect, useRef, useState } from "react";
import {
  VISUAL_PROGRESS,
  createVisualProgressRuntime,
  reduceVisualProgress,
} from "@/lib/analysis/crawl-progress";
import type { CrawlLifecycleStatus } from "@/lib/analysis/crawl-status";

const FRAME_MS = 80;

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reducedMotion;
}

export function useCrawlProgressAnimation(input: {
  crawlStatus: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  maxPages: number;
  onCompletionReady?: () => void;
}) {
  const { crawlStatus, pagesCrawled, maxPages, onCompletionReady } = input;
  const reducedMotion = usePrefersReducedMotion();
  const [displayProgress, setDisplayProgress] = useState(() =>
    crawlStatus && crawlStatus !== "failed" ? VISUAL_PROGRESS.initial : 0,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const runtimeRef = useRef(createVisualProgressRuntime());
  const onCompletionReadyRef = useRef(onCompletionReady);

  onCompletionReadyRef.current = onCompletionReady;

  useEffect(() => {
    if (crawlStatus === "queued" || crawlStatus === null) {
      runtimeRef.current = createVisualProgressRuntime();
      setElapsedMs(0);
      setDisplayProgress(
        crawlStatus === "queued" ? VISUAL_PROGRESS.initial : 0,
      );
    }
  }, [crawlStatus]);

  useEffect(() => {
    if (!crawlStatus || crawlStatus === "failed") {
      return;
    }

    let frameId = 0;

    const tick = () => {
      const now = Date.now();
      const { runtime, shouldNotifyCompletion } = reduceVisualProgress(
        runtimeRef.current,
        {
          status: crawlStatus,
          pagesCrawled,
          maxPages,
          now,
          reducedMotion,
        },
      );

      runtimeRef.current = runtime;
      setDisplayProgress(runtime.progress);
      setElapsedMs(runtime.startedAt ? now - runtime.startedAt : 0);

      if (shouldNotifyCompletion) {
        onCompletionReadyRef.current?.();
      }

      frameId = window.setTimeout(tick, FRAME_MS);
    };

    frameId = window.setTimeout(tick, FRAME_MS);

    return () => {
      window.clearTimeout(frameId);
    };
  }, [crawlStatus, pagesCrawled, maxPages, reducedMotion]);

  return {
    progress: displayProgress,
    elapsedMs,
  };
}
