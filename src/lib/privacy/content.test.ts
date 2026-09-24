import { describe, expect, it } from "vitest";
import { PRIVACY_INTRO, PRIVACY_PAGE_TITLE, PRIVACY_SECTIONS } from "./content";

describe("privacy page content", () => {
  it("discloses the current private-beta data practices", () => {
    const text = [PRIVACY_INTRO, ...PRIVACY_SECTIONS.map((section) => section.body)].join(
      " ",
    );

    expect(PRIVACY_PAGE_TITLE).toBe("Privacy");
    expect(text).toContain("submit a URL");
    expect(text).toContain("publicly accessible on-page content");
    expect(text).toContain("stored so you can return to scan history");
    expect(text).toContain("email");
    expect(text).toContain("role, interest, and an optional website");
    expect(text).toContain("Explain further");
    expect(text).toContain("OpenAI");
    expect(text).toContain("does not measure your rankings");
    expect(text).toContain("Google");
    expect(text).toContain("hello@foundfy.me");
    expect(text).not.toMatch(/legal basis|subprocessor|retain for|registered in/i);
  });

  it("discloses Search Console performance evidence and disconnect deletion", () => {
    const googleSection = PRIVACY_SECTIONS.find((section) => section.title === "Google account");
    expect(googleSection).toBeDefined();
    expect(googleSection?.body).toContain("Connect Google");
    expect(googleSection?.body).toContain("read-only Search Console access");
    expect(googleSection?.body).toContain("Google account identifier and email");
    expect(googleSection?.body).toContain("encrypted refresh token");
    expect(googleSection?.body).toContain("session cookie");
    expect(googleSection?.body).toContain("disconnect");
    expect(googleSection?.body).toContain("confirm which Search Console property");
    expect(googleSection?.body).toContain("impressions");
    expect(googleSection?.body).toContain("clicks");
    expect(googleSection?.body).toContain("CTR");
    expect(googleSection?.body).toContain("average position");
    expect(googleSection?.body).toContain("queries Google reported");
    expect(googleSection?.body).toContain("deletes stored Search Console performance evidence");
    expect(googleSection?.body).not.toMatch(/does not import Search Console performance data yet/i);
  });
});
