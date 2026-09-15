import type { SiteModelUnderstanding } from "../types";

export function collectSiteModelEvidenceText(
  understanding: SiteModelUnderstanding,
): string {
  const parts: string[] = [
    understanding.hostname,
    understanding.seedUrl,
    ...understanding.languages.htmlLangs,
    ...understanding.languages.urlLocales,
    ...understanding.navigationLabels,
    ...understanding.jsonLdTypes,
  ];

  for (const page of understanding.pages) {
    parts.push(
      page.requestedUrl,
      page.finalUrl,
      page.pathClass,
      page.title ?? "",
      ...page.h1,
      ...page.h2,
      ...page.h3,
      page.excerpt ?? "",
      page.htmlLang ?? "",
      page.urlLocale ?? "",
      ...page.navLabels,
      ...page.jsonLdTypes,
      ...page.jsonLdProperties.flatMap((item) => [
        item.type,
        item.name ?? "",
        item.description ?? "",
        item.brand ?? "",
        item.category ?? "",
        item.location ?? "",
        item.address?.addressLocality ?? "",
        item.address?.addressCountry ?? "",
      ]),
    );
  }

  return parts.filter(Boolean).join("\n");
}

export function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isGroundedInEvidence(value: string, evidenceText: string): boolean {
  const normalizedValue = normalizeComparableText(value);
  const normalizedEvidence = normalizeComparableText(evidenceText);

  if (normalizedValue.length < 4) {
    return false;
  }

  if (normalizedEvidence.includes(normalizedValue)) {
    return true;
  }

  const tokens = normalizedValue.split(" ").filter((token) => token.length >= 4);
  if (tokens.length === 0) {
    return false;
  }

  const matched = tokens.filter((token) => normalizedEvidence.includes(token));
  return matched.length / tokens.length >= 0.6;
}
