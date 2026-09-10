import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import {
  generateExplanationEnrichments,
  selectFindingsNeedingExplanationEnrichment,
  shouldAutoGenerateExplanationEnrichment,
} from "./generate";
import { buildExplanationInputHash } from "./build-input";

function buildBrokenLinkFinding(input: {
  id: string;
  rank: number;
  linkFromUrl: string;
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: "internal_structure.broken_internal_link",
    category: "internal_structure",
    severity: "warning",
    title: "Broken internal link to crawled page",
    description: "Description",
    pageUrl: input.linkFromUrl,
    evidence: {
      linkFromUrl: input.linkFromUrl,
      linkToUrl: "http://www.arngren.net/eltrack-2",
      targetStatusCode: 404,
      anchorText: "Elektriske Biler",
    },
    priority: {
      level: "high",
      rank: input.rank,
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: null,
    },
  };
}

const upsertMock = vi.fn();
const listMock = vi.fn();

vi.mock("../db/repository", () => ({
  upsertExplanationEnrichment: (...args: unknown[]) => upsertMock(...args),
  listExplanationEnrichments: (...args: unknown[]) => listMock(...args),
}));

function buildFinding(overrides: Partial<AnalysisFinding> = {}): AnalysisFinding {
  return {
    id: "finding-1",
    ruleKey: "page_fundamentals.missing_title",
    category: "page_fundamentals",
    severity: "warning",
    title: "Missing title",
    description: "This page is missing a title.",
    pageUrl: "https://example.com/page",
    evidence: {
      requestedUrl: "https://example.com/page",
      finalUrl: "https://example.com/page",
    },
    priority: {
      level: "high",
      rank: 1,
      whyItMatters: "Titles help search engines understand the page.",
      recommendedAction: "Add a descriptive title.",
      verification: null,
    },
    ...overrides,
  };
}

describe("shouldAutoGenerateExplanationEnrichment", () => {
  it("skips automatic generation when there are no highlighted findings", () => {
    expect(
      shouldAutoGenerateExplanationEnrichment({ highlightedFindingIds: [] }),
    ).toBe(false);
  });
});

describe("selectFindingsNeedingExplanationEnrichment", () => {
  it("regenerates when the input hash changes", () => {
    const finding = buildFinding();
    const selected = selectFindingsNeedingExplanationEnrichment({
      findings: [finding],
      findingIds: [finding.id],
      existing: [
        {
          findingId: finding.id,
          inputHash: "stale-hash",
          status: "ready",
        },
      ],
      hostname: "example.com",
      pagesCrawled: 3,
    });

    expect(selected).toHaveLength(1);
  });

  it("skips findings with a current ready enrichment", () => {
    const finding = buildFinding();
    const inputHash = buildExplanationInputHash({
      hostname: "example.com",
      pagesCrawled: 3,
      finding,
    });

    const selected = selectFindingsNeedingExplanationEnrichment({
      findings: [finding],
      findingIds: [finding.id],
      existing: [
        {
          findingId: finding.id,
          inputHash,
          status: "ready",
        },
      ],
      hostname: "example.com",
      pagesCrawled: 3,
    });

    expect(selected).toHaveLength(0);
  });
});

describe("generateExplanationEnrichments", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    listMock.mockReset();
    listMock.mockResolvedValue([]);
  });

  it("marks enrichments failed when the provider fails", async () => {
    const finding = buildFinding();

    await generateExplanationEnrichments({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 3,
      findings: [finding],
      findingIds: [finding.id],
      provider: {
        model: "test-model",
        generateExplanations: vi.fn().mockRejectedValue(new Error("provider down")),
      },
    });

    expect(upsertMock).toHaveBeenCalled();
    expect(
      upsertMock.mock.calls.some((call) => call[0]?.status === "failed"),
    ).toBe(true);
  });

  it("persists validated explanations idempotently", async () => {
    const finding = buildFinding();

    await generateExplanationEnrichments({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 3,
      findings: [finding],
      findingIds: [finding.id],
      provider: {
        model: "test-model",
        generateExplanations: vi.fn().mockResolvedValue([
          {
            findingId: finding.id,
            contextualExplanation: "A missing title makes the page harder to understand.",
            evidenceExplanation:
              "The crawl found no title on https://example.com/page.",
            citedEvidenceKeys: ["requestedUrl", "finalUrl"],
          },
        ]),
      },
    });

    expect(
      upsertMock.mock.calls.some((call) => call[0]?.status === "ready"),
    ).toBe(true);
  });

  it("sends one grouped enrichment target for duplicate broken-link highlights", async () => {
    const findings = [
      buildBrokenLinkFinding({
        id: "broken-1",
        rank: 1,
        linkFromUrl: "https://arngren.net/",
      }),
      buildBrokenLinkFinding({
        id: "broken-2",
        rank: 2,
        linkFromUrl: "https://arngren.net/page-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-3",
        rank: 3,
        linkFromUrl: "https://arngren.net/page-3",
      }),
    ];
    const generateExplanations = vi.fn().mockResolvedValue([
      {
        findingId: "broken-1",
        contextualExplanation: "Three pages link to the same missing target.",
        evidenceExplanation:
          "The crawl found 3 source pages linking to http://www.arngren.net/eltrack-2, which returned HTTP 404.",
        citedEvidenceKeys: [
          "linkToUrl",
          "targetStatusCode",
          "affectedPageCount",
          "affectedSourceUrls",
        ],
      },
    ]);

    await generateExplanationEnrichments({
      crawlRunId: "run-1",
      hostname: "arngren.net",
      pagesCrawled: 10,
      findings,
      findingIds: ["broken-1"],
      highlightGroups: [
        {
          representativeFindingId: "broken-1",
          memberFindingIds: ["broken-1", "broken-2", "broken-3"],
          rawFindingCount: 3,
          affectedPageCount: 3,
        },
      ],
      provider: {
        model: "test-model",
        generateExplanations,
      },
    });

    expect(generateExplanations).toHaveBeenCalledTimes(1);
    expect(generateExplanations.mock.calls[0]?.[0]?.findings).toHaveLength(1);
    expect(
      generateExplanations.mock.calls[0]?.[0]?.findings[0]?.whitelistedEvidence,
    ).toMatchObject({
      affectedPageCount: 3,
      linkToUrl: "http://www.arngren.net/eltrack-2",
    });
  });

  it("marks validation failures as failed without changing findings", async () => {
    const finding = buildFinding();

    await generateExplanationEnrichments({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 3,
      findings: [finding],
      findingIds: [finding.id],
      provider: {
        model: "test-model",
        generateExplanations: vi.fn().mockResolvedValue([
          {
            findingId: finding.id,
            contextualExplanation: "Could increase traffic by 50%.",
            evidenceExplanation: "Evidence",
            citedEvidenceKeys: ["requestedUrl"],
          },
        ]),
      },
    });

    expect(
      upsertMock.mock.calls.some((call) => call[0]?.status === "failed"),
    ).toBe(true);
  });
});
