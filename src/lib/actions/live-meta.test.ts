import { describe, expect, it, vi } from "vitest";
import { observeHomepageDeployment, readEffectiveMetaDescription } from "./live-meta";

describe("live homepage meta", () => {
  it("prefers name=description and falls back to og:description", () => {
    expect(
      readEffectiveMetaDescription(
        `<meta name="description" content="Named copy"><meta property="og:description" content="OG copy">`,
      ),
    ).toBe("Named copy");
    expect(readEffectiveMetaDescription(`<meta property="og:description" content="OG copy">`)).toBe("OG copy");
    expect(readEffectiveMetaDescription("<html></html>")).toBeNull();
  });

  it("records an unobserved deployment without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html></html>",
    });

    await expect(
      observeHomepageDeployment({
        expected: "New homepage description.",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        attempts: 2,
        intervalMs: 0,
        sleep: async () => undefined,
      }),
    ).resolves.toEqual({ observed: false, observedAt: null });
  });
});
