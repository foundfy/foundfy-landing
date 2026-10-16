import { describe, expect, it } from "vitest";
import {
  inspectLanguageScope,
  inspectPageStrength,
  inspectRelatedDemandPages,
  type InspectPageEvidence,
} from "./inspect-match";

function page(overrides: Partial<InspectPageEvidence> & { id: string }): InspectPageEvidence {
  return {
    requestedUrl: `https://example.com/${overrides.id}`,
    finalUrl: `https://example.com/${overrides.id}`,
    title: null,
    h1: [],
    metaDescription: null,
    excerpt: null,
    htmlLang: "es",
    urlLocale: "es",
    canonical: null,
    ...overrides,
  };
}

const DBHOBBY_PAGES: InspectPageEvidence[] = [
  page({
    id: "es-home",
    requestedUrl: "https://www.dbhobby.com/es",
    title: "Pintura en seda | DBHOBBY",
    excerpt: "Pintura Arasilk para seda",
    canonical: "https://www.dbhobby.com/es/pintura-en-seda",
  }),
  page({
    id: "gutta",
    requestedUrl: "https://dbhobby.com/es/gutta-para-seda",
    title: "DBHOBBY | Pintura sobre seda",
    excerpt: "38,33 €",
  }),
  page({
    id: "vapor",
    requestedUrl: "https://dbhobby.com/es/pintura-seda/fijacion-del-color-con-vapor",
    title: "Fijación del color con vapor | DBHOBBY",
    h1: ["Fijación del color con vapor"],
    excerpt: "pieza de seda, será la fijadora",
  }),
  page({
    id: "ciano",
    requestedUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    title: "Set de cianotipo | DBHOBBY",
    h1: ["Set de cianotipo"],
    excerpt: "25,80 €",
  }),
  page({
    id: "en-home",
    requestedUrl: "https://dbhobby.com/en",
    title: "Pintura sobre seda | DBHOBBY",
    htmlLang: "en",
    urlLocale: "en",
    excerpt: "Accessoris i complements varis per pintar i decorar.",
  }),
];

describe("related demand page inspection matching", () => {
  it("treats exact title match as clear existing-page evidence", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [page({ id: "how-to", title: "Como pintar en seda" })],
    });
    expect(result.state).toBe("clear_existing_page_evidence");
    expect(result.candidatePages).toHaveLength(1);
  });

  it("treats compact title/H1 equality as clear evidence", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [page({ id: "h1", title: "Other", h1: ["como-pintar-en-seda"] })],
    });
    expect(result.state).toBe("clear_existing_page_evidence");
  });

  it("treats two equal strong candidates as ambiguous", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [
        page({ id: "a", title: "Como pintar en seda" }),
        page({ id: "b", h1: ["Como pintar en seda"] }),
      ],
    });
    expect(result.state).toBe("ambiguous");
    expect(result.candidatePages).toHaveLength(2);
  });

  it("treats excerpt-only evidence as ambiguous", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [page({ id: "excerpt", title: "Materials", excerpt: "Learn como pintar en seda today" })],
    });
    expect(result.state).toBe("ambiguous");
  });

  it("does not treat pintura as pintar", () => {
    expect(inspectPageStrength(DBHOBBY_PAGES[0]!, "como pintar en seda")).toBe("none");
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: DBHOBBY_PAGES,
    });
    expect(result.state).toBe("no_obvious_match_in_current_crawl");
    expect(result.candidatePages).toEqual([]);
  });

  it("does not use Catalan or English pages for a Spanish idea", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [
        page({
          id: "ca",
          title: "Como pintar en seda",
          htmlLang: "ca",
          urlLocale: "ca",
        }),
        page({
          id: "en",
          title: "Como pintar en seda",
          htmlLang: "en",
          urlLocale: "en",
        }),
      ],
    });
    expect(result.state).toBe("no_obvious_match_in_current_crawl");
  });

  it("marks conflicting html_lang and url_locale as language conflict", () => {
    expect(
      inspectLanguageScope({ htmlLang: "es", urlLocale: "ca" }, "es"),
    ).toBe("conflict");
  });

  it("does not treat a canonical URL as current page evidence", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [
        page({
          id: "home",
          title: "Pintura en seda | DBHOBBY",
          canonical: "https://www.dbhobby.com/es/como-pintar-en-seda",
        }),
      ],
    });
    expect(result.state).toBe("no_obvious_match_in_current_crawl");
  });

  it("treats language-conflict evidence as ambiguous rather than clear", () => {
    const result = inspectRelatedDemandPages({
      phrase: "como pintar en seda",
      languageCode: "es",
      pages: [
        page({
          id: "conflict",
          title: "Como pintar en seda",
          htmlLang: "es",
          urlLocale: "ca",
        }),
      ],
    });
    expect(result.state).toBe("ambiguous");
  });
});
