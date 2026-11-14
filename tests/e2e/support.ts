import { expect, type Page } from "@playwright/test";
import path from "node:path";

export const SCREENSHOT_STYLE = path.join(__dirname, "screenshot.css");

export type EarlyAccessRequest = {
  role: string;
  interest: string;
  website: string;
  email: string;
};

// Mocks the early-access endpoint and rejects every other API call, so a test
// fails loudly instead of touching a real service.
export async function guardNetwork(page: Page) {
  const earlyAccessRequests: EarlyAccessRequest[] = [];
  const unexpectedApiCalls: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/early-access" && request.method() === "POST") {
      earlyAccessRequests.push(request.postDataJSON() as EarlyAccessRequest);
      await route.fulfill({ status: 201, json: { success: true } });
      return;
    }
    unexpectedApiCalls.push(`${request.method()} ${url.pathname}`);
    await route.abort();
  });
  await page.route("**/_vercel/**", (route) => route.abort());

  return { earlyAccessRequests, unexpectedApiCalls };
}

export async function openForScreenshot(page: Page, pathname: string) {
  await page.goto(pathname, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

export async function readHead(page: Page) {
  return page.evaluate(() => {
    const meta = (selector: string) =>
      document.querySelector(selector)?.getAttribute("content") ?? null;
    return {
      lang: document.documentElement.lang,
      title: document.title,
      description: meta('meta[name="description"]'),
      robots: meta('meta[name="robots"]'),
      canonical:
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      ogLocale: meta('meta[property="og:locale"]'),
      alternates: Array.from(
        document.querySelectorAll('link[rel="alternate"][hreflang]'),
      ).map((link) => link.getAttribute("hreflang")),
    };
  });
}

export async function completeEarlyAccessForm(
  page: Page,
  input: {
    role: string;
    interest: string;
    website: string;
    email: string;
    continueLabel: string;
    submitLabel: string;
  },
) {
  const section = page.locator("#early-access");
  await section.scrollIntoViewIfNeeded();
  await section.locator("select#role").selectOption(input.role);
  await section.locator("select#interest").selectOption(input.interest);
  await section.locator("input#website").fill(input.website);
  await section.getByRole("button", { name: input.continueLabel }).click();
  await section.locator("input#email").fill(input.email);
  await section.getByRole("button", { name: input.submitLabel }).click();
  return section;
}

export function expectNoUnexpectedApiCalls(calls: string[]) {
  expect(calls, "unexpected API calls during the test").toEqual([]);
}
