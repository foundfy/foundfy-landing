import { isAllowedByRobots, parseRobotsTxt } from "@/lib/crawler/discover/robots";
import type { RobotsRules } from "@/lib/crawler/types";

export type PersistedRobotsArtifact = {
  statusCode: number | null;
  content: string | null;
  parsed: unknown;
};

function asRobotsRules(parsed: unknown): RobotsRules | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as {
    allow?: unknown;
    disallow?: unknown;
    sitemaps?: unknown;
  };
  if (!Array.isArray(record.allow) || !Array.isArray(record.disallow)) {
    return null;
  }

  return {
    allow: record.allow.filter((item): item is string => typeof item === "string"),
    disallow: record.disallow.filter((item): item is string => typeof item === "string"),
    sitemaps: Array.isArray(record.sitemaps)
      ? record.sitemaps.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function persistedRobotsAllowsPath(
  pathname: string,
  artifact: PersistedRobotsArtifact | null,
): boolean {
  if (!artifact) {
    return false;
  }

  if (artifact.statusCode == null) {
    return false;
  }

  if (artifact.statusCode >= 500) {
    return false;
  }

  if (artifact.statusCode === 404) {
    return true;
  }

  if (artifact.statusCode < 200 || artifact.statusCode >= 300) {
    return false;
  }

  const rules =
    asRobotsRules(artifact.parsed) ??
    (typeof artifact.content === "string" ? parseRobotsTxt(artifact.content) : null);
  if (!rules) {
    return false;
  }

  return isAllowedByRobots(pathname, rules);
}
