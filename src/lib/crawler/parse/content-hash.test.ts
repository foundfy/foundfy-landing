import { describe, expect, it } from "vitest";
import { hashNormalizedContent } from "./content-hash";
import { extractMainContentText } from "./excerpt";

describe("content hash", () => {
  it("is stable for the same normalized main content", () => {
    const html = `<main><p>Silk  workshop</p></main><footer>Ignore</footer>`;
    const spaced = `<main><p>Silk   workshop</p></main><nav>Cart</nav>`;

    const first = hashNormalizedContent(extractMainContentText(html));
    const second = hashNormalizedContent(extractMainContentText(spaced));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });

  it("changes when the cleaned main content changes", () => {
    const left = hashNormalizedContent(extractMainContentText("<main>Silk workshop</main>"));
    const right = hashNormalizedContent(extractMainContentText("<main>Wool workshop</main>"));

    expect(left).not.toBe(right);
  });
});
