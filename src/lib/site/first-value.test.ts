import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { CrawlEvidenceContext } from "@/lib/observations/types";
import { evaluateCrawlFoundations } from "@/lib/foundations/evaluate";
import type { WebsiteOverview } from "@/lib/websites/types";
import {
  FIRST_VALUE_HEADING,
  GOOGLE_INDEXING_UNKNOWN,
  GOOGLE_SYNC_CLARIFICATION,
  buildFirstValueView,
  firstValueCopyBlob,
} from "./first-value";

const SELCUK_URLS = [
  "https://selcukdemirci.me/",
  "https://selcukdemirci.me/about",
  "https://selcukdemirci.me/contact",
] as const;

const FALSE_WORK =
  /Foundfy will (monitor|schedule|automatically)|recurring sync|request indexing|submit the sitemap|Foundfy is (now )?(checking|inspecting) Google's index/i;

function selcukContext(): CrawlEvidenceContext {
  return {
    crawlRunId: "selcuk-run",
    websiteId: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
    hostname: "selcukdemirci.me",
    seedUrl: "https://selcukdemirci.me/",
    pages: SELCUK_URLS.map((url, index) => ({
      id: `page-${index}`,
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      title: url,
      metaDescription: index === 0 ? "Home" : null,
      canonical: url,
      robotsMeta: null,
      xRobotsTag: null,
      h1: ["Heading"],
      internalLinkCount: 2,
    })),
    links: [],
    queue: SELCUK_URLS.map((url, index) => ({
      id: `queue-${index}`,
      url,
      status: "completed",
      skipReason: null,
    })),
    artifacts: [
      {
        id: "robots",
        artifactType: "robots_txt",
        url: "https://selcukdemirci.me/robots.txt",
        statusCode: 200,
        parsed: { allow: ["/"], disallow: [], sitemaps: [] },
      },
      {
        id: "sitemap",
        artifactType: "sitemap_xml",
        url: "https://selcukdemirci.me/sitemap.xml",
        statusCode: 200,
        parsed: { urls: [...SELCUK_URLS] },
      },
    ],
  };
}

function titleLengthFinding(id: string, pageUrl: string, rank: number): AnalysisFinding {
  return {
    id,
    ruleKey: "page_fundamentals.title_length_out_of_range",
    category: "page_fundamentals",
    severity: "info",
    title: "Title length outside recommended range",
    description: "The page title length is outside the recommended 30–60 character range.",
    pageUrl,
    evidence: {},
    priority: {
      level: "low",
      rank,
      whyItMatters: "Very short or long titles may truncate in search results and reduce clarity.",
      recommendedAction:
        "Rewrite the title to stay within the recommended 30–60 character range while staying descriptive.",
      verification: "Confirm the updated title length is within range.",
    },
    recommendation: {
      whyItMatters: "Very short or long titles may truncate in search results and reduce clarity.",
      recommendedAction:
        "Rewrite the title to stay within the recommended 30–60 character range while staying descriptive.",
      verification: "Confirm the updated title length is within range.",
    },
  };
}

function selcukFindings(): AnalysisFinding[] {
  return [
    titleLengthFinding(
      "b470af4d-16ff-40e1-963a-b55db62acc6e",
      "https://selcukdemirci.me/contact",
      1,
    ),
    titleLengthFinding(
      "da14de36-8950-4fea-a141-7d15fa606615",
      "https://selcukdemirci.me/about",
      2,
    ),
  ];
}

function createOverview(overrides: Partial<WebsiteOverview> = {}): WebsiteOverview {
  const findings = selcukFindings();
  return {
    website: {
      id: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
      hostname: "selcukdemirci.me",
      displayUrl: "https://selcukdemirci.me/",
      firstSeenAt: "2026-10-31T00:00:00.000Z",
      lastCrawledAt: "2026-10-31T19:40:42.097Z",
    },
    latestUsableScan: {
      crawlRunId: "selcuk-run",
      completedAt: "2026-10-31T19:40:42.097Z",
      pagesCrawled: 3,
      findings,
      findingsSummary: {
        totalCount: 2,
        highlightedFindingIds: [],
        highlightGroups: [],
      },
      comparison: {
        previousCrawlRunId: "f457d361-4fec-47fe-8c1b-f9966a11a729",
        previousCompletedAt: "2026-10-31T19:40:42.097+00:00",
        fixed: 0,
        stillPresent: 2,
        new: 0,
        unverified: 0,
        fixedFindings: [],
      },
      searchPresence: {
        homepageBlock: null,
        homepageDiscovery: "sitemap",
      },
      foundations: evaluateCrawlFoundations({
        context: selcukContext(),
        findings,
      }),
      explanationEnrichmentStatus: "ready",
    },
    highlightedFindings: [],
    siteModel: null,
    goals: null,
    activeScan: null,
    scanHistory: [],
    ...overrides,
  };
}

describe("selcukdemirci.me first-value acceptance", () => {
  it("identifies the two persisted findings as info/low title-length notes, not jobs", () => {
    const findings = selcukFindings();
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.ruleKey)).toEqual([
      "page_fundamentals.title_length_out_of_range",
      "page_fundamentals.title_length_out_of_range",
    ]);
    expect(findings.map((finding) => finding.severity)).toEqual(["info", "info"]);
    expect(findings.map((finding) => finding.priority?.level)).toEqual(["low", "low"]);
    expect(findings.map((finding) => finding.pageUrl)).toEqual([
      "https://selcukdemirci.me/contact",
      "https://selcukdemirci.me/about",
    ]);

    const view = buildFirstValueView(createOverview(), {
      kind: "empty",
      windowDays: 28,
    });

    expect(view.heading).toBe(FIRST_VALUE_HEADING);
    expect(view.attention).toEqual([]);
    expect(view.attentionCards).toEqual([]);
    expect(view.notes).toHaveLength(1);
    expect(view.notes[0]?.ruleKey).toBe("page_fundamentals.title_length_out_of_range");
    expect(view.notes[0]?.classification).toBe("note");
    expect(view.notes[0]?.affectedPageCount).toBe(2);
    expect(view.notes[0]?.explanation).toMatch(/recorded scan note about title length/i);
    expect(view.notes[0]?.explanation).toMatch(/not a technical blocker/i);
    expect(view.completedBody).toMatch(/completed a website scan/i);
    expect(view.completedBody).toMatch(/not an SEO job/i);
    expect(view.completedBody).not.toMatch(/We could open your website/i);
    expect(view.nextStep.message).not.toMatch(/We could open your website/i);
    expect(view.nextStep.kind).toBe("no_immediate_action");
    expect(view.nextStep.code).toBe("wait_for_google_discovery");
    expect(view.nextStep.message).toMatch(/recorded notes above were evaluated/i);
    expect(view.nextStep.message).toMatch(/let Google discover/i);
    expect(view.nextStep.message).toMatch(/not asking you to rewrite titles/i);
    expect(view.ownerNeed.required).toBe(false);
    expect(view.ownerNeed.message).toMatch(/No verified technical change is required/i);
    expect(view.ownerNeed.message).toMatch(/recorded notes remain visible/i);
    expect(view.unknownBody).toContain(GOOGLE_INDEXING_UNKNOWN);
    expect(view.unknownBody).toMatch(/synced, but reported no queries/i);
    expect(view.googleSyncClarification).toBe(GOOGLE_SYNC_CLARIFICATION);
    expect(firstValueCopyBlob(view)).not.toMatch(FALSE_WORK);
  });

  it("does not hide the two findings to make the page look healthy", () => {
    const view = buildFirstValueView(createOverview(), { kind: "empty", windowDays: 28 });
    const blob = firstValueCopyBlob(view);
    expect(blob).toMatch(/Title lengths outside recommended range/i);
    expect(view.notes[0]?.pageLabels).toEqual(expect.arrayContaining(["/about", "/contact"]));
    expect(blob).not.toMatch(/no issues found|website is healthy|nothing to see/i);
  });
});

describe("first-value GSC and indexing distinctions", () => {
  it("keeps empty completed sync distinct from not connected, not synced, unauthorized, and unavailable", () => {
    const overview = createOverview();
    const empty = buildFirstValueView(overview, { kind: "empty", windowDays: 28 });
    const noSession = buildFirstValueView(overview, { kind: "no_session" });
    const notConnected = buildFirstValueView(overview, { kind: "not_connected" });
    const notSynced = buildFirstValueView(overview, { kind: "not_synced" });
    const unavailable = buildFirstValueView(overview, { kind: "unavailable" });

    expect(empty.nextStep.code).toBe("wait_for_google_discovery");
    expect(empty.unknownBody).toMatch(/synced, but reported no queries/i);
    expect(noSession.nextStep.code).toBe("connect_google_for_performance");
    expect(noSession.unknownBody).toMatch(/unavailable in this view/i);
    expect(notConnected.nextStep.code).toBe("google_not_connected");
    expect(notConnected.unknownBody).toMatch(/Search Console is not connected/i);
    expect(notSynced.nextStep.code).toBe("sync_google_performance");
    expect(notSynced.nextStep.message).toMatch(/owner-started/i);
    expect(notSynced.nextStep.message).not.toMatch(/Connect Google in this session/i);
    expect(unavailable.nextStep.code).toBe("google_unavailable");
    expect(unavailable.unknownBody).toMatch(/could not load Google search analytics/i);

    for (const view of [empty, noSession, notConnected, notSynced, unavailable]) {
      expect(view.unknownBody).toContain(GOOGLE_INDEXING_UNKNOWN);
      expect(view.notes).toHaveLength(1);
    }

    const ineligible = buildFirstValueView(overview, { kind: "empty", windowDays: 28 }, {
      kind: "pilot_ineligible",
    });
    expect(ineligible.unknownBody).toMatch(/not available for this site yet/i);
    expect(ineligible.unknownBody).not.toContain(GOOGLE_INDEXING_UNKNOWN);
    expect(ineligible.unknownBody).not.toMatch(/Connect Google again/i);
    expect(ineligible.unknownBody).not.toMatch(/Owner session required/i);
    expect(ineligible.nextStep.message).not.toMatch(/Check Google indexing/i);
  });

  it("does not treat a successful fetch as the current job when there are no findings", () => {
    const overview = createOverview({
      latestUsableScan: {
        ...createOverview().latestUsableScan!,
        findings: [],
        findingsSummary: {
          totalCount: 0,
          highlightedFindingIds: [],
          highlightGroups: [],
        },
        foundations: evaluateCrawlFoundations({
          context: selcukContext(),
          findings: [],
        }),
      },
      highlightedFindings: [],
    });
    const view = buildFirstValueView(overview, { kind: "empty", windowDays: 28 });
    expect(view.attention).toEqual([]);
    expect(view.notes).toEqual([]);
    expect(view.completedBody).not.toMatch(/We could open your website/i);
    expect(view.nextStep.message).not.toMatch(/We could open your website/i);
    expect(view.nextStep.code).toBe("wait_for_google_discovery");
    expect(view.ownerNeed.required).toBe(false);
  });

  it("leads with a homepage technical blocker instead of a ready sentence", () => {
    const finding: AnalysisFinding = {
      id: "home-403",
      ruleKey: "indexability.non_200_page",
      category: "indexability",
      severity: "error",
      title: "Page did not return HTTP 200",
      description: "The homepage returned 403.",
      pageUrl: "https://selcukdemirci.me/",
      evidence: { statusCode: 403 },
      priority: {
        level: "high",
        rank: 1,
        whyItMatters: "Search engines may not list this page.",
        recommendedAction: "Fix the response.",
        verification: null,
      },
    };
    const overview = createOverview({
      latestUsableScan: {
        ...createOverview().latestUsableScan!,
        findings: [finding],
        findingsSummary: {
          totalCount: 1,
          highlightedFindingIds: ["home-403"],
          highlightGroups: [
            {
              representativeFindingId: "home-403",
              memberFindingIds: ["home-403"],
              rawFindingCount: 1,
              affectedPageCount: 1,
            },
          ],
        },
        searchPresence: {
          homepageBlock: "non_200",
          homepageDiscovery: null,
        },
        foundations: evaluateCrawlFoundations({
          context: {
            ...selcukContext(),
            pages: selcukContext().pages.map((page, index) =>
              index === 0 ? { ...page, statusCode: 403 } : page,
            ),
          },
          findings: [finding],
        }),
      },
      highlightedFindings: [finding],
    });
    const view = buildFirstValueView(overview, { kind: "empty", windowDays: 28 });
    expect(view.attention).toHaveLength(1);
    expect(view.attention[0]?.ruleKey).toBe("indexability.non_200_page");
    expect(view.nextStep.kind).toBe("confirmed_issue");
    expect(view.nextStep.code).toBe("review_homepage_block");
    expect(view.ownerNeed.required).toBe(true);
    expect(view.completedBody).not.toMatch(/We could open your website/i);
  });

  it("does not invent monitoring while Google performance is still loading", () => {
    const view = buildFirstValueView(createOverview(), null);
    expect(view.nextStep.code).toBe("google_performance_loading");
    expect(view.notes).toHaveLength(1);
    expect(view.ownerNeed.required).toBe(false);
    expect(view.unknownBody).toContain(GOOGLE_INDEXING_UNKNOWN);
    expect(firstValueCopyBlob(view)).not.toMatch(FALSE_WORK);
  });

  it("keeps public viewer copy from claiming owner Google data", () => {
    const view = buildFirstValueView(createOverview(), { kind: "no_session" });
    expect(view.nextStep.code).toBe("connect_google_for_performance");
    expect(view.googleSyncClarification).toBeNull();
    expect(view.unknownBody).not.toMatch(/synced, but reported no queries/i);
    expect(view.unknownBody).not.toMatch(/disconnected/i);
    expect(view.nextStep.message).not.toMatch(/disconnected/i);
    expect(view.ownerNeed.message).toMatch(/optional/i);
  });

  it("treats highlight-level findings as attention and low/info findings as notes", () => {
    const missingTitle: AnalysisFinding = {
      id: "missing-title",
      ruleKey: "page_fundamentals.missing_title",
      category: "page_fundamentals",
      severity: "warning",
      title: "Missing page title",
      description: "The page has no title.",
      pageUrl: "https://selcukdemirci.me/about",
      evidence: {},
      priority: {
        level: "high",
        rank: 1,
        whyItMatters: "Titles matter",
        recommendedAction: "Add a title",
        verification: null,
      },
    };
    const overview = createOverview({
      latestUsableScan: {
        ...createOverview().latestUsableScan!,
        findings: [...selcukFindings(), missingTitle],
        findingsSummary: {
          totalCount: 3,
          highlightedFindingIds: ["missing-title"],
          highlightGroups: [
            {
              representativeFindingId: "missing-title",
              memberFindingIds: ["missing-title"],
              rawFindingCount: 1,
              affectedPageCount: 1,
            },
          ],
        },
      },
      highlightedFindings: [missingTitle],
    });
    const view = buildFirstValueView(overview, { kind: "empty", windowDays: 28 });
    expect(view.attention.map((note) => note.ruleKey)).toEqual([
      "page_fundamentals.missing_title",
    ]);
    expect(view.notes.map((note) => note.ruleKey)).toEqual([
      "page_fundamentals.title_length_out_of_range",
    ]);
    expect(view.nextStep.kind).toBe("confirmed_issue");
    expect(view.ownerNeed.required).toBe(true);
  });

  it("J. says empty search performance can remain after Google reports the homepage indexed", () => {
    const view = buildFirstValueView(
      createOverview(),
      { kind: "empty", windowDays: 28 },
      {
        kind: "checked",
        inspectedAt: "2026-11-02T23:00:00.000Z",
        reused: false,
        urls: [
          {
            url: "https://selcukdemirci.me/",
            role: "homepage",
            verdict: "indexed",
            coverageState: "Submitted and indexed",
            indexingState: "INDEXING_ALLOWED",
            robotsTxtState: "ALLOWED",
            pageFetchState: "SUCCESSFUL",
            lastCrawlTime: "2026-10-01T00:00:00.000Z",
            inspectedAt: "2026-11-02T23:00:00.000Z",
            userCanonical: "https://selcukdemirci.me/",
            googleCanonical: "https://selcukdemirci.me/",
            canonicalMismatch: false,
            referringUrls: [],
            sitemaps: [],
            reason: "Submitted and indexed",
          },
        ],
        sitemap: {
          crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
          listedInSearchConsole: false,
          sitemaps: [],
          interpretation: "none_listed",
        },
      },
    );

    expect(view.unknownBody).toMatch(/homepage as indexed/i);
    expect(view.unknownBody).toMatch(/synced, but reported no queries/i);
    expect(view.unknownBody).not.toContain(GOOGLE_INDEXING_UNKNOWN);
    expect(view.nextStep.code).toBe("wait_for_google_discovery");
    expect(view.nextStep.message).toMatch(/Search performance can stay empty/i);
    expect(firstValueCopyBlob(view)).not.toMatch(FALSE_WORK);
  });

  it("K. keeps empty search performance and an unknown URL from becoming an indexed claim", () => {
    const view = buildFirstValueView(
      createOverview(),
      { kind: "empty", windowDays: 28 },
      {
        kind: "checked",
        inspectedAt: "2026-11-02T23:00:00.000Z",
        reused: false,
        urls: [
          {
            url: "https://selcukdemirci.me/",
            role: "homepage",
            verdict: "unknown",
            coverageState: null,
            indexingState: "INDEXING_ALLOWED",
            robotsTxtState: null,
            pageFetchState: null,
            lastCrawlTime: null,
            inspectedAt: "2026-11-02T23:00:00.000Z",
            userCanonical: null,
            googleCanonical: null,
            canonicalMismatch: false,
            referringUrls: [],
            sitemaps: [],
            reason: "Google did not clearly report whether this URL is indexed.",
          },
        ],
        sitemap: {
          crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
          listedInSearchConsole: false,
          sitemaps: [],
          interpretation: "none_listed",
        },
      },
    );

    expect(view.unknownBody).toMatch(/did not clearly report whether these pages are indexed/i);
    expect(view.unknownBody).toMatch(/synced, but reported no queries/i);
    expect(view.unknownBody).not.toMatch(/homepage as indexed/i);
    expect(view.nextStep.message).not.toMatch(/homepage as indexed/i);
  });
});
