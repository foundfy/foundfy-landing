import { describe, expect, it } from "vitest";
import {
  ACTION_CRAWL_HEADING,
  ACTION_EXECUTE_DISABLED,
  ACTION_EXECUTED_COPY,
  ACTION_INCONCLUSIVE_COPY,
  ACTION_NOT_VERIFIED_COPY,
  ACTION_PREPARE_LABEL,
  ACTION_STATUS_LABELS,
  ACTION_UNSAFE_STALE_COPY,
  ACTION_VERIFICATION_STATE_HEADING,
  ACTION_VERIFIED_COPY,
  ACTION_VERIFY_FRESH_CRAWL_COPY,
  ACTION_VERIFY_LABEL,
} from "./display";
import { ACTION_VERIFICATION_PLAN } from "./config";

const VERIFY_COPY = [
  ACTION_VERIFICATION_PLAN,
  ACTION_EXECUTED_COPY,
  ACTION_VERIFY_LABEL,
  ACTION_VERIFICATION_STATE_HEADING,
  ACTION_VERIFY_FRESH_CRAWL_COPY,
  ACTION_VERIFIED_COPY,
  ACTION_NOT_VERIFIED_COPY,
  ACTION_INCONCLUSIVE_COPY,
  ACTION_CRAWL_HEADING,
].join("\n");

describe("ACT display copy", () => {
  it("does not claim ranking or traffic improvement", () => {
    expect(ACTION_VERIFICATION_PLAN).toBe(
      "After execution, Foundfy will re-check this page and confirm whether the meta description changed.",
    );
    expect(ACTION_EXECUTE_DISABLED).toContain("site connection");
    expect(ACTION_UNSAFE_STALE_COPY).toContain("underlying evidence has changed");
    expect(ACTION_PREPARE_LABEL).toBe("Prepare this change");
    expect(VERIFY_COPY).not.toMatch(/rank|traffic|clicks|impressions|SEO performance/i);
  });

  it("keeps Executed status separate from verification copy", () => {
    expect(ACTION_STATUS_LABELS.executed).toBe("Executed");
    expect(ACTION_VERIFICATION_STATE_HEADING).toBe("Verification");
    expect(ACTION_VERIFY_LABEL).toBe("Check verification");
    expect(ACTION_VERIFY_FRESH_CRAWL_COPY).toBe(
      "Run a new scan to verify that this change is live.",
    );
    expect(ACTION_EXECUTED_COPY).toContain("Deployment and crawl verification are separate");
    expect(ACTION_VERIFIED_COPY).toContain("confirmed the meta description matches");
  });
});
