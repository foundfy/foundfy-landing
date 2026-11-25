import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// The staircase favicon is declared once, from the app root, on every page type
// (both languages, content pages and both 404s), in the server HTML (no JS).
const APP_DIR = path.join(__dirname, "..", "..", "src", "app");
const PAGES = [
  ["/", 200],
  ["/privacy", 200],
  ["/changelog", 200],
  ["/es", 200],
  ["/es/privacidad", 200],
  ["/es/como-funciona", 200],
  ["/this-page-does-not-exist", 404],
  ["/es/esto-no-existe", 404],
] as const;

test.describe("favicon", () => {
  test.skip(({ isMobile }) => isMobile, "head and asset checks run once");

  for (const [pathname, status] of PAGES) {
    test(`${pathname} declares the favicon and Apple touch icon once`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(status);
      const html = await response.text();
      const icons = html.match(/<link rel="icon"[^>]*>/g) ?? [];
      expect(icons).toEqual(['<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>']);
      expect(html).not.toContain('rel="shortcut icon"');
      expect(html.match(/<link rel="apple-touch-icon" href="\/apple-icon\.png\?[^"]+" type="image\/png" sizes="180x180"\/>/g)).toHaveLength(1);
    });
  }

  test("serves the committed icon files with image content types", async ({ request }) => {
    const ico = await request.get("/favicon.ico");
    expect(ico.status()).toBe(200);
    expect(ico.headers()["content-type"]).toBe("image/x-icon");
    expect(Buffer.from(await ico.body()).equals(readFileSync(path.join(APP_DIR, "favicon.ico")))).toBe(true);

    const html = await (await request.get("/")).text();
    const appleHref = html.match(/rel="apple-touch-icon" href="([^"]+)"/)?.[1];
    expect(appleHref).toBeTruthy();
    const apple = await request.get(appleHref!);
    expect(apple.status()).toBe(200);
    expect(apple.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await apple.body()).equals(readFileSync(path.join(APP_DIR, "apple-icon.png")))).toBe(true);
  });

  test("keeps a single favicon after hydration, including the Spanish 404", async ({ page }) => {
    await page.route("**/_vercel/**", (route) => route.abort());
    for (const pathname of ["/", "/es/como-funciona", "/es/esto-no-existe"]) {
      await page.goto(pathname, { waitUntil: "networkidle" });
      await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
      await expect(page.locator('head link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
      await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
    }
  });
});
