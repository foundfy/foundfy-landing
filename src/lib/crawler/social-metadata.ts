import type { ParsedPage } from "./types";

export const STORED_SOCIAL_METADATA_KEYS = [
  "html_meta_description",
  "og_description",
  "og_image",
  "og_image_alt",
  "og_image_type",
  "og_image_width",
  "og_image_height",
  "twitter_card",
  "twitter_description",
  "twitter_image",
  "twitter_image_alt",
] as const;

export type StoredSocialMetadataKey = (typeof STORED_SOCIAL_METADATA_KEYS)[number];

export type StoredSocialMetadata = Record<StoredSocialMetadataKey, string | null>;

export type CollectedSocialMetadata = {
  values: Partial<StoredSocialMetadata>;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function serializeCollectedSocialMetadata(
  parsed: Pick<ParsedPage, "htmlMetaDescription" | "socialMetadata">,
): StoredSocialMetadata | null {
  if (!parsed.socialMetadata) {
    return null;
  }

  const social = parsed.socialMetadata;
  return {
    html_meta_description: emptyToNull(parsed.htmlMetaDescription),
    og_description: emptyToNull(social.ogDescription),
    og_image: emptyToNull(social.ogImage),
    og_image_alt: emptyToNull(social.ogImageAlt),
    og_image_type: emptyToNull(social.ogImageType),
    og_image_width: emptyToNull(social.ogImageWidth),
    og_image_height: emptyToNull(social.ogImageHeight),
    twitter_card: emptyToNull(social.twitterCard),
    twitter_description: emptyToNull(social.twitterDescription),
    twitter_image: emptyToNull(social.twitterImage),
    twitter_image_alt: emptyToNull(social.twitterImageAlt),
  };
}

export function parseCollectedSocialMetadata(value: unknown): CollectedSocialMetadata | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const values: Partial<StoredSocialMetadata> = {};

  for (const key of STORED_SOCIAL_METADATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const raw = record[key];
    if (raw == null) {
      values[key] = null;
      continue;
    }

    if (typeof raw !== "string") {
      continue;
    }

    values[key] = emptyToNull(raw);
  }

  return { values };
}
