import type { RobotsRules } from "../types";
import { normalizeCrawlUrl } from "../url/normalize";

function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function parseRobotsLines(content: string): RobotsRules {
  const lines = content.split(/\r?\n/);
  const rules: RobotsRules = {
    sitemaps: [],
    disallow: [],
    allow: [],
  };

  let inWildcardAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === "user-agent") {
      inWildcardAgent = value === "*";
      continue;
    }

    if (!inWildcardAgent) {
      continue;
    }

    if (directive === "disallow" && value) {
      rules.disallow.push(normalizePath(value));
    }

    if (directive === "allow" && value) {
      rules.allow.push(normalizePath(value));
    }

    if (directive === "sitemap" && value) {
      rules.sitemaps.push(value);
    }
  }

  return rules;
}

export function parseRobotsTxt(content: string): RobotsRules {
  return parseRobotsLines(content);
}

function pathMatchesRule(pathname: string, rulePath: string): boolean {
  if (rulePath === "/") {
    return true;
  }

  return pathname.startsWith(rulePath);
}

export function isAllowedByRobots(pathname: string, rules: RobotsRules): boolean {
  const path = normalizePath(pathname);

  let bestAllowLength = -1;
  let bestDisallowLength = -1;

  for (const allowPath of rules.allow) {
    if (pathMatchesRule(path, allowPath) && allowPath.length > bestAllowLength) {
      bestAllowLength = allowPath.length;
    }
  }

  for (const disallowPath of rules.disallow) {
    if (pathMatchesRule(path, disallowPath) && disallowPath.length > bestDisallowLength) {
      bestDisallowLength = disallowPath.length;
    }
  }

  if (bestAllowLength === -1 && bestDisallowLength === -1) {
    return true;
  }

  return bestAllowLength >= bestDisallowLength;
}

export function discoverRobotsUrl(origin: string): string {
  return normalizeCrawlUrl("/robots.txt", origin) ?? `${origin.replace(/\/+$/, "")}/robots.txt`;
}

export function discoverDefaultSitemapUrls(origin: string): string[] {
  const normalized = origin.replace(/\/+$/, "");
  return [`${normalized}/sitemap.xml`, `${normalized}/sitemap_index.xml`];
}
