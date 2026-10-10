import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_CARD_COPY,
  OPPORTUNITY_EMPTY_COPY,
  OPPORTUNITY_LEADING_PAGE_COPY,
  OPPORTUNITY_SECTION_COPY,
  OPPORTUNITY_SECTION_HEADING,
  OPPORTUNITY_TRUNCATED_COPY,
  opportunityAppearancesCopy,
  opportunityMetricsCopy,
  opportunityPagePath,
} from "./display";

const FORBIDDEN =
  /CTR is bad|easy win|optimize this|create a page|Google wants|generate enquiries|high-converting|trending|growing|losing traffic|cannibaliz|Growth opportunities|Keyword opportunities|Traffic opportunities|99% of|share of visibil/i;

describe("Opportunity Discovery v0 wording", () => {
  it("uses observation language and a separate surface name", () => {
    expect(OPPORTUNITY_SECTION_HEADING).toBe("Search demand to review");
    expect(OPPORTUNITY_SECTION_COPY).toContain("Google already showed your website");
    expect(OPPORTUNITY_SECTION_COPY).toContain("not predicting future traffic");
    expect(OPPORTUNITY_CARD_COPY).toContain("leading page Foundfy sees");
    expect(OPPORTUNITY_LEADING_PAGE_COPY).toBe(
      "This is the leading page Foundfy sees for this search.",
    );
    expect(OPPORTUNITY_EMPTY_COPY).toBe("Google hasn’t reported searches for this period yet.");
    expect(OPPORTUNITY_TRUNCATED_COPY).toContain("other searches may exist");
    expect(OPPORTUNITY_SECTION_HEADING).not.toMatch(FORBIDDEN);
    expect(OPPORTUNITY_SECTION_COPY).not.toMatch(FORBIDDEN);
    expect(OPPORTUNITY_CARD_COPY).not.toMatch(FORBIDDEN);
  });

  it("formats metrics without judging CTR or inventing a visibility share", () => {
    const copy = opportunityMetricsCopy({
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
    });

    expect(copy).toBe("187 appearances · 0 visits · Avg position 2.8");
    expect(copy).not.toMatch(/%|CTR|share/i);
    expect(
      opportunityAppearancesCopy(
        {
          id: "x",
          query: "cianotipo",
          groupingKey: "cianotipo",
          appearances: 187,
          visits: 0,
          position: 2.8,
          leadingPageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
          leadingPageId: null,
          mapped: false,
          variants: ["cianotipo"],
        },
        28,
      ),
    ).toBe("Your website appeared 187 times for this search in the last 28 days.");
    expect(
      opportunityPagePath("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo"),
    ).toBe("/es/pintura-seda/set-de-cianotipo");
  });

  it("keeps UI copy free of forbidden claims", () => {
    const ui = readFileSync(
      path.join(__dirname, "../../components/site/SiteOpportunitiesSection.tsx"),
      "utf8",
    );
    expect(ui).toContain("OPPORTUNITY_REVIEW_LABEL");
    expect(ui).toContain("<details");
    expect(ui).not.toMatch(/fetch\(.*POST|decisionId|prepare|Analyze this page/i);
    expect(ui).not.toMatch(FORBIDDEN);
  });
});
