import { formatAnalyzingScopeCopy } from "./analysis-scope";
import type { CrawlLifecycleStatus } from "./crawl-status";

export const VISUAL_PROGRESS = {
  initial: 0.01,
  runningCeiling: 0.86,
  maxLead: 0.07,
  realSpan: 0.78,
  ambientTauMs: 24_000,
  reducedAmbientTauMs: 7_000,
  easeAck: 0.4,
  easeSteady: 0.16,
  easeNearEnd: 0.08,
  easeComplete: 0.32,
  easeReduced: 0.55,
  earlyEaseUntil: 0.08,
  nearEndFrom: 0.72,
  completionThreshold: 0.985,
  completionHoldMs: 420,
  completionHoldReducedMs: 180,
} as const;

export const LIVE_RESULT_SHELL = {
  revealAfterMs: 5_000,
} as const;

export const LIVE_SCAN_COPY = {
  title: formatAnalyzingScopeCopy(),
  pendingFindings: "New findings will appear as we discover them.",
} as const;

export const ANALYZING_COPY = [
  "Reading your site…",
  "Checking search signals…",
  "Finding what matters…",
  "Prioritizing opportunities…",
] as const;

const ANALYZING_COPY_INTERVAL_MS = 16_000;

export type VisualProgressInput = {
  status: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  maxPages: number;
  elapsedMs?: number;
  plateauMs?: number;
  reducedMotion?: boolean;
};

export type VisualProgressRuntime = {
  progress: number;
  startedAt: number | null;
  lastPagesCrawled: number | null;
  plateauStartedAt: number | null;
  completionVisualAt: number | null;
  completionNotified: boolean;
};

export function createVisualProgressRuntime(): VisualProgressRuntime {
  return {
    progress: 0,
    startedAt: null,
    lastPagesCrawled: null,
    plateauStartedAt: null,
    completionVisualAt: null,
    completionNotified: false,
  };
}

export function getMappedRealProgress(
  pagesCrawled: number,
  maxPages: number,
): number {
  const pageRatio =
    maxPages > 0 ? Math.min(Math.max(pagesCrawled, 0) / maxPages, 1) : 0;

  return VISUAL_PROGRESS.initial + pageRatio * VISUAL_PROGRESS.realSpan;
}

export function getAmbientLead(plateauMs: number, reducedMotion = false): number {
  const tau = reducedMotion
    ? VISUAL_PROGRESS.reducedAmbientTauMs
    : VISUAL_PROGRESS.ambientTauMs;
  const safeMs = Math.max(0, plateauMs);

  return VISUAL_PROGRESS.maxLead * (1 - Math.exp(-safeMs / tau));
}

export function getProgressTarget(input: VisualProgressInput): number {
  const { status, pagesCrawled, maxPages, reducedMotion = false } = input;

  if (status === "completed") {
    return 1;
  }

  if (!status || status === "failed") {
    return 0;
  }

  const mapped = getMappedRealProgress(pagesCrawled, maxPages);
  const plateauMs = input.plateauMs ?? input.elapsedMs ?? 0;
  const lead = getAmbientLead(plateauMs, reducedMotion);

  return Math.min(VISUAL_PROGRESS.runningCeiling, mapped + lead);
}

export function easeProgress(
  current: number,
  target: number,
  options?: { reducedMotion?: boolean; completing?: boolean },
): number {
  if (target === current) {
    return current;
  }

  if (target < current && !options?.completing) {
    return current;
  }

  const delta = target - current;
  let factor: number = VISUAL_PROGRESS.easeSteady;

  if (options?.reducedMotion) {
    factor = VISUAL_PROGRESS.easeReduced;
  } else if (options?.completing) {
    factor = VISUAL_PROGRESS.easeComplete;
  } else if (current < VISUAL_PROGRESS.earlyEaseUntil) {
    factor = VISUAL_PROGRESS.easeAck;
  } else if (current >= VISUAL_PROGRESS.nearEndFrom) {
    factor = VISUAL_PROGRESS.easeNearEnd;
  }

  const next = current + delta * factor;

  if (delta > 0) {
    return Math.min(target, next);
  }

  return Math.max(target, next);
}

export function shouldShowLiveResultShell(input: {
  status: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  elapsedMs: number;
}): boolean {
  const { status, pagesCrawled, elapsedMs } = input;

  if (!status || status === "failed" || status === "completed") {
    return false;
  }

  return pagesCrawled > 0 || elapsedMs >= LIVE_RESULT_SHELL.revealAfterMs;
}

export function formatLiveScanPageCount(pagesCrawled: number): string {
  const count = Math.max(0, pagesCrawled);

  if (count === 1) {
    return "1 page checked so far";
  }

  return `${count} pages checked so far`;
}

export function getCrawlStatusCopy(
  status: CrawlLifecycleStatus | null,
  elapsedMs = 0,
): string {
  if (status === "completed") {
    return "Analysis complete";
  }

  if (status === "failed") {
    return "Analysis could not be completed";
  }

  const index =
    Math.floor(Math.max(0, elapsedMs) / ANALYZING_COPY_INTERVAL_MS) %
    ANALYZING_COPY.length;

  return ANALYZING_COPY[index];
}

export function reduceVisualProgress(
  runtime: VisualProgressRuntime,
  input: {
    status: CrawlLifecycleStatus | null;
    pagesCrawled: number;
    maxPages: number;
    now: number;
    reducedMotion?: boolean;
  },
): { runtime: VisualProgressRuntime; shouldNotifyCompletion: boolean } {
  const reducedMotion = input.reducedMotion ?? false;

  if (!input.status || input.status === "failed") {
    return {
      runtime: {
        ...runtime,
        completionVisualAt: null,
      },
      shouldNotifyCompletion: false,
    };
  }

  const next: VisualProgressRuntime = { ...runtime };

  if (next.startedAt === null) {
    next.startedAt = input.now;
    next.plateauStartedAt = input.now;
    next.lastPagesCrawled = input.pagesCrawled;
    next.progress = Math.max(next.progress, VISUAL_PROGRESS.initial);
  }

  if (next.lastPagesCrawled !== input.pagesCrawled) {
    next.lastPagesCrawled = input.pagesCrawled;
    next.plateauStartedAt = input.now;
  }

  const elapsedMs = input.now - next.startedAt;
  const plateauMs = input.now - (next.plateauStartedAt ?? next.startedAt);

  const target = getProgressTarget({
    status: input.status,
    pagesCrawled: input.pagesCrawled,
    maxPages: input.maxPages,
    elapsedMs,
    plateauMs,
    reducedMotion,
  });

  next.progress = easeProgress(next.progress, target, {
    reducedMotion,
    completing: input.status === "completed",
  });

  let shouldNotifyCompletion = false;

  if (input.status === "completed") {
    if (next.progress >= VISUAL_PROGRESS.completionThreshold) {
      if (next.completionVisualAt === null) {
        next.completionVisualAt = input.now;
      }

      const hold = reducedMotion
        ? VISUAL_PROGRESS.completionHoldReducedMs
        : VISUAL_PROGRESS.completionHoldMs;

      if (
        !next.completionNotified &&
        input.now - next.completionVisualAt >= hold
      ) {
        next.completionNotified = true;
        shouldNotifyCompletion = true;
      }
    }
  } else {
    next.completionVisualAt = null;
    next.completionNotified = false;
  }

  return { runtime: next, shouldNotifyCompletion };
}
