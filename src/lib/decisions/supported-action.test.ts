import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "./types";
import {
  TITLE_LENGTH_RULE_KEY,
  supportedActionTypeForDecision,
} from "./supported-action";

function decision(
  overrides: Partial<Pick<DecisionRecord, "decisionType" | "pageId" | "evidenceRefs">>,
): Pick<DecisionRecord, "decisionType" | "pageId" | "evidenceRefs"> {
  return {
    decisionType: "existing_demand_page_issue",
    pageId: "page-1",
    evidenceRefs: [],
    ...overrides,
  };
}

function observation(ruleKey: string) {
  return {
    kind: "observation" as const,
    recordId: "obs-1",
    snapshot: { ruleKey },
  };
}

describe("supportedActionTypeForDecision", () => {
  it("supports Type A missing-meta as update_meta_description", () => {
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation("page_fundamentals.missing_meta_description")],
        }),
      ),
    ).toBe("update_meta_description");
  });

  it("supports Type A missing-title as update_page_title", () => {
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation("page_fundamentals.missing_title")],
        }),
      ),
    ).toBe("update_page_title");
  });

  it("supports Type A duplicate-title as update_page_title", () => {
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation("page_fundamentals.duplicate_title")],
        }),
      ),
    ).toBe("update_page_title");
  });

  it("supports Type C duplicate-title when DECIDE selected a primary page", () => {
    expect(
      supportedActionTypeForDecision(
        decision({
          decisionType: "multi_page_issue_with_visibility",
          pageId: "page-home",
          evidenceRefs: [
            observation("page_fundamentals.duplicate_title"),
            {
              kind: "observation",
              recordId: "obs-2",
              snapshot: { ruleKey: "page_fundamentals.duplicate_title" },
            },
          ],
        }),
      ),
    ).toBe("update_page_title");
  });

  it("rejects title-length, canonical, H1, Type B, and Type C without a page", () => {
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation(TITLE_LENGTH_RULE_KEY)],
        }),
      ),
    ).toBeNull();
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation("indexability.canonical_points_elsewhere")],
        }),
      ),
    ).toBeNull();
    expect(
      supportedActionTypeForDecision(
        decision({
          evidenceRefs: [observation("page_fundamentals.missing_h1")],
        }),
      ),
    ).toBeNull();
    expect(
      supportedActionTypeForDecision(
        decision({
          decisionType: "inspect_unanalyzed_page",
          pageId: null,
          evidenceRefs: [observation("page_fundamentals.missing_title")],
        }),
      ),
    ).toBeNull();
    expect(
      supportedActionTypeForDecision(
        decision({
          decisionType: "multi_page_issue_with_visibility",
          pageId: null,
          evidenceRefs: [observation("page_fundamentals.duplicate_title")],
        }),
      ),
    ).toBeNull();
  });
});
