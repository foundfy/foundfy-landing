import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("privacy route", () => {
  it("exposes a public /privacy page with footer navigation", () => {
    const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const homeSource = readFileSync(path.join(__dirname, "../page.tsx"), "utf8");
    const footerSource = readFileSync(
      path.join(__dirname, "../../components/Footer.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('title: "Privacy | Foundfy"');
    expect(pageSource).toContain('canonical: "/privacy"');
    expect(pageSource).toContain('href="/"');
    expect(pageSource).toContain("<Footer");
    expect(footerSource).toContain('href="/privacy"');
    expect(homeSource).toContain("<Footer");
  });
});
