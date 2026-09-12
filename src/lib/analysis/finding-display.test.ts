import { describe, expect, it } from "vitest";
import {
  formatAffectedPageLabel,
  formatEmptyHighlightsCopy,
  formatFindingEvidence,
  formatFindingsCount,
  formatGroupedFindingTitle,
  formatJobCount,
  formatPriorityLabel,
  formatResultsBrief,
  formatSharedTitleLine,
  formatSeriousnessLine,
  formatZeroFindingsCopy,
  shouldCollapseAllFindings,
  shouldShowHostInAffectedPages,
} from "./finding-display";
import { formatSearchPresenceCopy } from "./search-presence";
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
  it("does not treat zero findings as settled findability", () => {
    const copy = formatZeroFindingsCopy();
    expect(copy).toEqual({
      title: formatSearchPresenceCopy(null).title,
      description: formatSearchPresenceCopy(null).description,
    });
    expect(copy.title).not.toBe("No notable issues found.");
    expect(copy.description).toContain(
      "We cannot see whether Google has listed your site",
    );
  });

  it("does not treat empty highlights as settled findability", () => {
    const copy = formatEmptyHighlightsCopy();
    expect(copy.title).toBe("We could open your website.");
    expect(copy.description).toContain(
      "We cannot see whether Google has listed your site",
    );
    expect(copy.title).not.toBe("Nothing stands out as a priority.");
  });

  it("includes sitemap wording in zero-findings copy when that evidence is true", () => {
    expect(formatZeroFindingsCopy("sitemap").description).toContain(
      "That page is in your sitemap.",
    );
  });
});

describe("results comprehension copy", () => {
  it("builds a deterministic brief from the highest-priority action", () => {
    expect(
      formatResultsBrief([
        {
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          affectedPageCount: 4,
          priorityLevel: "high",
        },
        {
          ruleKey: "page_fundamentals.missing_meta_description",
          title: "Missing meta description",
          affectedPageCount: 6,
          priorityLevel: "medium",
        },
      ]),
    ).toBe("Duplicate page titles on 4 pages. Next: missing meta descriptions.");
  });

  it("handles zero findings without fabricated seriousness or settled findability", () => {
    expect(formatResultsBrief([])).toBe(formatSearchPresenceCopy(null).brief);
    expect(formatResultsBrief([])).not.toBe("No notable issues found.");
    expect(formatSeriousnessLine([])).toBeNull();
  });

  it("handles only-low findings without inventing high priority or settled findability", () => {
    expect(
      formatResultsBrief([
        {
          ruleKey: "indexability.redirecting_url",
          title: "URL redirects before final page",
          affectedPageCount: 3,
          priorityLevel: "low",
        },
      ]),
    ).toBe(formatSearchPresenceCopy(null).brief);
    expect(
      formatSeriousnessLine([
        {
          ruleKey: "indexability.redirecting_url",
          title: "URL redirects before final page",
          affectedPageCount: 3,
          priorityLevel: "low",
        },
      ]),
    ).toBeNull();
  });

  it("keeps a homepage noindex job as the brief instead of the presence sentence", () => {
    expect(
      formatResultsBrief([
        {
          ruleKey: "indexability.noindex",
          title: "Page marked noindex",
          affectedPageCount: 1,
          priorityLevel: "high",
        },
      ]),
    ).toBe("Page marked noindex on 1 page.");
    expect(
      formatResultsBrief([
        {
          ruleKey: "indexability.non_200_page",
          title: "Page did not return HTTP 200",
          affectedPageCount: 1,
          priorityLevel: "high",
        },
      ]),
    ).toBe("Page did not return HTTP 200 on 1 page.");
  });

  it("states high-priority seriousness from grouped actions", () => {
    expect(
      formatSeriousnessLine([
        {
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          affectedPageCount: 4,
          priorityLevel: "high",
        },
        {
          ruleKey: "internal_structure.broken_internal_link",
          title: "Broken internal link",
          affectedPageCount: 3,
          priorityLevel: "critical",
        },
        {
          ruleKey: "page_fundamentals.missing_h1",
          title: "Missing H1",
          affectedPageCount: 2,
          priorityLevel: "medium",
        },
      ]),
    ).toBe("2 high-priority issues need attention.");
  });

  it("collapses All findings when there are many grouped actions", () => {
    expect(shouldCollapseAllFindings(3)).toBe(false);
    expect(shouldCollapseAllFindings(4)).toBe(true);
    expect(
      formatGroupedFindingTitle(
        "page_fundamentals.duplicate_title",
        "Duplicate page title",
        4,
      ),
    ).toBe("Duplicate page titles");
  });

  it("surfaces a shared title from evidence without hard-coding a site", () => {
    expect(formatSharedTitleLine("Pintura sobre seda | DBHOBBY", 4)).toBe(
      '4 pages use the same title: "Pintura sobre seda | DBHOBBY"',
    );
    expect(formatSharedTitleLine("Home", 1)).toBe('Title: "Home"');
    expect(formatSharedTitleLine(null, 4)).toBeNull();
  });

  it("keeps exact hosts visible when www and apex both appear", () => {
    expect(
      shouldShowHostInAffectedPages([
        "https://dbhobby.com/",
        "https://www.dbhobby.com/ca",
      ]),
    ).toBe(true);
    expect(
      formatAffectedPageLabel("https://www.dbhobby.com/ca", { includeHost: true }),
    ).toBe("www.dbhobby.com/ca");
    expect(formatAffectedPageLabel("https://dbhobby.com/", { includeHost: false })).toBe(
      "/",
    );
  });

  it("formats job counts for the work list", () => {
    expect(formatJobCount(1)).toBe("1 job");
    expect(formatJobCount(8)).toBe("8 jobs");
  });
});
