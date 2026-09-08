import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "exports");
const outputPath = path.join(outputDir, "foundfy-landing-page.pdf");
const url = process.env.PDF_URL ?? "http://localhost:3000/";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);

await mkdir(outputDir, { recursive: true });
await page.pdf({
  path: outputPath,
  printBackground: true,
  width: "1440px",
  height: `${pageHeight}px`,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  preferCSSPageSize: false,
});

await browser.close();

console.log(`PDF exported to ${outputPath}`);
