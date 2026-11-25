// Generates the browser icons from the vector sources in this folder:
//   scripts/favicon.svg     master artwork (32, 48 and 180 px)
//   scripts/favicon-16.svg  pixel-aligned 16 px version
// Outputs (Next.js file-based metadata): src/app/favicon.ico (16, 32, 48) and
// src/app/apple-icon.png (180, square background, because iOS applies its own
// rounded mask). There is deliberately no separate icon.png: when one is
// declared, Chrome downloads it instead of favicon.ico and never uses the
// pixel-aligned 16 px frame.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "src", "app");
const master = await readFile(path.join(__dirname, "favicon.svg"), "utf8");
const small = await readFile(path.join(__dirname, "favicon-16.svg"), "utf8");
const squareMaster = master.replace('rx="112"', 'rx="0"');

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome" });

async function rasterize(svg, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${src}">`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

// ICO container with PNG-compressed frames (supported by every current browser).
function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

const frames = [
  { size: 16, png: await rasterize(small, 16) },
  { size: 32, png: await rasterize(master, 32) },
  { size: 48, png: await rasterize(master, 48) },
];
await writeFile(path.join(appDir, "favicon.ico"), ico(frames));
await writeFile(path.join(appDir, "apple-icon.png"), await rasterize(squareMaster, 180));

await browser.close();
console.log(`Favicons exported to ${appDir}`);
