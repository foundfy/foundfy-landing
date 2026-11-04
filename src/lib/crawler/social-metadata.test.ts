import { describe, expect, it } from "vitest";
import { parseCollectedSocialMetadata, serializeCollectedSocialMetadata } from "./social-metadata";

describe("collected social metadata provenance", () => {
  it("serializes a parsed page as collected, including observed-absent fields", () => {
    const stored = serializeCollectedSocialMetadata({
      htmlMetaDescription: "About the director.",
      socialMetadata: {
        ogDescription: "About the director.",
        ogImage: null,
        ogImageAlt: null,
        ogImageType: null,
        ogImageWidth: null,
        ogImageHeight: null,
        twitterCard: "summary_large_image",
        twitterDescription: "About the director.",
        twitterImage: null,
        twitterImageAlt: null,
      },
    });

    expect(stored).toEqual({
      html_meta_description: "About the director.",
      og_description: "About the director.",
      og_image: null,
      og_image_alt: null,
      og_image_type: null,
      og_image_width: null,
      og_image_height: null,
      twitter_card: "summary_large_image",
      twitter_description: "About the director.",
      twitter_image: null,
      twitter_image_alt: null,
    });
  });

  it("treats a missing socialMetadata object as not collected", () => {
    expect(serializeCollectedSocialMetadata({ htmlMetaDescription: "About", socialMetadata: undefined })).toBeNull();
    expect(parseCollectedSocialMetadata(null)).toBeNull();
    expect(parseCollectedSocialMetadata(undefined)).toBeNull();
  });

  it("does not treat a missing JSON key as an observed absence", () => {
    const collected = parseCollectedSocialMetadata({
      html_meta_description: "About the director.",
      og_description: "About the director.",
    });
    expect(collected).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(collected?.values, "og_image")).toBe(false);
    expect(collected?.values.og_image).toBeUndefined();
    expect(collected?.values.html_meta_description).toBe("About the director.");
  });
});
