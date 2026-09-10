import { describe, expect, it } from "vitest";
import { hashExplanationInput } from "./input-hash";

describe("hashExplanationInput", () => {
  it("changes when prompt version changes", () => {
    const finding = {
      findingId: "finding-1",
      ruleKey: "indexability.noindex" as const,
      title: "Noindex",
      description: "Desc",
      pageUrl: null,
      whitelistedEvidence: {},
      whyItMatters: "Why",
    };

    const first = hashExplanationInput({
      promptVersion: "v1",
      hostname: "example.com",
      pagesCrawled: 1,
      finding,
    });
    const second = hashExplanationInput({
      promptVersion: "v2",
      hostname: "example.com",
      pagesCrawled: 1,
      finding,
    });

    expect(first).not.toBe(second);
  });
});
