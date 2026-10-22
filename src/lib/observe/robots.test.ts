import { describe, expect, it } from "vitest";
import { persistedRobotsAllowsPath } from "./robots";

describe("persisted robots interpretation", () => {
  it("fails closed when the artifact is missing", () => {
    expect(persistedRobotsAllowsPath("/es/page", null)).toBe(false);
  });

  it("fails closed when status_code is null even with empty parsed rules", () => {
    expect(
      persistedRobotsAllowsPath("/es/page", {
        statusCode: null,
        content: null,
        parsed: { allow: [], disallow: [], sitemaps: [] },
      }),
    ).toBe(false);
  });

  it("treats HTTP 404 as permissive", () => {
    expect(
      persistedRobotsAllowsPath("/es/page", {
        statusCode: 404,
        content: "",
        parsed: { allow: [], disallow: [], sitemaps: [] },
      }),
    ).toBe(true);
  });

  it("applies parsed disallow on 200", () => {
    expect(
      persistedRobotsAllowsPath("/private", {
        statusCode: 200,
        content: "User-agent: *\nDisallow: /private",
        parsed: { allow: [], disallow: ["/private"], sitemaps: [] },
      }),
    ).toBe(false);
  });

  it("fails closed on 5xx and non-404 4xx", () => {
    expect(
      persistedRobotsAllowsPath("/", { statusCode: 503, content: null, parsed: null }),
    ).toBe(false);
    expect(
      persistedRobotsAllowsPath("/", { statusCode: 403, content: null, parsed: null }),
    ).toBe(false);
  });
});
