import { describe, expect, it } from "vitest";
import {
  formatEmptyHighlightsCopy,
  formatFindingEvidence,
  formatFindingsCount,
  formatPriorityLabel,
  formatZeroFindingsCopy,
} from "./finding-display";
import type { AnalysisFinding } from "./crawl-status";

const redirectFinding: AnalysisFinding = {
  id: "finding-1",
  ruleKey: "indexability.redirecting_url",
  category: "indexability",
  severity: "info",
  title: "URL redirects before final page",
  description: "The requested URL redirects to a different final URL.",
  pageUrl: "https://foundfy.me/",
  evidence: {
    requestedUrl: "https://foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
  },
  priority: {
    level: "low",
    rank: 1,
    whyItMatters: "Redirects add an extra hop.",
    recommendedAction: "Use the final URL where possible.",
    verification: null,
  },
};

describe("formatFindingEvidence", () => {
  it("formats redirect findings from evidence", () => {
    expect(formatFindingEvidence(redirectFinding)).toBe(
      "308 redirect → https://www.foundfy.me/",
    );
  });
});

describe("formatFindingsCount", () => {
  it("uses singular copy for one finding", () => {
    expect(formatFindingsCount(1)).toBe("We found 1 finding.");
  });

  it("uses plural copy for multiple findings", () => {
    expect(formatFindingsCount(3)).toBe("We found 3 findings.");
  });
});

describe("formatPriorityLabel", () => {
  it("maps priority levels to user-facing labels", () => {
    expect(formatPriorityLabel("critical")).toBe("Critical");
    expect(formatPriorityLabel("low")).toBe("Low");
  });
});

describe("results copy", () => {
  it("uses Foundfy-safe zero findings copy", () => {
    expect(formatZeroFindingsCopy()).toEqual({
      title: "No notable issues found.",
      description: "We didn't find any of the issues Foundfy currently checks for.",
    });
  });

  it("uses non-urgent empty highlight copy", () => {
    expect(formatEmptyHighlightsCopy()).toEqual({
      title: "Nothing stands out as a priority.",
      description: "You can still review the findings below.",
    });
  });
});
