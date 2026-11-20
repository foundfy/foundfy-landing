import { expect, test } from "@playwright/test";
import {
  BACK_TO_TOP_VIEWPORTS,
  SCREENSHOT_STYLE,
  backToTopOverlaps,
  completeEarlyAccessForm,
  expectNoUnexpectedApiCalls,
  guardNetwork,
  openForScreenshot,
  readHead,
} from "./support";

// The English experience must stay visually and functionally unchanged.
// Baselines were first captured from `main` before the Spanish work started and
// refreshed on purpose only for the closing change (logo removed, tagline left).
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

test("English hero input keeps its English copy", async ({ page }) => {
  await guardNetwork(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Analyze" }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Website URL" }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Website URL" }).first().fill("not a site");
  await page.getByRole("button", { name: "Analyze" }).first().click();
  await expect(page.getByText("Enter a valid website, such as example.com.")).toBeVisible();
});

test("English closing has no duplicate logo and Back to top clears the tagline", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop layout check");
  await guardNetwork(page);
  for (const viewport of BACK_TO_TOP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".section-footer a")).toHaveCount(0);
    expect(await backToTopOverlaps(page), `${viewport.width}x${viewport.height}`).toBe(false);
  }
});

test("English placeholder pages stay reachable but out of search results", async ({
  request,
  isMobile,
}) => {
  test.skip(isMobile, "HTTP checks run once");
  for (const pathname of ["/product", "/pricing", "/resources", "/sign-in"]) {
    const response = await request.get(pathname);
    expect(response.status(), pathname).toBe(200);
    expect(await response.text(), pathname).toContain('<meta name="robots" content="noindex, follow"/>');
  }
  // Pages with content keep their indexing.
  for (const pathname of ["/", "/changelog", "/privacy"]) {
    const html = await (await request.get(pathname)).text();
    expect(html, pathname).not.toMatch(/<meta name="robots" content="noindex/);
  }
});

test("English navigation points at sections on the home page", async ({ page, isMobile }) => {
  await guardNetwork(page);
  await page.goto("/");
  for (const id of ["how-it-works", "the-loop", "capabilities", "early-access"]) {
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
  }
  await expect(page.locator('a[href="/product"], a[href="/pricing"], a[href="/resources"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "#early-access");
  if (isMobile) {
    // The design hides the nav links on mobile; that behaviour is unchanged.
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    return;
  }
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [label, href] of [
    ["How it works", "#how-it-works"],
    ["The loop", "#the-loop"],
    ["Capabilities", "#capabilities"],
    ["Changelog", "/changelog"],
  ] as const) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  await nav.getByRole("link", { name: "The loop" }).click();
  await expect(page).toHaveURL(/#the-loop$/);
  await expect(page.locator("section#the-loop")).toBeInViewport();
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
