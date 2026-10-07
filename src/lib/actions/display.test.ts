import { describe, expect, it } from "vitest";
import {
  ACTION_CRAWL_HEADING,
  ACTION_EXECUTE_DISABLED,
  ACTION_EXECUTED_COPY,
  ACTION_INCONCLUSIVE_COPY,
  ACTION_LEARN_DECLINE_CAVEAT_COPY,
  ACTION_LEARN_HEADING,
  ACTION_LEARN_MIXED_COPY,
  ACTION_LEARN_NO_CHANGE_COPY,
  ACTION_LEARN_OTHER_FACTORS_COPY,
  ACTION_LEARN_WAITING_COPY,
  ACTION_NOT_VERIFIED_COPY,
  ACTION_PREPARE_LABEL,
  ACTION_STATUS_LABELS,
  ACTION_TITLE_GROUP_COPY,
  ACTION_UNSAFE_STALE_COPY,
  ACTION_VERIFICATION_STATE_HEADING,
  ACTION_VERIFIED_COPY,
  ACTION_VERIFY_FRESH_CRAWL_COPY,
  ACTION_VERIFY_LABEL,
  learningObservedCopy,
} from "./display";
import { ACTION_VERIFICATION_PLAN, TITLE_VERIFICATION_PLAN } from "./config";

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
    expect(ACTION_TITLE_GROUP_COPY).toContain("shares its title");
    expect(ACTION_TITLE_GROUP_COPY).not.toMatch(/fix all duplicate titles/i);
    expect(TITLE_VERIFICATION_PLAN).not.toMatch(/fix all duplicate titles/i);
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

  it("describes observed search change without causal claims", () => {
    expect(ACTION_LEARN_WAITING_COPY).toBe(
      "Foundfy will compare Google Search evidence after enough time has passed for Google's reporting to settle.",
    );
    const observed = learningObservedCopy({
      appearancesBefore: 120,
      appearancesAfter: 152,
      visitsBefore: 4,
      visitsAfter: 7,
    });
    const learnCopy = [
      ACTION_LEARN_HEADING,
      ACTION_LEARN_WAITING_COPY,
      ACTION_LEARN_OTHER_FACTORS_COPY,
      ACTION_LEARN_DECLINE_CAVEAT_COPY,
      ACTION_LEARN_MIXED_COPY,
      ACTION_LEARN_NO_CHANGE_COPY,
      observed,
    ].join("\n");

    expect(ACTION_LEARN_HEADING).toBe("After this change");
    expect(observed).toContain("32 more search appearances");
    expect(observed).toContain("3 more visits from Google");
    expect(learnCopy).not.toMatch(/caused|this meta description increased|improved rankings|traffic/i);
    expect(ACTION_LEARN_OTHER_FACTORS_COPY).toContain("Other factors may also have contributed");
  });
});
