import type { RedirectHop } from "@/lib/crawler/types";
import type { AnalysisFinding, PriorityLevel } from "./crawl-status";
import {
  formatSearchPresenceCopy,
  type HomepageDiscovery,
} from "./search-presence";

export const ALL_FINDINGS_COLLAPSE_AFTER = 4;

const HIGH_PRIORITY_LEVELS = new Set<PriorityLevel>(["critical", "high"]);
const ACTIONABLE_PRIORITY_LEVELS = new Set<PriorityLevel>([
  "critical",
  "high",
  "medium",
]);

const GROUPED_PROBLEM_TITLES: Record<string, { one: string; many: string }> = {
  "indexability.non_200_page": {
    one: "Page did not return HTTP 200",
    many: "Pages did not return HTTP 200",
  },
  "indexability.robots_blocked_url": {
    one: "URL blocked by robots.txt",
    many: "URLs blocked by robots.txt",
  },
  "indexability.noindex": {
    one: "Page marked noindex",
    many: "Pages marked noindex",
  },
  "indexability.redirecting_url": {
    one: "URL redirects before final page",
    many: "URLs redirect before the final page",
  },
  "indexability.canonical_missing": {
    one: "Canonical URL missing",
    many: "Canonical URLs missing",
  },
  "indexability.canonical_points_elsewhere": {
    one: "This page tells Google another page is the real one",
    many: "These pages tell Google another page is the real one",
  },
  "page_fundamentals.missing_title": {
    one: "Missing page title",
    many: "Missing page titles",
  },
  "page_fundamentals.duplicate_title": {
    one: "Duplicate page title",
    many: "Duplicate page titles",
  },
  "page_fundamentals.title_length_out_of_range": {
    one: "Title length outside recommended range",
    many: "Title lengths outside recommended range",
  },
  "page_fundamentals.missing_meta_description": {
    one: "Missing meta description",
    many: "Missing meta descriptions",
  },
  "page_fundamentals.duplicate_meta_description": {
    one: "Duplicate meta description",
    many: "Duplicate meta descriptions",
  },
  "page_fundamentals.missing_h1": {
    one: "Missing H1",
    many: "Missing H1 headings",
  },
  "page_fundamentals.multiple_h1": {
    one: "Multiple H1 headings",
    many: "Multiple H1 headings",
  },
  "internal_structure.zero_internal_links": {
    one: "No outgoing internal links",
    many: "Pages with no outgoing internal links",
  },
  "internal_structure.broken_internal_link": {
    one: "Broken internal link",
    many: "Broken internal links",
  },
  "internal_structure.orphan_sitemap_page": {
    one: "Sitemap page lacks internal links",
    many: "Sitemap pages lack internal links",
  },
  "site_discovery.robots_txt_missing": {
    one: "robots.txt missing or unreachable",
    many: "robots.txt missing or unreachable",
  },
  "site_discovery.sitemap_missing": {
    one: "Sitemap missing or unreachable",
    many: "Sitemap missing or unreachable",
  },
  "site_discovery.sitemap_url_issue": {
    one: "Sitemap URL has crawl issues",
    many: "Sitemap URLs have crawl issues",
  },
};

export type ResultsBriefGroup = {
  ruleKey: string;
  title: string;
  affectedPageCount: number;
  priorityLevel: PriorityLevel | null;
};

function isRedirectHop(value: unknown): value is RedirectHop {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "statusCode" in value
  );
}

export function formatFindingEvidence(finding: AnalysisFinding): string | null {
  const { evidence, ruleKey } = finding;

  if (ruleKey === "indexability.redirecting_url") {
    const redirectChain = Array.isArray(evidence.redirectChain)
      ? evidence.redirectChain.filter(isRedirectHop)
      : [];
    const finalUrl =
      typeof evidence.finalUrl === "string" ? evidence.finalUrl : null;

    if (redirectChain.length > 0 && finalUrl) {
      const hop = redirectChain[0];
      return `${hop.statusCode} redirect → ${finalUrl}`;
    }

    if (
      typeof evidence.requestedUrl === "string" &&
      typeof evidence.finalUrl === "string"
    ) {
      return `${evidence.requestedUrl} → ${evidence.finalUrl}`;
    }
  }

  const entries = Object.entries(evidence).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return null;
  }

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export function formatPriorityLabel(level: PriorityLevel): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Low";
  }
}

export function formatFindingPath(pageUrl: string | null): string | null {
  if (!pageUrl) {
    return null;
  }

  try {
    const url = new URL(pageUrl);
    const path = `${url.pathname}${url.search}` || "/";
    return path;
  } catch {
    return pageUrl;
  }
}

export function formatFindingHostPath(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    const path = `${url.pathname}${url.search}` || "/";
    return `${url.hostname}${path}`;
  } catch {
    return pageUrl;
  }
}

export function shouldShowHostInAffectedPages(urls: string[]): boolean {
  const hosts = new Set<string>();

  for (const url of urls) {
    try {
      hosts.add(new URL(url).hostname.toLowerCase());
    } catch {
      hosts.add(url);
    }
  }

  return hosts.size > 1;
}

export function formatAffectedPageLabel(
  pageUrl: string,
  options?: { includeHost?: boolean },
): string {
  if (options?.includeHost) {
    return formatFindingHostPath(pageUrl);
  }

  return formatFindingPath(pageUrl) ?? pageUrl;
}

export const AFFECTED_PAGE_PREVIEW_COUNT = 3;

export function formatJobCount(count: number): string {
  if (count === 1) {
    return "1 job";
  }

  return `${count} jobs`;
}

export function readSharedTitle(evidence: Record<string, unknown>): string | null {
  const title = evidence.title;
  if (typeof title !== "string") {
    return null;
  }

  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatSharedTitleLine(
  title: string | null,
  affectedPageCount: number,
): string | null {
  if (!title) {
    return null;
  }

  if (affectedPageCount <= 1) {
    return `Title: "${title}"`;
  }

  return `${affectedPageCount} pages use the same title: "${title}"`;
}

export function formatFindingsCount(count: number): string {
  if (count === 1) {
    return "We found 1 finding.";
  }

  return `We found ${count} findings.`;
}

export function formatZeroFindingsCopy(
  discovery: HomepageDiscovery | null = null,
): {
  title: string;
  description: string;
} {
  const copy = formatSearchPresenceCopy(discovery);
  return {
    title: copy.title,
    description: copy.description,
  };
}

export function formatEmptyHighlightsCopy(
  discovery: HomepageDiscovery | null = null,
): {
  title: string;
  description: string;
} {
  return formatZeroFindingsCopy(discovery);
}

export function formatGroupedProblemTitle(
  ruleKey: string,
  fallbackTitle: string,
  affectedPageCount: number,
): string {
  const titles = GROUPED_PROBLEM_TITLES[ruleKey];
  if (!titles) {
    return fallbackTitle;
  }

  return affectedPageCount > 1 ? titles.many : titles.one;
}

export function formatGroupedFindingTitle(
  ruleKey: string,
  fallbackTitle: string,
  affectedPageCount: number,
): string {
  return formatGroupedProblemTitle(ruleKey, fallbackTitle, affectedPageCount);
}

export function formatAffectedPagesPhrase(affectedPageCount: number): string {
  if (affectedPageCount <= 0) {
    return "";
  }

  if (affectedPageCount === 1) {
    return "on 1 page";
  }

  return `on ${affectedPageCount} pages`;
}

function lowercaseLeading(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toLowerCase() + value.slice(1);
}

export function formatResultsBrief(
  groups: ResultsBriefGroup[],
  options?: { homepageDiscovery?: HomepageDiscovery | null },
): string {
  const firstActionable = groups.find(
    (group) =>
      group.priorityLevel !== null &&
      ACTIONABLE_PRIORITY_LEVELS.has(group.priorityLevel),
  );

  if (!firstActionable) {
    return formatSearchPresenceCopy(options?.homepageDiscovery ?? null).brief;
  }

  const problem = formatGroupedProblemTitle(
    firstActionable.ruleKey,
    firstActionable.title,
    firstActionable.affectedPageCount,
  );
  const pages = formatAffectedPagesPhrase(firstActionable.affectedPageCount);
  const lead = pages ? `${problem} ${pages}` : problem;

  const next = groups.find(
    (group) =>
      group !== firstActionable &&
      group.priorityLevel !== null &&
      ACTIONABLE_PRIORITY_LEVELS.has(group.priorityLevel),
  );

  if (next) {
    const nextTitle = lowercaseLeading(
      formatGroupedProblemTitle(next.ruleKey, next.title, next.affectedPageCount),
    );
    return `${lead}. Next: ${nextTitle}.`;
  }

  return `${lead}.`;
}

export function formatSeriousnessLine(groups: ResultsBriefGroup[]): string | null {
  const highPriorityCount = groups.filter(
    (group) =>
      group.priorityLevel !== null &&
      HIGH_PRIORITY_LEVELS.has(group.priorityLevel),
  ).length;

  if (highPriorityCount === 0) {
    return null;
  }

  if (highPriorityCount === 1) {
    return "1 high-priority issue needs attention.";
  }

  return `${highPriorityCount} high-priority issues need attention.`;
}

export function shouldCollapseAllFindings(groupCount: number): boolean {
  return groupCount >= ALL_FINDINGS_COLLAPSE_AFTER;
}
