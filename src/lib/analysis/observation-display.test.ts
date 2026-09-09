import { describe, expect, it } from "vitest";
import {
  formatObservationCount,
  formatObservationEvidence,
} from "./observation-display";
import type { AnalysisObservation } from "./crawl-status";

const redirectObservation: AnalysisObservation = {
  id: "obs-1",
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
};

describe("formatObservationEvidence", () => {
  it("formats redirect observations from evidence", () => {
    expect(formatObservationEvidence(redirectObservation)).toBe(
      "308 redirect → https://www.foundfy.me/",
    );
  });
});

describe("formatObservationCount", () => {
  it("uses singular copy for one observation", () => {
    expect(formatObservationCount(1)).toBe("We found 1 thing worth noting.");
  });

  it("uses plural copy for multiple observations", () => {
    expect(formatObservationCount(3)).toBe("We found 3 things worth noting.");
  });
});
