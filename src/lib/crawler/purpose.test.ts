import { describe, expect, it } from "vitest";
import {
  CRAWL_RUN_PURPOSE_SITE_SAMPLE,
  CRAWL_RUN_PURPOSE_TARGETED_OBSERVE,
  isNonSiteSamplePurpose,
  isSiteSamplePurpose,
} from "./purpose";

describe("crawl run purpose helpers", () => {
  it("treats missing purpose as processable site-sample legacy", () => {
    expect(isSiteSamplePurpose(undefined)).toBe(false);
    expect(isSiteSamplePurpose(null)).toBe(false);
    expect(isNonSiteSamplePurpose(undefined)).toBe(false);
    expect(isNonSiteSamplePurpose(null)).toBe(false);
    expect(isSiteSamplePurpose(CRAWL_RUN_PURPOSE_SITE_SAMPLE)).toBe(true);
  });

  it("fails closed for any purpose other than site_sample", () => {
    expect(isNonSiteSamplePurpose(CRAWL_RUN_PURPOSE_TARGETED_OBSERVE)).toBe(true);
    expect(isNonSiteSamplePurpose("future_purpose")).toBe(true);
    expect(isSiteSamplePurpose("future_purpose")).toBe(false);
  });
});
