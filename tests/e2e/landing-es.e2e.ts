import { expect, test } from "@playwright/test";
import {
  SCREENSHOT_STYLE,
  completeEarlyAccessForm,
  expectNoUnexpectedApiCalls,
  guardNetwork,
  openForScreenshot,
  readHead,
} from "./support";

// Spanish experience (PR 1: foundation + homepage). It stays out of search
// results until the whole Spanish experience is approved.

test("Spanish home matches its approved layout", async ({ page }) => {
  const { unexpectedApiCalls } = await guardNetwork(page);
  await openForScreenshot(page, "/es");
  await expect(page).toHaveScreenshot("es-home.png", {
    fullPage: true,
    stylePath: SCREENSHOT_STYLE,
  });
  expectNoUnexpectedApiCalls(unexpectedApiCalls);
});

test("Spanish home declares Spanish and stays out of search results", async ({ page }) => {
  await guardNetwork(page);
  await page.goto("/es");
  const head = await readHead(page);
  expect(head.lang).toBe("es");
  expect(head.title).toBe("Foundfy | Que te encuentren, busquen donde busquen.");
  expect(head.description).toBe(
    "Foundfy revisa tu web, te dice qué mejorar primero y te ayuda a publicarlo y verificarlo. SEO claro para pequeñas empresas.",
  );
  expect(head.robots).toBe("noindex, follow");
  expect(head.canonical).toBe("https://www.foundfy.me/es");
  expect(head.ogLocale).toBe("es_ES");
  // hreflang is added only when the Spanish experience is published.
  expect(head.alternates).toEqual([]);
});

test("Spanish navigation points at sections on the page", async ({ page, isMobile }) => {
  test.skip(isMobile, "the design hides the nav links on mobile, as in English");
  await guardNetwork(page);
  await page.goto("/es");
  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const [label, id] of [
    ["Cómo funciona", "como-funciona"],
    ["El proceso", "el-proceso"],
    ["Capacidades", "capacidades"],
  ] as const) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", `#${id}`);
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
  }
  await expect(page.getByRole("link", { name: "Solicitar una revisión" })).toHaveAttribute(
    "href",
    "#early-access",
  );
  await expect(page.getByText("Sign in")).toHaveCount(0);
});

test("Spanish early access form submits the same payload with Spanish copy", async ({
  page,
}) => {
  const { earlyAccessRequests, unexpectedApiCalls } = await guardNetwork(page);
  await page.goto("/es");
  const section = await completeEarlyAccessForm(page, {
    role: "business-owner",
    interest: "seo",
    website: "example.com",
    email: "owner@example.com",
    continueLabel: "Continuar",
    submitLabel: "Solicitar revisión",
  });
  await expect(section.getByText("¡SOLICITUD RECIBIDA!")).toBeVisible();
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

test("Spanish form shows Spanish errors", async ({ page }) => {
  await guardNetwork(page);
  await page.goto("/es");
  const section = page.locator("#early-access");
  await section.scrollIntoViewIfNeeded();
  await section.locator("select#role").selectOption("agency");
  await section.locator("select#interest").selectOption("all");
  await section.locator("input#website").fill("no es una web");
  await section.getByRole("button", { name: "Continuar" }).click();
  await expect(
    section.getByText("Introduce una web válida o déjalo en blanco."),
  ).toBeVisible();
});

test("Spanish form replaces a server error with a Spanish message", async ({ page }) => {
  await page.route("**/api/early-access", (route) =>
    route.fulfill({ status: 400, json: { error: "Please choose a role." } }),
  );
  await page.route("**/_vercel/**", (route) => route.abort());
  await page.goto("/es");
  const section = await completeEarlyAccessForm(page, {
    role: "other",
    interest: "content",
    website: "example.com",
    email: "owner@example.com",
    continueLabel: "Continuar",
    submitLabel: "Solicitar revisión",
  });
  await expect(section.getByText("Revisa tus respuestas e inténtalo de nuevo.")).toBeVisible();
  await expect(section.getByText("Please choose a role.")).toHaveCount(0);
});

test.describe("Spanish routes", () => {
  test.skip(({ isMobile }) => isMobile, "route checks run once");

  test("Spanish privacy page is in Spanish and not indexed", async ({ page }) => {
    await page.route("**/_vercel/**", (route) => route.abort());
    const response = await page.goto("/es/privacidad");
    expect(response?.status()).toBe(200);
    const head = await readHead(page);
    expect(head.lang).toBe("es");
    expect(head.title).toBe("Privacidad | Foundfy");
    expect(head.robots).toBe("noindex, follow");
    await expect(page.getByRole("heading", { level: 1, name: "Privacidad" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Explicaciones con IA (OpenAI)" }),
    ).toBeVisible();
    await expect(page.getByText("Foundfy usa OpenAI de forma automática")).toBeVisible();
    await expect(page.getByText("a través de Resend, un servicio de envío de emails")).toBeVisible();
    await expect(page.getByText("Explicación ampliada")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "/es/privacidad",
    );
  });

  test("Spanish footer links to the Spanish privacy page", async ({ page }) => {
    await page.route("**/_vercel/**", (route) => route.abort());
    await page.goto("/es");
    await expect(page.locator("footer").getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "/es/privacidad",
    );
  });

  test("English pages do not link to the Spanish experience yet", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).not.toMatch(/href="\/es[/"]/);
    expect(html).not.toContain('hreflang="es"');
  });
});
