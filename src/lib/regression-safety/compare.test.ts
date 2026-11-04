import { describe, expect, it } from "vitest";
import { evaluateManualSeoRegression } from "./compare";
import { formatRegressionSafetyReport } from "./display";
import { emptyPageFields, pageEvidenceFromParsedPage } from "./observe";
import type {
  CrawlMetadataSnapshot,
  ManualSeoImprovementSpec,
  PageMetadataEvidence,
} from "./types";
import type { ParsedPage } from "@/lib/crawler/types";

const WEBSITE_A = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const WEBSITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HOME = "https://selcukdemirci.me/";
const ABOUT = "https://selcukdemirci.me/about";
const CONTACT = "https://selcukdemirci.me/contact";
const OLD_DUP =
  "Barcelona-based, originally from Istanbul. I work across film and design, directing music videos, commercials and branded films, alongside creative direction and visual identities.";
const HOME_NEW =
  "Selcuk Demirci directs music videos, commercials and branded films, and provides creative direction and visual identities from Barcelona.";
const ABOUT_NEW =
  "Selcuk Demirci is a Barcelona-based film director and creative director, originally from Istanbul, working across film and design.";
const CONTACT_DESC =
  "Contact Selcuk Demirci, film director & creative director based in Barcelona. Available worldwide.";
const IMAGE = "https://selcukdemirci.me/opengraph-image.jpg";
const TITLE_HOME = "Selcuk Demirci · Film Director & Creative Director";
const TITLE_ABOUT = "About · Selcuk Demirci";
const TITLE_CONTACT = "Contact · Selcuk Demirci";

function storedPage(input: {
  url: string;
  title: string;
  description: string;
  canonical?: string;
}): PageMetadataEvidence {
  return {
    requestedUrl: input.url,
    finalUrl: input.url,
    statusCode: 200,
    fields: {
      ...emptyPageFields("unknown"),
      title: { presence: "present", value: input.title },
      meta_description: { presence: "present", value: input.description },
      canonical: { presence: "present", value: input.canonical ?? input.url },
      robots_meta: { presence: "absent", value: null },
    },
  };
}

function snapshot(input: {
  websiteId?: string;
  crawlRunId: string;
  completedAt: string;
  status?: string;
  pagesCrawled?: number;
  pages: PageMetadataEvidence[];
  findings?: CrawlMetadataSnapshot["findings"];
}): CrawlMetadataSnapshot {
  return {
    websiteId: input.websiteId ?? WEBSITE_A,
    crawlRunId: input.crawlRunId,
    status: input.status ?? "completed",
    pagesCrawled: input.pagesCrawled ?? input.pages.length,
    completedAt: input.completedAt,
    pages: input.pages,
    findings: input.findings,
  };
}

function parsedPage(input: {
  url: string;
  title: string;
  description: string;
  ogImage?: string | null;
  twitterImage?: string | null;
  ogDescription?: string;
  twitterDescription?: string;
}): ParsedPage {
  const description = input.description;
  return {
    requestedUrl: input.url,
    finalUrl: input.url,
    statusCode: 200,
    redirectChain: [],
    title: input.title,
    metaDescription: description,
    canonical: input.url,
    robotsMeta: null,
    xRobotsTag: null,
    h1: ["Selcuk Demirci"],
    h2: [],
    h3: [],
    htmlLang: "en",
    urlLocale: null,
    navLabels: [],
    navigationUrls: [],
    mainExcerpt: null,
    contentHash: null,
    internalLinks: [],
    externalLinks: [],
    imageCount: 0,
    missingAltCount: 0,
    jsonLdTypes: [],
    jsonLdProperties: [],
    wordCount: 10,
    socialMetadata: {
      ogDescription: input.ogDescription ?? description,
      ogImage: input.ogImage === undefined ? IMAGE : input.ogImage,
      ogImageAlt: input.ogImage ? "Selcuk Demirci, film director and creative director based in Barcelona" : null,
      ogImageType: input.ogImage ? "image/jpeg" : null,
      ogImageWidth: input.ogImage ? "1200" : null,
      ogImageHeight: input.ogImage ? "630" : null,
      twitterCard: "summary_large_image",
      twitterDescription: input.twitterDescription ?? description,
      twitterImage: input.twitterImage === undefined ? IMAGE : input.twitterImage,
      twitterImageAlt: input.twitterImage
        ? "Selcuk Demirci, film director and creative director based in Barcelona"
        : null,
    },
  };
}

const baselineStored = snapshot({
  crawlRunId: "baseline-selcuk",
  completedAt: "2026-11-03T22:53:00.000Z",
  pages: [
    storedPage({ url: HOME, title: TITLE_HOME, description: OLD_DUP }),
    storedPage({ url: ABOUT, title: TITLE_ABOUT, description: OLD_DUP }),
    storedPage({ url: CONTACT, title: TITLE_CONTACT, description: CONTACT_DESC }),
  ],
  findings: [
    { ruleKey: "page_fundamentals.duplicate_meta_description", pageUrl: HOME },
    { ruleKey: "page_fundamentals.duplicate_meta_description", pageUrl: ABOUT },
    { ruleKey: "page_fundamentals.title_length_out_of_range", pageUrl: ABOUT },
    { ruleKey: "page_fundamentals.title_length_out_of_range", pageUrl: CONTACT },
  ],
});

const verificationStored = snapshot({
  crawlRunId: "verify-selcuk",
  completedAt: "2026-11-03T23:44:07.651Z",
  pages: [
    storedPage({ url: HOME, title: TITLE_HOME, description: HOME_NEW }),
    storedPage({ url: ABOUT, title: TITLE_ABOUT, description: ABOUT_NEW }),
    storedPage({ url: CONTACT, title: TITLE_CONTACT, description: CONTACT_DESC }),
  ],
  findings: [
    { ruleKey: "page_fundamentals.title_length_out_of_range", pageUrl: ABOUT },
    { ruleKey: "page_fundamentals.title_length_out_of_range", pageUrl: CONTACT },
  ],
});

const baselineParsed = snapshot({
  crawlRunId: "baseline-parsed-full",
  completedAt: "2026-11-03T22:53:00.000Z",
  pages: [
    pageEvidenceFromParsedPage(
      parsedPage({ url: HOME, title: TITLE_HOME, description: OLD_DUP, ogImage: IMAGE, twitterImage: IMAGE }),
    ),
    pageEvidenceFromParsedPage(
      parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: OLD_DUP, ogImage: IMAGE, twitterImage: IMAGE }),
    ),
    pageEvidenceFromParsedPage(
      parsedPage({
        url: CONTACT,
        title: TITLE_CONTACT,
        description: CONTACT_DESC,
        ogImage: IMAGE,
        twitterImage: IMAGE,
      }),
    ),
  ],
  findings: baselineStored.findings,
});

const verificationParsed = snapshot({
  crawlRunId: "verify-parsed-full",
  completedAt: "2026-11-03T23:44:07.651Z",
  pages: [
    pageEvidenceFromParsedPage(
      parsedPage({ url: HOME, title: TITLE_HOME, description: HOME_NEW, ogImage: IMAGE, twitterImage: IMAGE }),
    ),
    pageEvidenceFromParsedPage(
      parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: ABOUT_NEW, ogImage: IMAGE, twitterImage: IMAGE }),
    ),
    pageEvidenceFromParsedPage(
      parsedPage({
        url: CONTACT,
        title: TITLE_CONTACT,
        description: CONTACT_DESC,
        ogImage: IMAGE,
        twitterImage: IMAGE,
      }),
    ),
  ],
  findings: verificationStored.findings,
});

function spec(overrides: Partial<ManualSeoImprovementSpec> = {}): ManualSeoImprovementSpec {
  return {
    websiteId: WEBSITE_A,
    urls: [HOME, ABOUT, CONTACT],
    baseline: baselineStored,
    verification: verificationStored,
    expectedChanges: [
      { url: HOME, field: "meta_description", after: HOME_NEW },
      { url: ABOUT, field: "meta_description", after: ABOUT_NEW },
    ],
    originalFindingRuleKey: "page_fundamentals.duplicate_meta_description",
    ...overrides,
  };
}

describe("manual SEO regression safety", () => {
  it("1. expected description change → PASS when required fields are fully observed", () => {
    const report = evaluateManualSeoRegression(
      spec({
        baseline: baselineParsed,
        verification: verificationParsed,
      }),
    );
    expect(report.verdict).toBe("pass");
    expect(report.originalIssueStatus).toBe("resolved");
    expect(
      report.checks.filter((check) => check.role === "expected_change").every((check) => check.result === "pass"),
    ).toBe(true);
  });

  it("2. original duplicate finding resolved", () => {
    const report = evaluateManualSeoRegression(
      spec({ preserveFields: ["title", "canonical", "robots_meta"] }),
    );
    expect(report.originalIssueStatus).toBe("resolved");
    expect(
      report.verificationCrawlId === "verify-selcuk" &&
        !verificationStored.findings?.some(
          (finding) => finding.ruleKey === "page_fundamentals.duplicate_meta_description",
        ),
    ).toBe(true);
  });

  it("3. og:image previously present, now absent → FAIL", () => {
    const report = evaluateManualSeoRegression(
      spec({
        baseline: snapshot({
          crawlRunId: "baseline-parsed",
          completedAt: "2026-11-03T22:53:00.000Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({ url: HOME, title: TITLE_HOME, description: OLD_DUP, ogImage: IMAGE }),
            ),
            pageEvidenceFromParsedPage(
              parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: OLD_DUP, ogImage: IMAGE }),
            ),
          ],
        }),
        verification: snapshot({
          crawlRunId: "verify-parsed",
          completedAt: "2026-11-03T23:44:07.651Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({ url: HOME, title: TITLE_HOME, description: HOME_NEW, ogImage: IMAGE }),
            ),
            pageEvidenceFromParsedPage(
              parsedPage({
                url: ABOUT,
                title: TITLE_ABOUT,
                description: ABOUT_NEW,
                ogImage: null,
                twitterImage: IMAGE,
              }),
            ),
          ],
        }),
        urls: [HOME, ABOUT],
        preserveFields: ["og_image"],
      }),
    );
    expect(report.verdict).toBe("fail");
    expect(
      report.checks.some(
        (check) =>
          check.url === ABOUT && check.field === "og_image" && check.outcome === "removed" && check.result === "fail",
      ),
    ).toBe(true);
  });

  it("4. twitter:image previously present, now absent → FAIL", () => {
    const report = evaluateManualSeoRegression(
      spec({
        baseline: snapshot({
          crawlRunId: "baseline-tw",
          completedAt: "2026-11-03T22:53:00.000Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: OLD_DUP, twitterImage: IMAGE }),
            ),
          ],
        }),
        verification: snapshot({
          crawlRunId: "verify-tw",
          completedAt: "2026-11-03T23:44:07.651Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({
                url: ABOUT,
                title: TITLE_ABOUT,
                description: ABOUT_NEW,
                ogImage: IMAGE,
                twitterImage: null,
              }),
            ),
          ],
        }),
        urls: [ABOUT],
        expectedChanges: [{ url: ABOUT, field: "meta_description", after: ABOUT_NEW }],
        preserveFields: ["twitter_image"],
      }),
    );
    expect(report.verdict).toBe("fail");
    expect(
      report.checks.some(
        (check) => check.field === "twitter_image" && check.outcome === "removed" && check.result === "fail",
      ),
    ).toBe(true);
  });

  it("5. approved social image change is not a regression", () => {
    const nextImage = "https://selcukdemirci.me/new-image.jpg";
    const report = evaluateManualSeoRegression(
      spec({
        baseline: snapshot({
          crawlRunId: "baseline-img",
          completedAt: "2026-11-03T22:53:00.000Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: ABOUT_NEW, ogImage: IMAGE }),
            ),
          ],
        }),
        verification: snapshot({
          crawlRunId: "verify-img",
          completedAt: "2026-11-03T23:44:07.651Z",
          pages: [
            pageEvidenceFromParsedPage(
              parsedPage({ url: ABOUT, title: TITLE_ABOUT, description: ABOUT_NEW, ogImage: nextImage }),
            ),
          ],
        }),
        urls: [ABOUT],
        expectedChanges: [{ url: ABOUT, field: "og_image", after: nextImage }],
        preserveFields: ["title"],
        originalFindingRuleKey: undefined,
      }),
    );
    expect(report.verdict).toBe("pass");
    expect(
      report.checks.some(
        (check) => check.field === "og_image" && check.role === "expected_change" && check.result === "pass",
      ),
    ).toBe(true);
  });

  it("6. required baseline field not collected → NOT VERIFIED", () => {
    const report = evaluateManualSeoRegression(spec());
    expect(report.verdict).toBe("not_verified");
    expect(
      report.checks.some(
        (check) => check.field === "og_image" && check.result === "not_verified" && check.outcome === "unknown",
      ),
    ).toBe(true);
    expect(report.limitations.join(" ")).toMatch(/not proof that a metadata field was absent/i);
  });

  it("7. missing post-change evidence → NOT VERIFIED", () => {
    const report = evaluateManualSeoRegression(
      spec({
        verification: snapshot({
          crawlRunId: "verify-missing",
          completedAt: "2026-11-03T23:44:07.651Z",
          pages: [storedPage({ url: HOME, title: TITLE_HOME, description: HOME_NEW })],
        }),
        preserveFields: ["title"],
      }),
    );
    expect(report.urls.find((item) => item.url === ABOUT)?.matched).toBe(false);
    expect(report.verdict).toBe("not_verified");
  });

  it("8. incomplete crawl → NOT VERIFIED", () => {
    const report = evaluateManualSeoRegression(
      spec({
        verification: { ...verificationStored, status: "failed", pagesCrawled: 0 },
      }),
    );
    expect(report.verdict).toBe("not_verified");
    expect(report.checks).toEqual([]);
    expect(report.summary).toMatch(/incomplete/i);
  });

  it("9. wrong website or unmatched URL → no comparison", () => {
    const wrongWebsite = evaluateManualSeoRegression(
      spec({
        verification: { ...verificationStored, websiteId: WEBSITE_B },
      }),
    );
    expect(wrongWebsite.verdict).toBe("not_verified");
    expect(wrongWebsite.checks).toEqual([]);
    expect(wrongWebsite.urls.every((item) => !item.matched)).toBe(true);

    const unmatched = evaluateManualSeoRegression(
      spec({
        urls: ["https://selcukdemirci.me/work"],
        expectedChanges: [],
        preserveFields: ["title"],
      }),
    );
    expect(unmatched.verdict).toBe("not_verified");
    expect(unmatched.checks).toEqual([]);
  });

  it("10. no regression on unchanged Contact metadata", () => {
    const report = evaluateManualSeoRegression(
      spec({ preserveFields: ["title", "canonical", "meta_description"] }),
    );
    expect(
      report.checks.filter((check) => check.url === CONTACT && check.result === "fail"),
    ).toEqual([]);
    expect(
      report.checks.some(
        (check) =>
          check.url === CONTACT &&
          check.field === "meta_description" &&
          check.outcome === "unchanged" &&
          check.result === "pass",
      ),
    ).toBe(true);
  });

  it("11. no unrelated findings treated as newly introduced", () => {
    const report = evaluateManualSeoRegression(
      spec({
        baseline: baselineParsed,
        verification: verificationParsed,
      }),
    );
    expect(report.originalIssueStatus).toBe("resolved");
    expect(report.verdict).toBe("pass");
    expect(
      report.checks.some((check) => check.note.includes("title_length_out_of_range")),
    ).toBe(false);
  });

  it("12. existing crawl and owner isolation is unchanged by this comparison", () => {
    const isolated = evaluateManualSeoRegression(
      spec({
        websiteId: WEBSITE_A,
        baseline: { ...baselineStored, websiteId: WEBSITE_B },
      }),
    );
    expect(isolated.verdict).toBe("not_verified");
    expect(isolated.summary).toMatch(/same website/i);
  });

  it("does not claim historical stored snapshots contained social metadata", () => {
    const report = evaluateManualSeoRegression(spec());
    const socialUnknown = report.checks.filter(
      (check) =>
        (check.field === "og_image" || check.field === "twitter_image") &&
        check.outcome === "unknown",
    );
    expect(socialUnknown.length).toBeGreaterThan(0);
    expect(report.verdict).toBe("not_verified");
    const copy = formatRegressionSafetyReport(report);
    expect(copy.ownerPublishedNote).toMatch(/owner published/i);
    expect(copy.ownerPublishedNote).not.toMatch(/Foundfy published/i);
    expect(copy.unverified.join(" ")).toMatch(/did not collect|did not store/i);
  });
});
