import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPENAI_ENRICHMENT_MODEL,
  getOpenAiEnrichmentModel,
  isAiEnrichmentEnabled,
} from "./config";

describe("isAiEnrichmentEnabled", () => {
  afterEach(() => {
    delete process.env.AI_ENRICHMENT_ENABLED;
  });

  it("is disabled unless explicitly enabled", () => {
    process.env.AI_ENRICHMENT_ENABLED = "false";
    expect(isAiEnrichmentEnabled()).toBe(false);

    delete process.env.AI_ENRICHMENT_ENABLED;
    expect(isAiEnrichmentEnabled()).toBe(false);
  });

  it("is enabled when AI_ENRICHMENT_ENABLED=true", () => {
    process.env.AI_ENRICHMENT_ENABLED = "true";
    expect(isAiEnrichmentEnabled()).toBe(true);
  });
});

describe("getOpenAiEnrichmentModel", () => {
  afterEach(() => {
    delete process.env.OPENAI_ENRICHMENT_MODEL;
  });

  it("defaults to gpt-5.6-luna", () => {
    expect(DEFAULT_OPENAI_ENRICHMENT_MODEL).toBe("gpt-5.6-luna");
    expect(getOpenAiEnrichmentModel()).toBe("gpt-5.6-luna");
  });

  it("uses OPENAI_ENRICHMENT_MODEL when set", () => {
    process.env.OPENAI_ENRICHMENT_MODEL = "custom-model";
    expect(getOpenAiEnrichmentModel()).toBe("custom-model");
  });
});
