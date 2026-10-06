import { describe, expect, it } from "vitest";
import {
  evaluateMetaDescriptionVerification,
  pageUrlsEquivalent,
  pageWasFetchedSuccessfully,
  type VerificationPageEvidence,
} from "./verification";

const EXPECTED = "Foundfy turns on-page SEO insights into clear actions.";

function page(overrides: Partial<VerificationPageEvidence> = {}): VerificationPageEvidence {
  return {
    id: "page-fresh",
    requestedUrl: "https://www.foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    statusCode: 200,
    metaDescription: EXPECTED,
    ...overrides,
  };
}

describe("VERIFY v0 evidence contract", () => {
  it("treats www and trailing-slash homepage URLs as the same page", () => {
    expect(pageUrlsEquivalent("https://www.foundfy.me/", "https://foundfy.me")).toBe(true);
    expect(pageWasFetchedSuccessfully(200)).toBe(true);
    expect(pageWasFetchedSuccessfully(404)).toBe(false);
  });

  it("verifies only when observed meta equals the approved after value and missing-meta is absent", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: page(),
        missingMetaObservation: null,
      }),
    ).toEqual({
      status: "verified",
      observedValue: EXPECTED,
      missingMetaPresent: false,
    });
  });

  it("does not verify when the fresh crawl still reports missing meta", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: page({ metaDescription: null }),
        missingMetaObservation: {
          id: "obs-1",
          pageId: "page-fresh",
          ruleKey: "page_fundamentals.missing_meta_description",
          status: "active",
        },
      }),
    ).toMatchObject({
      status: "not_verified",
      observedValue: null,
      missingMetaPresent: true,
    });
  });

  it("does not verify when observed meta differs from the approved after value", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: page({ metaDescription: "A different homepage description." }),
        missingMetaObservation: null,
      }),
    ).toMatchObject({
      status: "not_verified",
      observedValue: "A different homepage description.",
    });
  });

  it("is inconclusive when the target page is missing from the crawl", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: null,
        missingMetaObservation: null,
      }),
    ).toEqual({
      status: "inconclusive",
      observedValue: null,
      missingMetaPresent: false,
    });
  });

  it("is inconclusive when the target page was not fetched successfully", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: page({ statusCode: 500, metaDescription: EXPECTED }),
        missingMetaObservation: null,
      }).status,
    ).toBe("inconclusive");
  });

  it("does not treat content_hash as verification evidence", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: page({ metaDescription: null }),
        missingMetaObservation: null,
      }).status,
    ).toBe("not_verified");
  });

  it("does not treat decision disappearance as verification evidence", () => {
    expect(
      evaluateMetaDescriptionVerification({
        expectedValue: EXPECTED,
        page: null,
        missingMetaObservation: null,
      }).status,
    ).toBe("inconclusive");
  });
});
