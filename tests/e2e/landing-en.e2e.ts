import { expect, test } from "@playwright/test";
import {
  SCREENSHOT_STYLE,
  completeEarlyAccessForm,
  expectNoUnexpectedApiCalls,
  guardNetwork,
  openForScreenshot,
  readHead,
} from "./support";

// The English experience must stay visually and functionally unchanged.
// These baselines were captured from `main` before the Spanish work started.
// The only expected pixel noise is the hero input's typing placeholder, which is
// timer-driven and may be caught mid-word; the default tolerance absorbs it.

test("English home looks unchanged", async ({ page }) => {
  const { unexpectedApiCalls } = await guardNetwork(page);
  await openForScreenshot(page, "/");
  await expect(page).toHaveScreenshot("en-home.png", {
    fullPage: true,
    stylePath: SCREENSHOT_STYLE,
  });
  expectNoUnexpectedApiCalls(unexpectedApiCalls);
});

test("English home keeps its language and metadata", async ({ page }) => {
  await guardNetwork(page);
  await page.goto("/");
  const head = await readHead(page);
  expect(head.lang).toBe("en");
  expect(head.title).toBe("Foundfy | Be found wherever people search.");
  expect(head.description).toBe(
    "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.",
  );
  expect(head.robots).toBeNull();
  expect(head.canonical).toBe("https://www.foundfy.me");
  expect(head.ogLocale).toBe("en_US");
});

test("English early access form submits the same payload", async ({ page }) => {
  const { earlyAccessRequests, unexpectedApiCalls } = await guardNetwork(page);
  await page.goto("/");
  const section = await completeEarlyAccessForm(page, {
    role: "business-owner",
    interest: "seo",
    website: "example.com",
    email: "owner@example.com",
    continueLabel: "Continue",
    submitLabel: "Get early access",
  });
  await expect(section.getByText("YOU'RE EARLY.")).toBeVisible();
  expect(earlyAccessRequests).toEqual([
    {
      role: "business-owner",
      interest: "seo",
      website: "example.com",
      email: "owner@example.com",
    },
  ]);
  expectNoUnexpectedApiCalls(unexpectedApiCalls);
});

test("English form rejects an invalid email in English", async ({ page }) => {
  const { earlyAccessRequests } = await guardNetwork(page);
  await page.goto("/");
  const section = page.locator("#early-access");
  await section.scrollIntoViewIfNeeded();
  await section.locator("select#role").selectOption("agency");
  await section.locator("select#interest").selectOption("all");
  await section.getByRole("button", { name: "Skip website and continue" }).click();
  await section.locator("input#email").fill("not-an-email");
  await section.locator("input#email").press("Enter");
  await expect(section.getByRole("button", { name: "Get early access" })).toBeDisabled();
  expect(earlyAccessRequests).toEqual([]);
});

test.describe("public routes", () => {
  test.skip(({ isMobile }) => isMobile, "route checks run once");

  for (const pathname of [
    "/",
    "/privacy",
    "/product",
    "/pricing",
    "/changelog",
    "/resources",
    "/sign-in",
  ]) {
    test(`${pathname} responds 200 in English`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('<html lang="en"');
    });
  }

  test("unknown routes respond 404", async ({ request }) => {
    const response = await request.get("/this-page-does-not-exist");
    expect(response.status()).toBe(404);
  });

  test("robots.txt and sitemap.xml are unchanged", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap: https://www.foundfy.me/sitemap.xml");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://www.foundfy.me</loc>");
    expect(sitemap).not.toContain("/es");
  });
});
