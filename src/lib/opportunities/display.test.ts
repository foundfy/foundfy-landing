import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_CARD_COPY,
  OPPORTUNITY_EMPTY_COPY,
  OPPORTUNITY_GROUPED_COPY,
  OPPORTUNITY_LEADING_PAGE_COPY,
  OPPORTUNITY_SECTION_COPY,
  OPPORTUNITY_SECTION_HEADING,
  OPPORTUNITY_TRUNCATED_COPY,
  opportunityAppearancesCopy,
  opportunityMetricsCopy,
  opportunityPagePath,
  opportunityVariantMetricsCopy,
} from "./display";
import type { QueryOpportunityCard } from "./types";

const FORBIDDEN =
  /CTR is bad|easy win|optimize this|create a page|Google wants|generate enquiries|high-converting|trending|growing|losing traffic|cannibaliz|Growth opportunities|Keyword opportunities|Traffic opportunities|99% of|share of visibil/i;

function card(overrides: Partial<QueryOpportunityCard> = {}): QueryOpportunityCard {
  return {
    id: "cianotipo\thttps://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    query: "cianotipo",
    groupingKey: "cianotipo",
    appearances: 187,
    visits: 0,
    position: 2.82352941176471,
    leadingPageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    leadingPageId: null,
    mapped: false,
    variants: ["cianotipo"],
    variantEvidence: [
      { query: "cianotipo", appearances: 187, visits: 0, position: 2.82352941176471 },
    ],
    memberPages: [
      {
        query: "cianotipo",
        pageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        impressions: 186,
      },
    ],
    ...overrides,
  };
}

describe("Opportunity Discovery wording", () => {
  it("uses observation language and a separate surface name", () => {
    expect(OPPORTUNITY_SECTION_HEADING).toBe("Search demand to review");
    expect(OPPORTUNITY_SECTION_COPY).toContain("Google already showed your website");
    expect(OPPORTUNITY_SECTION_COPY).toContain("not predicting future traffic");
    expect(OPPORTUNITY_CARD_COPY).toContain("leading page Foundfy sees");
    expect(OPPORTUNITY_LEADING_PAGE_COPY).toBe(
      "This is the leading page Foundfy sees for this search.",
    );
    expect(OPPORTUNITY_GROUPED_COPY).toBe(
      "Foundfy grouped these query variants because they normalize to the same mechanical form and share the same leading page in the current Google Search data.",
    );
    expect(OPPORTUNITY_GROUPED_COPY).not.toMatch(/lead to the same page/i);
    expect(OPPORTUNITY_EMPTY_COPY).toBe("Google hasn’t reported searches for this period yet.");
    expect(OPPORTUNITY_TRUNCATED_COPY).toContain("other searches may exist");
    expect(OPPORTUNITY_SECTION_HEADING).not.toMatch(FORBIDDEN);
    expect(OPPORTUNITY_SECTION_COPY).not.toMatch(FORBIDDEN);
    expect(OPPORTUNITY_CARD_COPY).not.toMatch(FORBIDDEN);
  });

  it("formats metrics without judging CTR or inventing a visibility share", () => {
    const copy = opportunityMetricsCopy(card());

    expect(copy).toBe("187 appearances · 0 visits · Avg position 2.8");
    expect(copy).not.toMatch(/%|CTR|share/i);
    expect(opportunityAppearancesCopy(card(), 28)).toBe(
      "Your website appeared 187 times for this search in the last 28 days.",
    );
    expect(
      opportunityPagePath("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo"),
    ).toBe("/es/pintura-seda/set-de-cianotipo");
    expect(
      opportunityMetricsCopy(card({ position: null, appearances: 0, visits: 3 })),
    ).toBe("0 appearances · 3 visits");
    expect(
      opportunityVariantMetricsCopy({
        appearances: 21,
        visits: 0,
        position: 5.28571428571429,
      }),
    ).toBe("21 appearances · 0 visits · Avg position 5.3");
  });

  it("keeps UI copy free of forbidden claims", () => {
    const ui = readFileSync(
      path.join(__dirname, "../../components/site/SiteOpportunitiesSection.tsx"),
      "utf8",
    );
    expect(ui).toContain("OPPORTUNITY_REVIEW_LABEL");
    expect(ui).toContain("OPPORTUNITY_GROUPED_COPY");
    expect(ui).toContain("opportunityVariantMetricsCopy");
    expect(ui).toContain("OPPORTUNITY_MEMBER_PAGES_HEADING");
    expect(ui).toContain("<details");
    expect(ui).not.toMatch(/lead to the same page/i);
    expect(ui).not.toMatch(/fetch\(.*POST|decisionId|prepare|Analyze this page/i);
    expect(ui).not.toMatch(FORBIDDEN);
  });
});
