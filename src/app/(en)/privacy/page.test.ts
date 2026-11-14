import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EN_LANDING_COPY } from "@/lib/i18n/landing/en";

describe("privacy route", () => {
  it("exposes a public /privacy page with footer navigation", () => {
    const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const homeSource = readFileSync(path.join(__dirname, "../page.tsx"), "utf8");
    const footerSource = readFileSync(
      path.join(__dirname, "../../../components/Footer.tsx"),
      "utf8",
    );
    const landingSource = readFileSync(
      path.join(__dirname, "../../../components/LandingPage.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('title: "Privacy | Foundfy"');
    expect(pageSource).toContain('canonical: "/privacy"');
    expect(pageSource).toContain('href="/"');
    expect(pageSource).toContain("<Footer");
    // The footer link comes from the locale copy; English defaults to /privacy.
    expect(footerSource).toContain("copy = EN_LANDING_COPY.footer");
    expect(footerSource).toContain("href={copy.privacy.href}");
    expect(EN_LANDING_COPY.footer.privacy.href).toBe("/privacy");
    expect(homeSource).toContain("<LandingPage");
    expect(landingSource).toContain("<Footer");
  });
});
