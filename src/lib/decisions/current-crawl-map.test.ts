import { describe, expect, it } from "vitest";
import type { FoundfyPageRef } from "@/lib/gsc/page-map";
import { classifyPagePath } from "@/lib/crawler/select/page-priority";
import { buildRankedDecisions } from "./candidates";
import { mapGscEvidenceToCurrentCrawl } from "./current-crawl-map";
import { hasMeaningfulVisibility } from "./score";
import type {
  DecisionEngineInput,
  GscPageEvidenceInput,
  ObservationInput,
} from "./types";

const crawlBPages: FoundfyPageRef[] = [
  {
    id: "page-b-home",
    requestedUrl: "https://www.foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    canonical: "https://www.foundfy.me/",
  },
  {
    id: "page-b-about",
    requestedUrl: "https://www.foundfy.me/about",
    finalUrl: "https://www.foundfy.me/about",
    canonical: "https://www.foundfy.me/about",
  },
];

describe("mapGscEvidenceToCurrentCrawl", () => {
  it("maps by raw Google URL and ignores the stored GSC page_id", () => {
    const mapped = mapGscEvidenceToCurrentCrawl(
      [
        {
          id: "gsc-1",
          pageUrl: "https://www.foundfy.me/about",
          storedPageId: "page-from-crawl-a",
          clicks: 4,
          impressions: 40,
        },
      ],
      crawlBPages,
    );

    expect(mapped[0]?.pageId).toBe("page-b-about");
    expect(mapped[0]?.storedPageId).toBe("page-from-crawl-a");
  });

  it("returns null for a URL that was mapped in an older crawl but is absent now", () => {
    const mapped = mapGscEvidenceToCurrentCrawl(
      [
        {
          id: "gsc-old",
          pageUrl: "https://www.foundfy.me/pricing",
          storedPageId: "page-from-crawl-a",
          clicks: 8,
          impressions: 80,
        },
      ],
      crawlBPages,
    );

    expect(mapped[0]?.pageId).toBeNull();
    expect(mapped[0]?.storedPageId).toBe("page-from-crawl-a");
  });

  it("keeps never-crawled URLs unmapped", () => {
    const mapped = mapGscEvidenceToCurrentCrawl(
      [
        {
          id: "gsc-login",
          pageUrl: "https://www.foundfy.me/login",
          storedPageId: null,
          clicks: 10,
          impressions: 80,
        },
      ],
      crawlBPages,
    );

    expect(mapped[0]?.pageId).toBeNull();
    expect(mapped[0]?.storedPageId).toBeNull();
  });

  it("reuses Phase 3 www/apex, protocol, and trailing-slash equivalence", () => {
    const mapped = mapGscEvidenceToCurrentCrawl(
      [
        {
          id: "gsc-home",
          pageUrl: "http://foundfy.me/",
          storedPageId: "page-from-crawl-a",
          clicks: 2,
          impressions: 20,
        },
        {
          id: "gsc-about",
          pageUrl: "https://foundfy.me/about/",
          storedPageId: null,
          clicks: 1,
          impressions: 10,
        },
      ],
      crawlBPages,
    );

    expect(mapped.map((row) => row.pageId)).toEqual(["page-b-home", "page-b-about"]);
  });
});

const engine: DecisionEngineInput = {
  websiteId: "website-1",
  siteModelId: "site-model-1",
  crawlRunId: "5245f7d6-beab-419a-9c99-8100c63920ac",
  gscSearchSyncId: "eff8b51b-2c54-43af-977b-1cfafbabf7d5",
  engineVersion: "decision_v1",
  goal: {
    id: "goal-1",
    primaryType: "grow_signups",
    secondaryType: null,
    note: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  gscTruncated: true,
  periodStart: "2026-08-27",
  periodEnd: "2026-09-23",
};

const dbhobbyCrawlB: FoundfyPageRef[] = [
  {
    id: "7e4927b1-97e4-41cf-81eb-4a966cd38d44",
    requestedUrl: "https://dbhobby.com/",
    finalUrl: "https://dbhobby.com/",
    canonical: "https://dbhobby.com/ca/pintura-en-seda",
  },
  {
    id: "b8168051-70fe-4fe8-8886-8224aff18faa",
    requestedUrl: "https://dbhobby.com/ca",
    finalUrl: "https://dbhobby.com/ca",
    canonical: "https://dbhobby.com/ca/pintura-en-seda",
  },
  {
    id: "bc3a2122-7b9d-4a7d-81a1-a173df4eb7e8",
    requestedUrl: "https://www.dbhobby.com/en",
    finalUrl: "https://www.dbhobby.com/en",
    canonical: "https://www.dbhobby.com/ca/pintura-en-seda",
  },
  {
    id: "a5a8eb2d-288d-41c6-af2f-38e422922b64",
    requestedUrl: "https://www.dbhobby.com/es",
    finalUrl: "https://www.dbhobby.com/es",
    canonical: "https://www.dbhobby.com/es/pintura-en-seda",
  },
  {
    id: "e622874d-8439-4631-8a35-d366c5505e29",
    requestedUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    finalUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    canonical: "https://www.dbhobby.com/es/pintura-en-seda",
  },
  {
    id: "3f5a5a57-078d-4f96-ab85-e0726fcbc628",
    requestedUrl:
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
    finalUrl:
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
    canonical: null,
  },
  {
    id: "5bab4674-5157-4def-ab32-1b1623d7ca8d",
    requestedUrl: "https://www.dbhobby.com/ca/pintura-en-seda",
    finalUrl: "https://www.dbhobby.com/ca/pintura-en-seda",
    canonical: "https://www.dbhobby.com/ca/pintura-en-seda",
  },
  {
    id: "0d2b5048-c049-4650-a160-5c19da208214",
    requestedUrl: "https://dbhobby.com/es/gutta-para-seda",
    finalUrl: "https://dbhobby.com/es/gutta-para-seda",
    canonical: null,
  },
  {
    id: "3eea36d6-2629-4d40-b7e8-889082054dcb",
    requestedUrl: "https://dbhobby.com/en/node/64",
    finalUrl: "https://dbhobby.com/en/node/64",
    canonical: "https://dbhobby.com/ca/pintura-en-seda",
  },
  {
    id: "a2b61a6a-9612-489c-a6a3-77ee1edb5e7f",
    requestedUrl: "https://dbhobby.com/ca/darwi-pintura-textil",
    finalUrl: "https://dbhobby.com/ca/darwi-pintura-textil",
    canonical: null,
  },
];

const crawlBIds = new Set(dbhobbyCrawlB.map((page) => page.id));

const dbhobbyGscRows = [
  {
    id: "gsc-pintura-www",
    pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    storedPageId: "cc8cc7ad-2fda-4b83-a0a0-304f75c50f0d",
    impressions: 153,
    clicks: 26,
  },
  {
    id: "gsc-cianotipo",
    pageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    storedPageId: "7e812831-5c87-42fd-9869-6dac9ea8d7ee",
    impressions: 133,
    clicks: 1,
  },
  {
    id: "gsc-gutta",
    pageUrl: "https://dbhobby.com/es/gutta-para-seda",
    storedPageId: "166f5bf6-603d-4143-83ff-5cf31e8a1d19",
    impressions: 96,
    clicks: 3,
  },
  {
    id: "gsc-login-es",
    pageUrl: "https://dbhobby.com/es/login",
    storedPageId: null,
    impressions: 83,
    clicks: 10,
  },
  {
    id: "gsc-pintura-apex",
    pageUrl: "https://dbhobby.com/es/pintura-en-seda",
    storedPageId: "cc8cc7ad-2fda-4b83-a0a0-304f75c50f0d",
    impressions: 80,
    clicks: 7,
  },
  {
    id: "gsc-home",
    pageUrl: "https://dbhobby.com/",
    storedPageId: "ac1b0be7-bacd-4708-b4fe-33e71d180f5c",
    impressions: 69,
    clicks: 16,
  },
  {
    id: "gsc-fijacion",
    pageUrl: "https://dbhobby.com/es/pintura-seda/fijacion-del-color-con-vapor",
    storedPageId: "51272ee9-7a40-496b-a71f-7017d089f203",
    impressions: 53,
    clicks: 3,
  },
  {
    id: "gsc-ponge",
    pageUrl:
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
    storedPageId: null,
    impressions: 49,
    clicks: 1,
  },
  {
    id: "gsc-home-http",
    pageUrl: "http://www.dbhobby.com/",
    storedPageId: "ac1b0be7-bacd-4708-b4fe-33e71d180f5c",
    impressions: 48,
    clicks: 3,
  },
  {
    id: "gsc-pintura-ca",
    pageUrl: "https://www.dbhobby.com/ca/pintura-en-seda",
    storedPageId: "44386836-5ddb-432e-b5c6-7a8bcb1f91ad",
    impressions: 45,
    clicks: 5,
  },
  {
    id: "gsc-vellut",
    pageUrl: "https://www.dbhobby.com/ca/seda/vellut-140",
    storedPageId: null,
    impressions: 44,
    clicks: 1,
  },
  {
    id: "gsc-bastidor",
    pageUrl: "https://www.dbhobby.com/es/pintura-seda/bastidor-encajes-extensible-100",
    storedPageId: null,
    impressions: 33,
    clicks: 2,
  },
  {
    id: "gsc-login-ca",
    pageUrl: "https://www.dbhobby.com/ca/login",
    storedPageId: null,
    impressions: 28,
    clicks: 2,
  },
];

function observation(
  overrides: Partial<ObservationInput> & Pick<ObservationInput, "id" | "pageId" | "pageUrl" | "ruleKey" | "title">,
): ObservationInput {
  return {
    description: overrides.title,
    severity: "warning",
    status: "active",
    evidence: {},
    priorityLevel: "medium",
    priorityScore: 55,
    ...overrides,
  };
}

const dbhobbyObservations: ObservationInput[] = [
  observation({
    id: "obs-home-canonical",
    pageId: "7e4927b1-97e4-41cf-81eb-4a966cd38d44",
    pageUrl: "https://dbhobby.com/",
    ruleKey: "indexability.canonical_points_elsewhere",
    title: "Canonical points elsewhere",
  }),
  observation({
    id: "obs-home-title",
    pageId: "7e4927b1-97e4-41cf-81eb-4a966cd38d44",
    pageUrl: "https://dbhobby.com/",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "pintura sobre seda | dbhobby" },
  }),
  observation({
    id: "obs-en-canonical",
    pageId: "bc3a2122-7b9d-4a7d-81a1-a173df4eb7e8",
    pageUrl: "https://www.dbhobby.com/en",
    ruleKey: "indexability.canonical_points_elsewhere",
    title: "Canonical points elsewhere",
  }),
  observation({
    id: "obs-en-title",
    pageId: "bc3a2122-7b9d-4a7d-81a1-a173df4eb7e8",
    pageUrl: "https://www.dbhobby.com/en",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "pintura sobre seda | dbhobby" },
  }),
  observation({
    id: "obs-es-canonical",
    pageId: "a5a8eb2d-288d-41c6-af2f-38e422922b64",
    pageUrl: "https://www.dbhobby.com/es",
    ruleKey: "indexability.canonical_points_elsewhere",
    title: "Canonical points elsewhere",
  }),
  observation({
    id: "obs-es-meta",
    pageId: "a5a8eb2d-288d-41c6-af2f-38e422922b64",
    pageUrl: "https://www.dbhobby.com/es",
    ruleKey: "page_fundamentals.missing_meta_description",
    title: "Missing meta description",
  }),
  observation({
    id: "obs-ponge-canonical",
    pageId: "3f5a5a57-078d-4f96-ab85-e0726fcbc628",
    pageUrl:
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
    ruleKey: "indexability.canonical_missing",
    title: "Canonical URL missing",
  }),
  observation({
    id: "obs-ponge-title",
    pageId: "3f5a5a57-078d-4f96-ab85-e0726fcbc628",
    pageUrl:
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "dbhobby | pintura sobre seda" },
  }),
  observation({
    id: "obs-gutta-canonical",
    pageId: "0d2b5048-c049-4650-a160-5c19da208214",
    pageUrl: "https://dbhobby.com/es/gutta-para-seda",
    ruleKey: "indexability.canonical_missing",
    title: "Canonical URL missing",
  }),
  observation({
    id: "obs-gutta-title",
    pageId: "0d2b5048-c049-4650-a160-5c19da208214",
    pageUrl: "https://dbhobby.com/es/gutta-para-seda",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "dbhobby | pintura sobre seda" },
  }),
  observation({
    id: "obs-ca-title",
    pageId: "b8168051-70fe-4fe8-8886-8224aff18faa",
    pageUrl: "https://dbhobby.com/ca",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "pintura sobre seda | dbhobby" },
  }),
  observation({
    id: "obs-pintura-ca-title",
    pageId: "5bab4674-5157-4def-ab32-1b1623d7ca8d",
    pageUrl: "https://www.dbhobby.com/ca/pintura-en-seda",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "pintura sobre seda | dbhobby" },
  }),
  observation({
    id: "obs-node-title",
    pageId: "3eea36d6-2629-4d40-b7e8-889082054dcb",
    pageUrl: "https://dbhobby.com/en/node/64",
    ruleKey: "page_fundamentals.duplicate_title",
    title: "Duplicate page title",
    evidence: { title: "pintura sobre seda | dbhobby" },
  }),
];

function storedPages(rows: typeof dbhobbyGscRows): GscPageEvidenceInput[] {
  return rows.map((row) => ({
    id: row.id,
    pageUrl: row.pageUrl,
    pageId: row.storedPageId,
    storedPageId: row.storedPageId,
    clicks: row.clicks,
    impressions: row.impressions,
  }));
}

describe("DBHobby current-crawl remapping simulation", () => {
  const beforePages = storedPages(dbhobbyGscRows);
  const afterPages = mapGscEvidenceToCurrentCrawl(dbhobbyGscRows, dbhobbyCrawlB);
  const before = buildRankedDecisions({
    engine,
    pages: beforePages,
    observations: dbhobbyObservations,
  });
  const after = buildRankedDecisions({
    engine,
    pages: afterPages,
    observations: dbhobbyObservations,
  });

  it("maps GSC URLs onto current crawl pages without using stored ids", () => {
    const storedMappedToCurrent = beforePages.filter((page) => page.pageId && crawlBIds.has(page.pageId)).length;
    const remapped = afterPages.filter((page) => page.pageId != null).length;

    expect(storedMappedToCurrent).toBe(0);
    expect(remapped).toBe(7);
    expect(afterPages.find((page) => page.id === "gsc-ponge")?.pageId).toBe(
      "3f5a5a57-078d-4f96-ab85-e0726fcbc628",
    );
    expect(afterPages.find((page) => page.id === "gsc-cianotipo")?.pageId).toBeNull();
    expect(afterPages.map((page) => page.storedPageId)).toEqual(dbhobbyGscRows.map((row) => row.storedPageId));
  });

  it("restores Type A/C and stops treating the crawled seda-ponge URL as Type B", () => {
    expect(before.filter((decision) => decision.decisionType === "existing_demand_page_issue")).toHaveLength(0);
    expect(before.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility")).toHaveLength(0);
    expect(before.every((decision) => decision.decisionType === "inspect_unanalyzed_page")).toBe(true);

    expect(after.some((decision) => decision.decisionType === "existing_demand_page_issue")).toBe(true);
    expect(after.some((decision) => decision.decisionType === "multi_page_issue_with_visibility")).toBe(true);
    expect(
      after.some(
        (decision) =>
          decision.decisionType === "inspect_unanalyzed_page" &&
          decision.pageUrl?.includes("seda-ponge-panuelos-fulares-chales-a-metros-complementos"),
      ),
    ).toBe(false);

    const maxDemand = Math.max(...afterPages.map((page) => page.impressions));
    const typeBUrls = (pages: GscPageEvidenceInput[]) =>
      pages
        .filter(
          (page) =>
            page.pageId == null &&
            hasMeaningfulVisibility(page, maxDemand) &&
            classifyPagePath(page.pageUrl) !== "utility",
        )
        .map((page) => page.pageUrl);

    expect(typeBUrls(beforePages)).toEqual([
      "https://www.dbhobby.com/es/seda-ponge-panuelos-fulares-chales-a-metros-complementos",
      "https://www.dbhobby.com/ca/seda/vellut-140",
      "https://www.dbhobby.com/es/pintura-seda/bastidor-encajes-extensible-100",
    ]);
    expect(typeBUrls(afterPages)).toEqual([
      "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
      "https://dbhobby.com/es/pintura-seda/fijacion-del-color-con-vapor",
      "https://www.dbhobby.com/ca/seda/vellut-140",
      "https://www.dbhobby.com/es/pintura-seda/bastidor-encajes-extensible-100",
    ]);
  });

  it("does not emit Type B for unmapped login URLs after the utility guardrail", () => {
    const typeB = after.filter((decision) => decision.decisionType === "inspect_unanalyzed_page");
    expect(typeB.every((decision) => !decision.pageUrl?.includes("/login"))).toBe(true);
    expect(after.filter((decision) => decision.pageUrl?.includes("/login"))).toEqual([]);
    expect(after[0]?.decisionType).not.toBe("inspect_unanalyzed_page");
  });

  it("keeps scoring weights, max 5, and deterministic order", () => {
    const again = buildRankedDecisions({
      engine,
      pages: afterPages,
      observations: dbhobbyObservations,
    });

    expect(after).toHaveLength(5);
    expect(again).toEqual(after);
    expect(after.map((decision) => decision.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(JSON.stringify(after)).not.toMatch(/CTR is too low|position is bad|openai/i);
    expect(
      after.map((decision) => ({
        rank: decision.rank,
        type: decision.decisionType,
        url: decision.pageUrl,
        pageId: decision.pageId,
        total: decision.scoring.total,
      })),
    ).toEqual([
      {
        rank: 1,
        type: "existing_demand_page_issue",
        url: "https://www.dbhobby.com/es/pintura-en-seda",
        pageId: "a5a8eb2d-288d-41c6-af2f-38e422922b64",
        total: 75,
      },
      {
        rank: 2,
        type: "multi_page_issue_with_visibility",
        url: "https://dbhobby.com/es/gutta-para-seda",
        pageId: "0d2b5048-c049-4650-a160-5c19da208214",
        total: 62,
      },
      {
        rank: 3,
        type: "existing_demand_page_issue",
        url: "https://dbhobby.com/es/gutta-para-seda",
        pageId: "0d2b5048-c049-4650-a160-5c19da208214",
        total: 62,
      },
      {
        rank: 4,
        type: "multi_page_issue_with_visibility",
        url: "https://dbhobby.com/",
        pageId: "7e4927b1-97e4-41cf-81eb-4a966cd38d44",
        total: 56,
      },
      {
        rank: 5,
        type: "existing_demand_page_issue",
        url: "https://dbhobby.com/",
        pageId: "7e4927b1-97e4-41cf-81eb-4a966cd38d44",
        total: 56,
      },
    ]);
  });
});
