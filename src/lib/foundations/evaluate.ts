import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import {
  detectHomepageBlockFromEvidence,
  detectHomepageBlockFromFindings,
  isHomepageUrl,
  type HomepageBlockKind,
} from "@/lib/analysis/search-presence";
import { classifyPagePath } from "@/lib/crawler/select/page-priority";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
import type {
  CrawlArtifactEvidence,
  CrawlEvidenceContext,
  CrawlPageEvidence,
} from "@/lib/observations/types";
import { extractSitemapUrls, hasNoindex } from "@/lib/observations/utils";
import type {
  CrawlFoundationsAssessment,
  FoundationCheck,
  FoundationNextStep,
  GooglePerformanceEvidenceInput,
  StoredGooglePerformanceEvidence,
} from "./types";

export const FOUNDATION_SITEMAP_PREVIEW_LIMIT = 10;

const ROBOTS_PARSE_LIMITATION =
  "Foundfy only reads User-agent: * rules in robots.txt, not Googlebot-specific rules.";

function findingUrls(finding: AnalysisFinding): string[] {
  const urls: string[] = [];
  if (finding.pageUrl) {
    urls.push(finding.pageUrl);
  }

  for (const key of ["requestedUrl", "finalUrl", "queueUrl"] as const) {
    const value = finding.evidence[key];
    if (typeof value === "string" && value.length > 0) {
      urls.push(value);
    }
  }

  return urls;
}

function isImportantUrl(url: string, hostname: string): boolean {
  if (isHomepageUrl(url, hostname)) {
    return true;
  }

  const pathClass = classifyPagePath(url);
  return (
    pathClass === "homepage" ||
    pathClass === "identity" ||
    pathClass === "locale_home"
  );
}

function pageIsHomepage(page: CrawlPageEvidence, hostname: string): boolean {
  return (
    isHomepageUrl(page.requestedUrl, hostname) ||
    isHomepageUrl(page.finalUrl, hostname)
  );
}

function pageIsImportant(page: CrawlPageEvidence, hostname: string): boolean {
  return (
    isImportantUrl(page.requestedUrl, hostname) ||
    isImportantUrl(page.finalUrl, hostname)
  );
}

function findingTouchesImportantPage(
  finding: AnalysisFinding,
  hostname: string,
): boolean {
  return findingUrls(finding).some((url) => isImportantUrl(url, hostname));
}

function successfulArtifact(
  artifacts: CrawlArtifactEvidence[],
  artifactType: CrawlArtifactEvidence["artifactType"],
): CrawlArtifactEvidence | undefined {
  return artifacts.find(
    (artifact) =>
      artifact.artifactType === artifactType &&
      artifact.statusCode !== null &&
      artifact.statusCode < 400,
  );
}

function unavailableCheck(
  id: FoundationCheck["id"],
  summary: string,
  detail?: string,
): FoundationCheck {
  return { id, status: "data_unavailable", summary, detail };
}

function emptyCrawlAssessment(
  findings: AnalysisFinding[],
): CrawlFoundationsAssessment {
  const homepageBlock = detectHomepageBlockFromFindings(findings);
  return {
    crawlRunId: null,
    hostname: null,
    pagesFetched: 0,
    discoveredUrlCount: 0,
    sampleLimited: false,
    fetchedPageUrls: [],
    sitemapUrlCount: 0,
    sitemapUrls: [],
    homepageBlock,
    hasImportantFetchError: homepageBlock === "non_200",
    hasImportantIndexabilityBlock: homepageBlock === "noindex",
    hasSitemapUrlIssues: findings.some(
      (finding) => finding.ruleKey === "site_discovery.sitemap_url_issue",
    ),
    checks: {
      importantPages: unavailableCheck(
        "important_pages",
        "Foundfy does not have a usable scan sample for this site yet.",
      ),
      crawlability: unavailableCheck(
        "crawlability",
        "Foundfy does not have crawlability evidence from a usable scan yet.",
      ),
      indexability: unavailableCheck(
        "indexability",
        "Foundfy does not have indexability evidence from a usable scan yet.",
      ),
      sitemap: unavailableCheck(
        "sitemap",
        "Foundfy does not have a sitemap from a usable scan yet.",
      ),
    },
  };
}

function evaluateImportantPages(input: {
  context: CrawlEvidenceContext;
  homepageBlock: HomepageBlockKind | null;
  homepagePage: CrawlPageEvidence | undefined;
  sampleLimited: boolean;
  discoveredUrlCount: number;
}): FoundationCheck {
  const { context, homepageBlock, homepagePage, sampleLimited, discoveredUrlCount } =
    input;
  const fetchedCount = context.pages.length;
  const sampleNote = sampleLimited
    ? ` This is a sample of ${fetchedCount} fetched page${fetchedCount === 1 ? "" : "s"} out of ${discoveredUrlCount} discovered URL${discoveredUrlCount === 1 ? "" : "s"}, not a full-site check.`
    : ` This scan opened ${fetchedCount} page${fetchedCount === 1 ? "" : "s"}. That is not a full-site health certificate.`;

  if (homepageBlock === "robots_disallow") {
    return {
      id: "important_pages",
      status: "needs_attention",
      summary: "Foundfy could not open the homepage because robots.txt disallows it.",
      detail: sampleNote.trim(),
    };
  }

  if (homepageBlock === "non_200" || (homepagePage && homepagePage.statusCode !== 200)) {
    const statusCode = homepagePage?.statusCode ?? null;
    return {
      id: "important_pages",
      status: "needs_attention",
      summary:
        statusCode === null
          ? "Foundfy could not confirm that the homepage returned HTTP 200 in this scan."
          : `The homepage returned HTTP ${statusCode} in this scan, so Foundfy did not treat it as successfully opened.`,
      detail: sampleNote.trim(),
    };
  }

  if (fetchedCount === 0) {
    return {
      id: "important_pages",
      status: "needs_attention",
      summary: "Foundfy did not fetch any HTML pages in this scan.",
      detail: sampleNote.trim(),
    };
  }

  if (!homepagePage) {
    return {
      id: "important_pages",
      status: "needs_attention",
      summary:
        "Foundfy opened pages in this scan, but the homepage was not in the fetched sample.",
      detail: sampleNote.trim(),
    };
  }

  return {
    id: "important_pages",
    status: "verified",
    summary:
      fetchedCount === 1
        ? "Foundfy opened the homepage in this scan."
        : "Foundfy opened the homepage and the other pages in this scan.",
    detail: sampleNote.trim(),
  };
}

function evaluateCrawlability(input: {
  context: CrawlEvidenceContext;
  homepageBlock: HomepageBlockKind | null;
  importantRobotsBlocked: boolean;
}): FoundationCheck {
  const { context, homepageBlock, importantRobotsBlocked } = input;
  const robots = successfulArtifact(context.artifacts, "robots_txt");
  const robotsAttempt = context.artifacts.find(
    (artifact) => artifact.artifactType === "robots_txt",
  );

  if (homepageBlock === "robots_disallow" || importantRobotsBlocked) {
    return {
      id: "crawlability",
      status: "needs_attention",
      summary: importantRobotsBlocked && homepageBlock !== "robots_disallow"
        ? "robots.txt blocked an important page in this scan."
        : "The homepage is disallowed by robots.txt, so Foundfy could not fetch it.",
      detail: ROBOTS_PARSE_LIMITATION,
    };
  }

  if (!robots) {
    if (context.pages.length > 0) {
      return {
        id: "crawlability",
        status: "verified",
        summary:
          "robots.txt was missing or unreachable. Foundfy still opened pages in this scan. Missing robots.txt is not always a problem.",
        detail: [
          robotsAttempt
            ? `Foundfy requested ${robotsAttempt.url} and got HTTP ${robotsAttempt.statusCode ?? "no response"}.`
            : "Foundfy did not persist a usable robots.txt artifact for this scan.",
          ROBOTS_PARSE_LIMITATION,
        ].join(" "),
      };
    }

    return {
      id: "crawlability",
      status: "needs_attention",
      summary:
        "Foundfy did not fetch a usable robots.txt and did not open HTML pages in this scan.",
      detail: ROBOTS_PARSE_LIMITATION,
    };
  }

  return {
    id: "crawlability",
    status: "verified",
    summary:
      "robots.txt allows crawling, and Foundfy was not blocked on these URLs.",
    detail: ROBOTS_PARSE_LIMITATION,
  };
}

function evaluateIndexability(input: {
  context: CrawlEvidenceContext;
  findings: AnalysisFinding[];
  homepageBlock: HomepageBlockKind | null;
  homepagePage: CrawlPageEvidence | undefined;
  hasImportantIndexabilityBlock: boolean;
}): FoundationCheck {
  const { context, findings, homepageBlock, homepagePage, hasImportantIndexabilityBlock } =
    input;

  if (homepageBlock === "noindex") {
    return {
      id: "indexability",
      status: "needs_attention",
      summary:
        'The homepage tells search engines not to list it (noindex). Foundfy can open the page, but Google is being asked not to index it.',
      detail:
        "This is a signal Foundfy saw on the fetched homepage. It is not a Google index status.",
    };
  }

  if (homepageBlock === "non_200") {
    return {
      id: "indexability",
      status: "needs_attention",
      summary:
        "The homepage did not return HTTP 200 in this scan, so Foundfy could not verify indexability signals there.",
    };
  }

  const importantNoindexPages = context.pages.filter(
    (page) =>
      pageIsImportant(page, context.hostname) &&
      !pageIsHomepage(page, context.hostname) &&
      hasNoindex(page.robotsMeta, page.xRobotsTag),
  );

  if (importantNoindexPages.length > 0 || hasImportantIndexabilityBlock) {
    const canonicalElsewhere = findings.some(
      (finding) =>
        finding.ruleKey === "indexability.canonical_points_elsewhere" &&
        findingTouchesImportantPage(finding, context.hostname),
    );
    return {
      id: "indexability",
      status: "needs_attention",
      summary: canonicalElsewhere
        ? "An important page in this scan points its canonical tag somewhere else."
        : "An important page in this scan tells search engines not to list it.",
      detail:
        "These signals apply only to pages Foundfy fetched. They are not a Google index status.",
    };
  }

  const missingCanonical = findings.some(
    (finding) => finding.ruleKey === "indexability.canonical_missing",
  );
  const canonicalNote = missingCanonical
    ? " Some fetched pages are missing a canonical tag. That is a note, not the headline for this scan."
    : "";

  if (!homepagePage) {
    return {
      id: "indexability",
      status: "data_unavailable",
      summary:
        "Foundfy did not fetch the homepage, so indexability signals for the main page are unavailable.",
      detail: `Absence of a noindex finding is not proof the website is healthy.${canonicalNote}`,
    };
  }

  return {
    id: "indexability",
    status: "verified",
    summary:
      'Foundfy did not see a "don\'t list this" instruction on the homepage.',
    detail: `That is not proof the whole website is healthy, and it is not a Google indexing check.${canonicalNote}`,
  };
}

function evaluateSitemap(input: {
  context: CrawlEvidenceContext;
  findings: AnalysisFinding[];
  sitemapUrlCount: number;
}): FoundationCheck {
  const { context, findings, sitemapUrlCount } = input;
  const sitemap = successfulArtifact(context.artifacts, "sitemap_xml");
  const sitemapAttempt = context.artifacts.find(
    (artifact) => artifact.artifactType === "sitemap_xml",
  );
  const urlIssues = findings.filter(
    (finding) => finding.ruleKey === "site_discovery.sitemap_url_issue",
  );

  if (!sitemap) {
    return {
      id: "sitemap",
      status: "data_unavailable",
      summary:
        "Foundfy did not fetch a usable sitemap.xml in this scan. That is not always an error.",
      detail: sitemapAttempt
        ? `Foundfy requested ${sitemapAttempt.url} and got HTTP ${sitemapAttempt.statusCode ?? "no response"}. A missing sitemap is not a confirmed technical blocker by itself.`
        : "A missing sitemap is not a confirmed technical blocker by itself.",
    };
  }

  if (urlIssues.length > 0) {
    return {
      id: "sitemap",
      status: "needs_attention",
      summary: "Foundfy fetched a sitemap, but some listed URLs did not fetch as expected.",
      detail:
        "A sitemap helps discovery; it does not mean Google has indexed those URLs.",
    };
  }

  if (sitemapUrlCount === 0) {
    return {
      id: "sitemap",
      status: "needs_attention",
      summary: "Foundfy fetched a sitemap, but it did not list any URLs Foundfy could read.",
      detail:
        "A sitemap helps discovery; it does not mean Google has indexed those URLs.",
    };
  }

  const listed = sitemapUrlCount === 1 ? "1 URL" : `${sitemapUrlCount} URLs`;
  return {
    id: "sitemap",
    status: "verified",
    summary: `Foundfy fetched a sitemap that lists ${listed}.`,
    detail:
      "A sitemap helps discovery; it does not mean Google has indexed those URLs.",
  };
}

export function evaluateCrawlFoundations(input: {
  context: CrawlEvidenceContext | null;
  findings: AnalysisFinding[];
}): CrawlFoundationsAssessment {
  const { context, findings } = input;
  if (!context) {
    return emptyCrawlAssessment(findings);
  }

  const homepageBlock =
    detectHomepageBlockFromEvidence(context) ??
    detectHomepageBlockFromFindings(findings, context.hostname);
  const homepagePage = context.pages.find((page) =>
    pageIsHomepage(page, context.hostname),
  );
  const discoveredUrlCount = new Set(context.queue.map((item) => item.url)).size;
  const pendingOrUnfetched = context.queue.some(
    (item) => item.status === "pending" || item.status === "queued",
  );
  const sampleLimited =
    context.pages.length >= MAX_PAGES_PER_CRAWL ||
    (discoveredUrlCount > 0 && context.pages.length < discoveredUrlCount) ||
    pendingOrUnfetched;
  const allSitemapUrls = extractSitemapUrls(
    context.artifacts.filter((artifact) => artifact.artifactType === "sitemap_xml"),
  );
  const sitemapUrlCount = allSitemapUrls.length;
  const sitemapUrls = allSitemapUrls.slice(0, FOUNDATION_SITEMAP_PREVIEW_LIMIT);

  const importantRobotsBlocked =
    homepageBlock === "robots_disallow" ||
    context.queue.some(
      (item) =>
        item.skipReason === "robots_disallow" &&
        isImportantUrl(item.url, context.hostname),
    ) ||
    findings.some(
      (finding) =>
        finding.ruleKey === "indexability.robots_blocked_url" &&
        findingTouchesImportantPage(finding, context.hostname),
    );

  const hasImportantFetchError =
    homepageBlock === "non_200" ||
    context.pages.some(
      (page) =>
        pageIsImportant(page, context.hostname) &&
        page.statusCode !== null &&
        page.statusCode !== 200,
    ) ||
    findings.some(
      (finding) =>
        finding.ruleKey === "indexability.non_200_page" &&
        findingTouchesImportantPage(finding, context.hostname),
    );

  const hasImportantIndexabilityBlock =
    homepageBlock === "noindex" ||
    context.pages.some(
      (page) =>
        pageIsImportant(page, context.hostname) &&
        hasNoindex(page.robotsMeta, page.xRobotsTag),
    ) ||
    findings.some(
      (finding) =>
        finding.ruleKey === "indexability.canonical_points_elsewhere" &&
        findingTouchesImportantPage(finding, context.hostname),
    );

  const hasSitemapUrlIssues = findings.some(
    (finding) => finding.ruleKey === "site_discovery.sitemap_url_issue",
  );

  return {
    crawlRunId: context.crawlRunId,
    hostname: context.hostname,
    pagesFetched: context.pages.length,
    discoveredUrlCount,
    sampleLimited,
    fetchedPageUrls: context.pages.map((page) => page.finalUrl || page.requestedUrl),
    sitemapUrlCount,
    sitemapUrls,
    homepageBlock,
    hasImportantFetchError,
    hasImportantIndexabilityBlock,
    hasSitemapUrlIssues,
    checks: {
      importantPages: evaluateImportantPages({
        context,
        homepageBlock,
        homepagePage,
        sampleLimited,
        discoveredUrlCount,
      }),
      crawlability: evaluateCrawlability({
        context,
        homepageBlock,
        importantRobotsBlocked,
      }),
      indexability: evaluateIndexability({
        context,
        findings,
        homepageBlock,
        homepagePage,
        hasImportantIndexabilityBlock,
      }),
      sitemap: evaluateSitemap({ context, findings, sitemapUrlCount }),
    },
  };
}

export function selectGoogleEvidenceForWebsite(
  stored: StoredGooglePerformanceEvidence | null,
  websiteId: string,
): GooglePerformanceEvidenceInput | null {
  if (!stored || stored.websiteId !== websiteId) {
    return null;
  }

  return stored.evidence;
}

export function visibleGoogleEvidenceForWebsite(
  stored: StoredGooglePerformanceEvidence,
  websiteId: string,
): StoredGooglePerformanceEvidence {
  return {
    websiteId,
    evidence: selectGoogleEvidenceForWebsite(stored, websiteId),
  };
}

export function evaluateGooglePerformance(
  input: GooglePerformanceEvidenceInput | null,
): FoundationCheck {
  if (input === null) {
    return {
      id: "google_performance",
      status: "not_checked",
      summary:
        "Foundfy has not finished checking whether Google has reported search performance.",
    };
  }

  switch (input.kind) {
    case "empty":
      return {
        id: "google_performance",
        status: "data_unavailable",
        summary: `Google Search Console synced, but reported no queries in the last ${input.windowDays} days.`,
        detail:
          "This is empty search performance from a completed sync. It is not proof that Google has not indexed the site, and it is not an indexing check.",
      };
    case "reported":
      return {
        id: "google_performance",
        status: "verified",
        summary:
          "Google reported search performance for this site. That is not an indexing check.",
        detail: `Foundfy saw ${input.queriesReported} ${input.queriesReported === 1 ? "query" : "queries"} in the last ${input.windowDays} days. Impressions are not an index status.`,
      };
    case "not_synced":
      return {
        id: "google_performance",
        status: "data_unavailable",
        summary:
          "Search performance is unavailable. Foundfy has not loaded Google search analytics for this site yet.",
      };
    case "not_connected":
      return {
        id: "google_performance",
        status: "data_unavailable",
        summary:
          "Search performance is unavailable. Search Console is not connected in this session.",
      };
    case "no_session":
      return {
        id: "google_performance",
        status: "data_unavailable",
        summary:
          "Search performance is unavailable in this view. Connect Google to see what Google reports.",
      };
    case "unavailable":
      return {
        id: "google_performance",
        status: "data_unavailable",
        summary:
          "Search performance is unavailable. Foundfy could not load Google search analytics right now.",
      };
  }
}

export function googleIndexingCheck(): FoundationCheck {
  return {
    id: "google_indexing",
    status: "not_checked",
    summary: "Foundfy has not checked whether Google has indexed these pages.",
    detail:
      "Foundfy does not inspect Google's index in this version. A crawl, a sitemap, or search performance is not an indexing result.",
  };
}

export function interpretFoundationNextStep(
  crawl: CrawlFoundationsAssessment | null,
  google: GooglePerformanceEvidenceInput | null,
): FoundationNextStep {
  if (!crawl || !crawl.crawlRunId) {
    return {
      code: "no_scan",
      message:
        "Run a scan so Foundfy can check whether important pages open, whether they look crawlable, and whether a sitemap is present.",
    };
  }

  if (crawl.homepageBlock === "noindex") {
    return {
      code: "review_homepage_block",
      message:
        "The homepage tells search engines not to list it. Review the noindex signal before expecting Google discovery.",
    };
  }

  if (crawl.homepageBlock === "robots_disallow") {
    return {
      code: "review_homepage_block",
      message:
        "robots.txt currently blocks the homepage. Review that disallow rule before expecting search engines to fetch the main page.",
    };
  }

  if (crawl.homepageBlock === "non_200") {
    return {
      code: "review_homepage_block",
      message:
        "The homepage did not return HTTP 200 in this scan. Fix that response before expecting search discovery.",
    };
  }

  if (crawl.hasImportantFetchError) {
    return {
      code: "review_fetch_error",
      message:
        "An important page in this scan did not return HTTP 200. Review that page before expecting search engines to use it.",
    };
  }

  if (crawl.hasImportantIndexabilityBlock) {
    return {
      code: "review_indexability_block",
      message:
        "An important page in this scan asks search engines not to list it, or points its canonical tag somewhere else. Review that signal first.",
    };
  }

  if (crawl.hasSitemapUrlIssues) {
    return {
      code: "review_sitemap_urls",
      message:
        "The sitemap lists URLs that did not fetch as expected. Review those sitemap URLs before treating discovery as complete.",
    };
  }

  if (google?.kind === "empty") {
    return {
      code: "wait_for_google_discovery",
      message:
        "For a newly launched site, the useful next step is to let Google discover the pages. Foundfy is not asking you to rewrite titles or submit changes yet. Search performance can stay empty for a while even after a sitemap is processed. Foundfy has not inspected Google's index.",
    };
  }

  if (google?.kind === "reported") {
    return {
      code: "indexing_not_checked",
      message:
        "These pages look technically consistent in Foundfy's scan sample. Foundfy has not checked whether Google has listed them.",
    };
  }

  if (google?.kind === "not_synced") {
    return {
      code: "sync_google_performance",
      message:
        "Search Console is connected. Load search performance with Sync Google search data. That refresh is owner-started. Foundfy does not run it on a schedule, and it does not ask Google to index the site. Foundfy has not checked whether Google has listed these pages.",
    };
  }

  if (google?.kind === "no_session") {
    return {
      code: "connect_google_for_performance",
      message:
        "Connect Google in this session to see whether Search Console has reported any searches. That is optional for reading this website scan, and it does not make Google index the site. Foundfy has not checked whether Google has listed these pages.",
    };
  }

  if (google?.kind === "not_connected") {
    return {
      code: "google_not_connected",
      message:
        "Search Console is not connected. You can connect it to see search performance. Connecting does not make Google index the site. Foundfy has not checked whether Google has listed these pages.",
    };
  }

  if (google?.kind === "unavailable") {
    return {
      code: "google_unavailable",
      message:
        "Foundfy could not load Google search analytics right now. That is not an indexing result. Foundfy has not checked whether Google has listed these pages.",
    };
  }

  return {
    code: "indexing_not_checked",
    message:
      "These pages look technically consistent in Foundfy's scan sample. Foundfy has not checked whether Google has listed them.",
  };
}
