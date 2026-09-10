import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiExplanationProvider } from "./openai";
import { OPENAI_RESPONSES_URL } from "./openai-responses";

describe("createOpenAiExplanationProvider", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_ENRICHMENT_MODEL;
    vi.unstubAllGlobals();
  });

  it("calls the OpenAI Responses API with the configured model", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_ENRICHMENT_MODEL = "gpt-5.6-luna";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          explanations: [
            {
              findingId: "finding-1",
              contextualExplanation: "Context",
              evidenceExplanation: "Evidence",
              citedEvidenceKeys: ["requestedUrl"],
            },
          ],
        }),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiExplanationProvider();
    const result = await provider.generateExplanations({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 1,
      promptVersion: "explanation-v1",
      findings: [
        {
          findingId: "finding-1",
          ruleKey: "page_fundamentals.missing_title",
          title: "Missing title",
          description: "Desc",
          pageUrl: "https://example.com/",
          whitelistedEvidence: {
            requestedUrl: "https://example.com/",
            finalUrl: "https://example.com/",
          },
          whyItMatters: "Titles matter.",
        },
      ],
    });

    expect(provider.model).toBe("gpt-5.6-luna");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(OPENAI_RESPONSES_URL);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));

    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.text.format.type).toBe("json_schema");
    expect(result).toHaveLength(1);
  });

  it("defaults to gpt-5.6-luna when OPENAI_ENRICHMENT_MODEL is unset", () => {
    process.env.OPENAI_API_KEY = "test-key";

    const provider = createOpenAiExplanationProvider();
    expect(provider.model).toBe("gpt-5.6-luna");
  });
});
