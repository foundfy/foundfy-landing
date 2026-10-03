const NULL_FILE = `export const HOMEPAGE_META_DESCRIPTION: string | null = null;\n`;

const STRING_FILE =
  /^export const HOMEPAGE_META_DESCRIPTION: string \| null =\n  ("(?:\\.|[^"\\])*");\n$/;

export const HOMEPAGE_DESCRIPTION_FILE_PATH = "src/lib/seo/homepage-description.ts";

export function parseHomepageDescriptionSource(source: string): string | null {
  const normalized = source.replace(/\r\n/g, "\n");
  if (normalized === NULL_FILE) {
    return null;
  }

  const match = STRING_FILE.exec(normalized);
  if (!match) {
    throw new Error("unexpected_source_shape");
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (typeof parsed !== "string" || !parsed.trim()) {
      throw new Error("unexpected_source_shape");
    }
    return parsed;
  } catch {
    throw new Error("unexpected_source_shape");
  }
}

export function renderHomepageDescriptionSource(value: string | null): string {
  if (value == null) {
    return NULL_FILE;
  }

  return `export const HOMEPAGE_META_DESCRIPTION: string | null =\n  ${JSON.stringify(value)};\n`;
}
