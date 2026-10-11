import { describe, expect, it } from "vitest";
import { ResearchProviderError } from "../errors";
import { FixtureResearchProvider } from "./fixture";

describe("FixtureResearchProvider", () => {
  it("returns deterministic test ideas including null volume and seed duplicates", async () => {
    const provider = new FixtureResearchProvider();
    const result = await provider.relatedKeywordIdeas({
      offering: "silk paint",
      locationCode: 2724,
      languageCode: "en",
      limit: 20,
    });
    expect(result.taskId).toBe("fixture-task-en");
    expect(result.ideas.some((idea) => idea.searchVolume == null)).toBe(true);
    expect(result.ideas.some((idea) => idea.keyword === "silk paint")).toBe(true);
  });

  it("can emulate empty, timeout, and rate-limit behaviors", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("silk paint", "ca", "empty");
    provider.setBehavior("silk paint", "es", "timeout");
    provider.setBehavior("silk paint", "en", "rate_limit");
    await expect(
      provider.relatedKeywordIdeas({
        offering: "silk paint",
        locationCode: 2724,
        languageCode: "ca",
        limit: 20,
      }),
    ).resolves.toMatchObject({ ideas: [], taskId: "fixture-task-empty" });
    await expect(
      provider.relatedKeywordIdeas({
        offering: "silk paint",
        locationCode: 2724,
        languageCode: "es",
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ResearchProviderError);
    await expect(
      provider.relatedKeywordIdeas({
        offering: "silk paint",
        locationCode: 2724,
        languageCode: "en",
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
