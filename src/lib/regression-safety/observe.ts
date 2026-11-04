import {
  parseCollectedSocialMetadata,
  type StoredSocialMetadataKey,
} from "@/lib/crawler/social-metadata";
import type { ParsedPage, ParsedSocialMetadata } from "@/lib/crawler/types";
import { normalizeComparisonUrl } from "@/lib/findings/comparison/normalize-comparison-url";
import type {
  ObservedField,
  PageMetadataEvidence,
  RegressionSafetyField,
} from "./types";

export const STORED_CRAWL_FIELDS: readonly RegressionSafetyField[] = [
  "title",
  "meta_description",
  "canonical",
  "robots_meta",
];

export const SOCIAL_FIELDS: readonly RegressionSafetyField[] = [
  "og_description",
  "og_image",
  "og_image_alt",
  "twitter_description",
  "twitter_image",
  "twitter_image_alt",
  "twitter_card",
];

export const RELATED_DESCRIPTION_FIELDS: readonly RegressionSafetyField[] = [
  "og_description",
  "twitter_description",
];

export const DEFAULT_PRESERVE_FIELDS: readonly RegressionSafetyField[] = [
  "title",
  "canonical",
  "robots_meta",
  "og_image",
  "og_image_alt",
  "twitter_image",
  "twitter_image_alt",
  "twitter_card",
];

export function pageIdentityKey(url: string | null | undefined): string | null {
  const normalized = normalizeComparisonUrl(url);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const pathname =
      parsed.pathname === "" || parsed.pathname === "/"
        ? "/"
        : parsed.pathname.replace(/\/+$/, "") || "/";
    return `https://${parsed.hostname}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function collectedField(value: string | null | undefined): ObservedField {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length > 0) {
    return { presence: "present", value: trimmed };
  }

  return { presence: "absent", value: null };
}

export function unknownField(): ObservedField {
  return { presence: "unknown", value: null };
}

export function emptyPageFields(
  social: "unknown" | "collected",
): Record<RegressionSafetyField, ObservedField> {
  const unknown = social === "unknown";
  return {
    title: collectedField(null),
    meta_description: collectedField(null),
    canonical: collectedField(null),
    robots_meta: collectedField(null),
    og_description: unknown ? unknownField() : collectedField(null),
    og_image: unknown ? unknownField() : collectedField(null),
    og_image_alt: unknown ? unknownField() : collectedField(null),
    twitter_description: unknown ? unknownField() : collectedField(null),
    twitter_image: unknown ? unknownField() : collectedField(null),
    twitter_image_alt: unknown ? unknownField() : collectedField(null),
    twitter_card: unknown ? unknownField() : collectedField(null),
  };
}

export function pageEvidenceFromStoredPage(input: {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
}): PageMetadataEvidence {
  return {
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    fields: {
      ...emptyPageFields("unknown"),
      title: collectedField(input.title),
      meta_description: collectedField(input.metaDescription),
      canonical: collectedField(input.canonical),
      robots_meta: collectedField(input.robotsMeta),
    },
  };
}

function collectedStoredField(
  collected: ReturnType<typeof parseCollectedSocialMetadata>,
  key: StoredSocialMetadataKey,
): ObservedField {
  if (!collected || !Object.prototype.hasOwnProperty.call(collected.values, key)) {
    return unknownField();
  }

  return collectedField(collected.values[key]);
}

export function pageEvidenceFromPersistedPage(input: {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  socialMetadata: unknown;
}): PageMetadataEvidence {
  const collected = parseCollectedSocialMetadata(input.socialMetadata);
  if (!collected) {
    return pageEvidenceFromStoredPage(input);
  }

  return {
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    fields: {
      title: collectedField(input.title),
      meta_description: collectedStoredField(collected, "html_meta_description"),
      canonical: collectedField(input.canonical),
      robots_meta: collectedField(input.robotsMeta),
      og_description: collectedStoredField(collected, "og_description"),
      og_image: collectedStoredField(collected, "og_image"),
      og_image_alt: collectedStoredField(collected, "og_image_alt"),
      twitter_description: collectedStoredField(collected, "twitter_description"),
      twitter_image: collectedStoredField(collected, "twitter_image"),
      twitter_image_alt: collectedStoredField(collected, "twitter_image_alt"),
      twitter_card: collectedStoredField(collected, "twitter_card"),
    },
  };
}

export function pageEvidenceFromParsedPage(page: ParsedPage): PageMetadataEvidence {
  const social: ParsedSocialMetadata | undefined = page.socialMetadata;
  return {
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    fields: {
      title: collectedField(page.title),
      meta_description:
        page.htmlMetaDescription !== undefined
          ? collectedField(page.htmlMetaDescription)
          : collectedField(page.metaDescription),
      canonical: collectedField(page.canonical),
      robots_meta: collectedField(page.robotsMeta),
      og_description: social ? collectedField(social.ogDescription) : unknownField(),
      og_image: social ? collectedField(social.ogImage) : unknownField(),
      og_image_alt: social ? collectedField(social.ogImageAlt) : unknownField(),
      twitter_description: social ? collectedField(social.twitterDescription) : unknownField(),
      twitter_image: social ? collectedField(social.twitterImage) : unknownField(),
      twitter_image_alt: social ? collectedField(social.twitterImageAlt) : unknownField(),
      twitter_card: social ? collectedField(social.twitterCard) : unknownField(),
    },
  };
}

export function fieldValuesEqual(left: ObservedField, right: ObservedField): boolean {
  if (left.presence !== "present" || right.presence !== "present") {
    return left.presence === right.presence && left.presence !== "unknown";
  }

  return left.value === right.value;
}
