import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYZING_COPY,
  VISUAL_PROGRESS,
  createVisualProgressRuntime,
  getAmbientLead,
  getCrawlStatusCopy,
  getMappedRealProgress,
  getProgressTarget,
  reduceVisualProgress,
} from "./crawl-progress";

function step(
  runtime: ReturnType<typeof createVisualProgressRuntime>,
  input: {
    status: "queued" | "running" | "completed" | "failed";
    pagesCrawled: number;
    maxPages: number;
    now: number;
    reducedMotion?: boolean;
  },
) {
  return reduceVisualProgress(runtime, input);
}

describe("getCrawlStatusCopy", () => {
  it("rotates restrained ambient messages while analyzing", () => {
    expect(getCrawlStatusCopy("queued", 0)).toBe("Reading your site…");
    expect(getCrawlStatusCopy("running", 16_000)).toBe(
      "Checking search signals…",
    );
    expect(getCrawlStatusCopy("running", 32_000)).toBe("Finding what matters…");
    expect(getCrawlStatusCopy("running", 48_000)).toBe(
      "Prioritizing opportunities…",
    );
  });

  it("avoids crawler jargon", () => {
    const copy = [
      getCrawlStatusCopy("queued", 0),
      getCrawlStatusCopy("running", 20_000),
      getCrawlStatusCopy("running", 40_000),
      getCrawlStatusCopy("completed"),
      ...ANALYZING_COPY,
    ].join(" ");

    expect(copy).not.toMatch(/bfs|worker|queue|sitemap|observation|stale|poll/i);
    expect(copy).not.toContain("Preparing crawl");
    expect(copy).not.toContain("Crawling pages");
  });

  it("uses a completion message only after the backend finishes", () => {
    expect(getCrawlStatusCopy("completed")).toBe("Analysis complete");
    expect(getCrawlStatusCopy("failed")).toBe(
      "Analysis could not be completed",
    );
  });
});

describe("visual analyzing progress", () => {
  it("starts visual progress immediately after Analyze", () => {
    const first = step(createVisualProgressRuntime(), {
      status: "queued",
      pagesCrawled: 0,
      maxPages: 10,
      now: 1_000,
    });

    expect(first.runtime.progress).toBeGreaterThanOrEqual(
      VISUAL_PROGRESS.initial,
    );
    expect(
      getProgressTarget({
        status: "queued",
        pagesCrawled: 0,
        maxPages: 10,
        elapsedMs: 0,
        plateauMs: 0,
      }),
    ).toBeGreaterThan(0);
  });

  it("never visually completes while the backend is still running", () => {
    let runtime = createVisualProgressRuntime();
    let now = 0;

    for (let index = 0; index < 80; index += 1) {
      now += 2_000;
      const next = step(runtime, {
        status: "running",
        pagesCrawled: 10,
        maxPages: 10,
        now,
      });
      runtime = next.runtime;

      expect(runtime.progress).toBeLessThan(VISUAL_PROGRESS.runningCeiling + 1e-6);
      expect(runtime.progress).toBeLessThan(0.87);
      expect(next.shouldNotifyCompletion).toBe(false);
    }

    expect(
      getProgressTarget({
        status: "running",
        pagesCrawled: 10,
        maxPages: 10,
        elapsedMs: 180_000,
        plateauMs: 180_000,
      }),
    ).toBeLessThanOrEqual(VISUAL_PROGRESS.runningCeiling);
  });

  it("lets real page progress raise the visual target", () => {
    const early = getProgressTarget({
      status: "running",
      pagesCrawled: 2,
      maxPages: 10,
      elapsedMs: 8_000,
      plateauMs: 1_000,
    });
    const later = getProgressTarget({
      status: "running",
      pagesCrawled: 8,
      maxPages: 10,
      elapsedMs: 8_000,
      plateauMs: 1_000,
    });

    expect(later).toBeGreaterThan(early);
    expect(later).not.toBeCloseTo(0.8);
    expect(early).not.toBeCloseTo(0.2);
  });

  it("keeps the visual lead bounded over mapped real progress", () => {
    const pagesCrawled = 3;
    const maxPages = 10;
    const mapped = getMappedRealProgress(pagesCrawled, maxPages);
    const target = getProgressTarget({
      status: "running",
      pagesCrawled,
      maxPages,
      elapsedMs: 120_000,
      plateauMs: 120_000,
    });

    expect(target - mapped).toBeLessThanOrEqual(VISUAL_PROGRESS.maxLead + 1e-6);
    expect(getAmbientLead(120_000)).toBeLessThanOrEqual(
      VISUAL_PROGRESS.maxLead + 1e-6,
    );
  });

  it("permits a smooth finish only after the backend completes", () => {
    let runtime = createVisualProgressRuntime();
    runtime = step(runtime, {
      status: "running",
      pagesCrawled: 9,
      maxPages: 10,
      now: 20_000,
    }).runtime;

    expect(runtime.progress).toBeLessThan(1);

    const justCompleted = step(runtime, {
      status: "completed",
      pagesCrawled: 10,
      maxPages: 10,
      now: 20_080,
    });

    expect(justCompleted.shouldNotifyCompletion).toBe(false);
    expect(justCompleted.runtime.progress).toBeGreaterThan(runtime.progress);

    let current = justCompleted.runtime;
    let notified = false;
    let now = 20_160;

    for (let index = 0; index < 40; index += 1) {
      const next = step(current, {
        status: "completed",
        pagesCrawled: 10,
        maxPages: 10,
        now,
      });
      current = next.runtime;
      if (next.shouldNotifyCompletion) {
        notified = true;
        break;
      }
      now += 80;
    }

    expect(current.progress).toBeGreaterThanOrEqual(
      VISUAL_PROGRESS.completionThreshold,
    );
    expect(notified).toBe(true);
    expect(now - 20_000).toBeLessThan(3_000);
  });

  it("does not show a successful completion when the crawl fails", () => {
    let runtime = createVisualProgressRuntime();
    runtime = step(runtime, {
      status: "running",
      pagesCrawled: 4,
      maxPages: 10,
      now: 12_000,
    }).runtime;

    const failed = step(runtime, {
      status: "failed",
      pagesCrawled: 4,
      maxPages: 10,
      now: 12_500,
    });

    expect(failed.runtime.progress).toBeLessThan(1);
    expect(failed.runtime.progress).not.toBe(1);
    expect(failed.shouldNotifyCompletion).toBe(false);
    expect(
      getProgressTarget({
        status: "failed",
        pagesCrawled: 4,
        maxPages: 10,
      }),
    ).toBe(0);
  });

  it("still communicates progress when reduced motion is preferred", () => {
    const first = step(createVisualProgressRuntime(), {
      status: "queued",
      pagesCrawled: 0,
      maxPages: 10,
      now: 0,
      reducedMotion: true,
    });
    const later = step(first.runtime, {
      status: "running",
      pagesCrawled: 6,
      maxPages: 10,
      now: 4_000,
      reducedMotion: true,
    });

    expect(first.runtime.progress).toBeGreaterThan(0);
    expect(later.runtime.progress).toBeGreaterThan(first.runtime.progress);
    expect(later.runtime.progress).toBeLessThan(VISUAL_PROGRESS.runningCeiling);
    expect(later.shouldNotifyCompletion).toBe(false);
  });

  it("uses one shared progress primitive for landing and /scan", () => {
    const analyzingView = readFileSync(
      path.join(__dirname, "../../components/hero/AnalysisAnalyzingView.tsx"),
      "utf8",
    );
    const scanView = readFileSync(
      path.join(__dirname, "../../components/scan/ScanPageView.tsx"),
      "utf8",
    );

    expect(analyzingView).toContain("useCrawlProgressAnimation");
    expect(analyzingView).toContain("getCrawlStatusCopy");
    expect(scanView).toContain("AnalysisAnalyzingViewInner");
    expect(scanView).not.toContain("useCrawlProgressAnimation");
  });
});
