import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
import {
  formatAnalyzingScopeCopy,
  formatCompletedScopeCopy,
} from "./analysis-scope";

describe("analysis scope disclosure", () => {
  it("states the analyzing page cap without implying a full-site audit", () => {
    expect(MAX_PAGES_PER_CRAWL).toBe(10);
    expect(formatAnalyzingScopeCopy()).toBe("Analyzing up to 10 pages");
  });

  it("states the completed page count, including counts below the cap", () => {
    expect(formatCompletedScopeCopy(7)).toBe("Based on 7 analyzed pages");
    expect(formatCompletedScopeCopy(10)).toBe("Based on 10 analyzed pages");
    expect(formatCompletedScopeCopy(1)).toBe("Based on 1 analyzed page");
  });

  it("surfaces the disclosure on landing, scan, and site current state", () => {
    const analyzingView = readFileSync(
      path.join(__dirname, "../../components/hero/AnalysisAnalyzingView.tsx"),
      "utf8",
    );
    const resultsView = readFileSync(
      path.join(__dirname, "../../components/hero/AnalysisResultsView.tsx"),
      "utf8",
    );
    const siteViewModel = readFileSync(
      path.join(__dirname, "../site/site-overview-view-model.ts"),
      "utf8",
    );
    const scanView = readFileSync(
      path.join(__dirname, "../../components/scan/ScanPageView.tsx"),
      "utf8",
    );

    expect(analyzingView).toContain("formatAnalyzingScopeCopy");
    expect(resultsView).toContain("formatCompletedScopeCopy");
    expect(resultsView).toContain("pagesCrawled");
    expect(scanView).toContain("pagesCrawled={payload.pagesCrawled}");
    expect(siteViewModel).toContain("formatCompletedScopeCopy");
  });
});
