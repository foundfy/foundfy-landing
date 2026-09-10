export function formatDisplayUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}` || "/";
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

export function formatDisplayPath(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return path || "/";
  } catch {
    return url;
  }
}

export function readString(
  evidence: Record<string, unknown>,
  key: string,
): string | null {
  const value = evidence[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readNumber(
  evidence: Record<string, unknown>,
  key: string,
): number | null {
  const value = evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readStringArray(
  evidence: Record<string, unknown>,
  key: string,
): string[] {
  const value = evidence[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
}

export function formatPageList(urls: string[], maxItems = 3): string | null {
  if (urls.length === 0) {
    return null;
  }

  const paths = urls
    .map((url) => formatDisplayPath(url) ?? url)
    .filter((path) => path.length > 0);

  if (paths.length === 0) {
    return null;
  }

  if (paths.length === 1) {
    return paths[0];
  }

  const shown = paths.slice(0, maxItems);
  const remaining = paths.length - shown.length;

  if (remaining > 0) {
    return `${shown.join(", ")} and ${remaining} more`;
  }

  return shown.join(", ");
}

export function pageLabel(
  evidence: Record<string, unknown>,
  pageUrl: string | null,
): string | null {
  return (
    formatDisplayPath(readString(evidence, "finalUrl")) ??
    formatDisplayPath(readString(evidence, "requestedUrl")) ??
    formatDisplayPath(pageUrl)
  );
}
