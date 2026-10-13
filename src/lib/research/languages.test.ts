import { describe, expect, it } from "vitest";
import { FIXTURE_RESEARCH_LANGUAGES } from "./provider/fixture-metadata";
import {
  normalizeHtmlLang,
  observedLanguageCodes,
  researchLanguageCandidates,
  selectResearchLanguages,
} from "./languages";

describe("RESEARCH languages", () => {
  it("normalizes regional html lang tags", () => {
    expect(normalizeHtmlLang("es-ES")).toBe("es");
    expect(normalizeHtmlLang("ca-ES")).toBe("ca");
    expect(normalizeHtmlLang("en-US")).toBe("en");
    expect(normalizeHtmlLang("en_GB")).toBe("en");
  });

  it("derives candidates from observed html_lang intersected with provider support", () => {
    const candidates = researchLanguageCandidates({
      htmlLangs: ["ca", "es-ES", "en-US", "zz"],
      supported: FIXTURE_RESEARCH_LANGUAGES,
    });
    expect(candidates.map((item) => item.code)).toEqual(["ca", "es", "en"]);
  });

  it("does not choose alphabetically or infer from country", () => {
    expect(observedLanguageCodes(["en", "ca", "es"])).toEqual(["en", "ca", "es"]);
    expect(() =>
      selectResearchLanguages({
        selected: undefined,
        candidates: FIXTURE_RESEARCH_LANGUAGES.filter((item) => item.code === "ca" || item.code === "es"),
      }),
    ).toThrow(/Choose the site languages/);
  });

  it("rejects unsupported languages and more than three selections", () => {
    const candidates = FIXTURE_RESEARCH_LANGUAGES.filter((item) =>
      ["ca", "es", "en"].includes(item.code),
    );
    expect(() =>
      selectResearchLanguages({ selected: ["fr"], candidates }),
    ).toThrow(/observed on this site/);
    expect(
      selectResearchLanguages({ selected: ["es", "ca"], candidates }),
    ).toEqual(["es", "ca"]);
    expect(() =>
      selectResearchLanguages({
        selected: ["ca", "es", "en", "de"],
        candidates: FIXTURE_RESEARCH_LANGUAGES.filter((item) =>
          ["ca", "es", "en", "de"].includes(item.code),
        ),
      }),
    ).toThrow(/up to 3/);
  });

  it("accepts en from a valid provider language list", () => {
    expect(
      selectResearchLanguages({
        selected: ["en"],
        candidates: FIXTURE_RESEARCH_LANGUAGES.filter((item) => item.code === "en"),
      }),
    ).toEqual(["en"]);
  });
});
