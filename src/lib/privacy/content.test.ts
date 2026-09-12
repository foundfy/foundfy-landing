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
    expect(text).not.toMatch(/legal basis|subprocessor|cookie|retain for|registered in/i);
  });
});
