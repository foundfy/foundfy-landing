import { describe, expect, it } from "vitest";
import {
  buildFullAnalysisHref,
  getLandingScanPageLinkLabel,
  getScanResultsResetLabel,
  getSiteScanLinkLabel,
  shouldShowLandingFullAnalysisLink,
} from "./landing-persistent-bridge";

describe("landing persistent bridge", () => {
  it("links completed landing results to the canonical scan route", () => {
    expect(buildFullAnalysisHref("run-abc-123")).toBe("/scan/run-abc-123");
    expect(getLandingScanPageLinkLabel()).toBe("Open scan page →");
    expect(getSiteScanLinkLabel()).toBe("View this scan →");
    expect(getScanResultsResetLabel(true)).toBe("View site overview");
    expect(getScanResultsResetLabel(false)).toBe("Back to home");
  });

  it("shows full analysis only for completed results with a crawl id", () => {
    expect(
      shouldShowLandingFullAnalysisLink({
        phase: "completed",
        crawlRunId: "run-abc-123",
      }),
    ).toBe(true);
  });

  it("does not show full analysis while analyzing", () => {
    expect(
      shouldShowLandingFullAnalysisLink({
        phase: "starting",
        crawlRunId: "run-abc-123",
      }),
    ).toBe(false);
  });

  it("does not show full analysis for failed results", () => {
    expect(
      shouldShowLandingFullAnalysisLink({
        phase: "failed",
        crawlRunId: "run-abc-123",
      }),
    ).toBe(false);
  });

  it("does not show full analysis without a crawl id", () => {
    expect(
      shouldShowLandingFullAnalysisLink({
        phase: "completed",
        crawlRunId: null,
      }),
    ).toBe(false);
  });

  it("preserves crawl run id independently from poll progress updates", () => {
    let crawlRunId: string | null = null;

    const setCrawlRunId = (nextId: string) => {
      crawlRunId = nextId;
    };

    const updateCrawlProgress = () => {
      // Poll updates findings/status without touching crawlRunId.
    };

    setCrawlRunId("run-abc-123");
    updateCrawlProgress();
    updateCrawlProgress();

    expect(crawlRunId).toBe("run-abc-123");
    expect(
      shouldShowLandingFullAnalysisLink({
        phase: "completed",
        crawlRunId,
      }),
    ).toBe(true);
  });
});
