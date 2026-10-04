import { describe, expect, it } from "vitest";
import { isFoundfyHomepageMetaTarget } from "./target";

describe("isFoundfyHomepageMetaTarget", () => {
  it("accepts Foundfy homepage meta description only", () => {
    expect(
      isFoundfyHomepageMetaTarget({
        hostname: "foundfy.me",
        pageUrl: "https://www.foundfy.me/",
        field: "meta_description",
        actionType: "update_meta_description",
      }),
    ).toBe(true);
    expect(
      isFoundfyHomepageMetaTarget({
        hostname: "www.foundfy.me",
        pageUrl: "https://foundfy.me/",
        field: "meta_description",
        actionType: "update_meta_description",
      }),
    ).toBe(true);
  });

  it("rejects every other website, URL, or field", () => {
    expect(
      isFoundfyHomepageMetaTarget({
        hostname: "www.dbhobby.com",
        pageUrl: "https://www.dbhobby.com/",
        field: "meta_description",
        actionType: "update_meta_description",
      }),
    ).toBe(false);
    expect(
      isFoundfyHomepageMetaTarget({
        hostname: "foundfy.me",
        pageUrl: "https://www.foundfy.me/privacy",
        field: "meta_description",
        actionType: "update_meta_description",
      }),
    ).toBe(false);
    expect(
      isFoundfyHomepageMetaTarget({
        hostname: "foundfy.me",
        pageUrl: "https://www.foundfy.me/",
        field: "title",
        actionType: "update_meta_description",
      }),
    ).toBe(false);
  });
});
