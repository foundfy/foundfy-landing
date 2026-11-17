import { expect, test, type Page } from "@playwright/test";
import {
  SCREENSHOT_STYLE,
  expectNoUnexpectedApiCalls,
  guardNetwork,
  readHead,
} from "./support";

// 404 pages: English for any unknown URL (global-not-found), Spanish for unknown
// URLs under /es ((es)/not-found). The HTTP status must be a real 404.

async function backToTopIsHidden(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('button[class*="backToTop"]')).toHaveAttribute(
    "aria-hidden",
    "true",
  );
}

test.describe("raw HTTP responses", () => {
  test.skip(({ isMobile }) => isMobile, "HTTP checks run once");

  for (const pathname of ["/this-page-does-not-exist", "/wp-admin/setup.php", "/api/no-such-endpoint"]) {
    test(`${pathname} is a server-rendered English 404`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(404);
      const html = await response.text();
      expect(html).toContain('<html lang="en"');
      expect(html).toContain("<title>Page not found | Foundfy</title>");
      expect(html).toMatch(/<meta name="robots" content="noindex/);
      expect(html).toContain("This page doesn&#x27;t exist.");
    });
  }

  for (const pathname of ["/es/esto-no-existe", "/es/a/b/c"]) {
    test(`${pathname} returns 404 with noindex`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(404);
      const html = await response.text();
      expect(html).toMatch(/<meta name="robots" content="noindex/);
      // Next streams notFound() as an HTTP error fallback; the Spanish page is
      // in the payload and the browser renders it (checked below).
      expect(html).toContain("Esta página no existe.");
    });
  }

  test("existing pages keep their status", async ({ request }) => {
    for (const pathname of ["/", "/es", "/privacy", "/es/privacidad", "/product"]) {
      expect((await request.get(pathname)).status(), pathname).toBe(200);
    }
  });
});

test("English 404 page", async ({ page }) => {
  const { unexpectedApiCalls } = await guardNetwork(page);
  const response = await page.goto("/this-page-does-not-exist", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(404);
  const head = await readHead(page);
  expect(head.lang).toBe("en");
  expect(head.title).toBe("Page not found | Foundfy");
  expect(head.robots).toMatch(/noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  await expect(page.locator("footer").getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expect(page.locator('a[href^="/es"]')).toHaveCount(0);
  await backToTopIsHidden(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("en-404.png", { fullPage: true, stylePath: SCREENSHOT_STYLE });
  expectNoUnexpectedApiCalls(unexpectedApiCalls);
});

test("Spanish 404 page", async ({ page }) => {
  const { unexpectedApiCalls } = await guardNetwork(page);
  const response = await page.goto("/es/esto-no-existe", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Esta página no existe." })).toBeVisible();
  const head = await readHead(page);
  expect(head.lang).toBe("es");
  expect(head.title).toBe("Página no encontrada | Foundfy");
  expect(head.robots).toMatch(/noindex/);
  await expect(page.getByRole("link", { name: "Ir a la página de inicio" })).toHaveAttribute(
    "href",
    "/es",
  );
  await expect(page.locator("footer").getByRole("link", { name: "Privacidad" })).toHaveAttribute(
    "href",
    "/es/privacidad",
  );
  await backToTopIsHidden(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("es-404.png", { fullPage: true, stylePath: SCREENSHOT_STYLE });
  expectNoUnexpectedApiCalls(unexpectedApiCalls);
});

test.describe("Back to top", () => {
  test.skip(({ isMobile }) => isMobile, "desktop viewports set explicitly");

  test("stays hidden on pages that do not scroll", async ({ page }) => {
    await guardNetwork(page);
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1469, height: 807 },
    ]) {
      await page.setViewportSize(viewport);
      for (const pathname of ["/product", "/pricing", "/changelog"]) {
        await page.goto(pathname, { waitUntil: "networkidle" });
        await backToTopIsHidden(page);
      }
    }
  });

  test("still works on long pages", async ({ page }) => {
    await guardNetwork(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const pathname of ["/", "/es"]) {
      await page.goto(pathname, { waitUntil: "networkidle" });
      const button = page.locator('button[class*="backToTop"]');
      await expect(button).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(button).toHaveAttribute("aria-hidden", "false");
      await button.click();
      await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
      await expect(button).toHaveAttribute("aria-hidden", "true");
    }
  });
});
