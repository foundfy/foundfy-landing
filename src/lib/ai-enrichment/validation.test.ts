import { describe, expect, it } from "vitest";
import {
  parseExplanationModelPayload,
  validateExplanationOutput,
} from "./validation";
import type { ExplanationInputFinding } from "./types";

const finding: ExplanationInputFinding = {
  findingId: "finding-1",
  ruleKey: "indexability.redirecting_url",
  title: "URL redirects before final page",
  description: "The requested URL redirects to a different final URL.",
  pageUrl: "https://foundfy.me/",
  whitelistedEvidence: {
    requestedUrl: "https://foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
  },
  whyItMatters: "Redirects add an extra hop.",
};

describe("parseExplanationModelPayload", () => {
  it("rejects invalid structured output", () => {
    const result = parseExplanationModelPayload({ explanations: [] });
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "invalid_shape", message: "Model output must be an array." }],
    });
  });
});

describe("validateExplanationOutput", () => {
  it("rejects unknown finding IDs", () => {
    const result = validateExplanationOutput({
      output: {
        findingId: "missing-id",
        contextualExplanation: "Context",
        evidenceExplanation: "Evidence",
        citedEvidenceKeys: ["requestedUrl"],
      },
      finding,
      pagesCrawled: 1,
      allowedFindingIds: new Set(["finding-1"]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "unknown_finding_id")).toBe(
        true,
      );
    }
  });

  it("rejects unknown evidence citations", () => {
    const result = validateExplanationOutput({
      output: {
        findingId: "finding-1",
        contextualExplanation: "Context",
        evidenceExplanation: "Evidence",
        citedEvidenceKeys: ["inventedMetric"],
      },
      finding,
      pagesCrawled: 1,
      allowedFindingIds: new Set(["finding-1"]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((issue) => issue.code === "unknown_evidence_citation"),
      ).toBe(true);
    }
  });

  it("rejects ungrounded numeric claims", () => {
    const result = validateExplanationOutput({
      output: {
        findingId: "finding-1",
        contextualExplanation: "This could increase traffic by 40%.",
        evidenceExplanation: "Evidence",
        citedEvidenceKeys: ["requestedUrl"],
      },
      finding,
      pagesCrawled: 1,
      allowedFindingIds: new Set(["finding-1"]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((issue) => issue.code === "ungrounded_numeric_claim"),
      ).toBe(true);
    }
  });

  it("accepts grounded explanations", () => {
    const result = validateExplanationOutput({
      output: {
        findingId: "finding-1",
        contextualExplanation:
          "This redirect adds an extra hop before the final page loads.",
        evidenceExplanation:
          "The crawl requested https://foundfy.me/ and landed on https://www.foundfy.me/ via a 308 redirect.",
        citedEvidenceKeys: ["requestedUrl", "finalUrl", "redirectChain"],
      },
      finding,
      pagesCrawled: 1,
      allowedFindingIds: new Set(["finding-1"]),
    });

    expect(result.ok).toBe(true);
  });
});
