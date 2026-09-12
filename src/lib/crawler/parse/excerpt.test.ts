import { describe, expect, it } from "vitest";
import {
  MAIN_EXCERPT_MAX_CHARS,
  boundExcerpt,
  extractMainContentText,
  extractMainExcerpt,
} from "./excerpt";

describe("main-content excerpt", () => {
  it("prefers main over chrome and normalizes whitespace", () => {
    const html = `<!doctype html>
      <html>
        <body>
          <nav>Main navigation Home Login</nav>
          <main>
            <h1>Silk workshop</h1>
            <p>Hands-on  dyeing   classes.</p>
          </main>
          <footer>Contact us at shop@example.com +1 555 0100</footer>
        </body>
      </html>`;

    expect(extractMainExcerpt(html)).toBe("Silk workshop Hands-on dyeing classes.");
  });

  it("caps the persisted excerpt at the explicit constant", () => {
    const paragraph = "Meaningful sentence about the service. ";
    const html = `<main>${paragraph.repeat(80)}</main>`;
    const excerpt = extractMainExcerpt(html);

    expect(MAIN_EXCERPT_MAX_CHARS).toBe(1000);
    expect(excerpt.length).toBe(MAIN_EXCERPT_MAX_CHARS);
    expect(boundExcerpt("a".repeat(1001)).length).toBe(1000);
    expect(extractMainContentText(html).length).toBeGreaterThan(MAIN_EXCERPT_MAX_CHARS);
  });

  it("excludes scripts, styles, nav, footer, and cookie banners", () => {
    const html = `<!doctype html>
      <html>
        <body>
          <style>.hidden { color: red; }</style>
          <script>window.__STATE = { email: "hidden@example.com", phone: "555-0199" }</script>
          <nav>Account Cart Checkout</nav>
          <div id="cookie-banner">We use cookies. Accept</div>
          <article>
            <p>Public workshop description stays.</p>
          </article>
          <footer>
            <p>Email footer@example.com or call 555-0100</p>
          </footer>
        </body>
      </html>`;

    const excerpt = extractMainExcerpt(html);

    expect(excerpt).toBe("Public workshop description stays.");
    expect(excerpt).not.toContain("window.__STATE");
    expect(excerpt).not.toContain("hidden@example.com");
    expect(excerpt).not.toContain("Account Cart");
    expect(excerpt).not.toContain("footer@example.com");
    expect(excerpt).not.toContain("We use cookies");
  });
});
