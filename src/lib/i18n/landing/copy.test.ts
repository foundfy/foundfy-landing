import { describe, expect, it } from "vitest";
import { EN_LANDING_COPY } from "./en";
import { ES_LANDING_COPY } from "./es";
import { getLandingCopy } from "./index";
import { PRIVACY_SECTIONS } from "@/lib/privacy/content";
import { PRIVACY_SECTIONS_ES } from "@/lib/privacy/content-es";

// Keys that may legitimately differ between locales: optional additions, and the
// server-error override (English keeps the server message, Spanish replaces it).
const OPTIONAL_KEYS = new Set(["sectionId", "exampleNote", "server", "tail"]);

function shape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(shape);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !OPTIONAL_KEYS.has(key))
        .map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

function strings(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") {
    return [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => strings(child, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      strings(child, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("landing copy dictionaries", () => {
  it("resolves each locale to its own dictionary", () => {
    expect(getLandingCopy("en")).toBe(EN_LANDING_COPY);
    expect(getLandingCopy("es")).toBe(ES_LANDING_COPY);
  });

  it("gives Spanish the same structure as English, apart from the nav and sign-in", () => {
    const { hero: enHero, ...enRest } = EN_LANDING_COPY;
    const { hero: esHero, ...esRest } = ES_LANDING_COPY;
    expect(shape(esRest)).toEqual(shape(enRest));
    const { navLinks: _en, signIn: _enSignIn, ...enHeroRest } = enHero;
    const { navLinks: _es, signIn: esSignIn, ...esHeroRest } = esHero;
    expect(shape(esHeroRest)).toEqual(shape(enHeroRest));
    // No sign-in in Spanish until a login exists.
    expect(esSignIn).toBeNull();
  });

  it("has no empty Spanish strings", () => {
    const empty = strings(ES_LANDING_COPY).filter(([, text]) => text.trim() === "");
    expect(empty).toEqual([]);
  });

  it("shows no price figure in Spanish", () => {
    const priced = strings(ES_LANDING_COPY).filter(([, text]) =>
      /€|\beur\b|\b\d+\s?(euros?)\b|\+\s?iva/i.test(text),
    );
    expect(priced).toEqual([]);
  });

  it("does not claim automated execution in Spanish", () => {
    const claims = strings(ES_LANDING_COPY).filter(([, text]) =>
      /automátic|ejecutad|ejecuta |lo hacemos todo|sin que hagas nada/i.test(text),
    );
    expect(claims).toEqual([]);
  });

  it("marks AI search as upcoming wherever Spanish mentions it", () => {
    expect(ES_LANDING_COPY.hero.proof[1]).toMatch(/próximamente/);
    expect(ES_LANDING_COPY.whyNow.cards[3].title).toMatch(/en camino/);
    expect(ES_LANDING_COPY.capabilityGrid.ai.ahead).toBe("En camino");
  });

  it("labels the Spanish example data as illustrative and uses impressions/clicks", () => {
    expect(ES_LANDING_COPY.productFlow.exampleNote).toMatch(/ejemplo/i);
    expect(ES_LANDING_COPY.capabilityGrid.exampleNote).toMatch(/ejemplo/i);
    const mixedMetrics = strings(ES_LANDING_COPY).filter(([, text]) =>
      /apariciones|visitas/i.test(text),
    );
    expect(mixedMetrics).toEqual([]);
  });

  it("points every Spanish in-page link at a section that exists", () => {
    const ids = new Set([
      ES_LANDING_COPY.whatWeBuilding.sectionId,
      ES_LANDING_COPY.productFlow.sectionId,
      ES_LANDING_COPY.capabilityGrid.sectionId,
      "early-access",
    ]);
    const anchors = [
      ...ES_LANDING_COPY.hero.navLinks.map((link) => link.href),
      ES_LANDING_COPY.hero.getStarted.href,
      ES_LANDING_COPY.hero.announcement.href,
    ];
    for (const href of anchors) {
      expect(href.startsWith("#"), href).toBe(true);
      expect(ids.has(href.slice(1)), href).toBe(true);
    }
  });

  it("uses the agreed Spanish closing: white lead, orange accent, no third line", () => {
    expect(ES_LANDING_COPY.closing.headline).toEqual({
      lead: "Tú llevas tu negocio.",
      accent: "Foundfy se ocupa del SEO.",
    });
    expect(EN_LANDING_COPY.closing.headline).toEqual({
      lead: "Found today.",
      accent: "Further",
      tail: "tomorrow.",
    });
  });

  it("replaces English server errors in Spanish but keeps them in English", () => {
    expect(EN_LANDING_COPY.earlyAccess.errors.server).toBeNull();
    expect(ES_LANDING_COPY.earlyAccess.errors.server).toMatch(/inténtalo/);
  });

  it("keeps English free of the Spanish-only additions", () => {
    expect("sectionId" in EN_LANDING_COPY.whatWeBuilding).toBe(false);
    expect("exampleNote" in EN_LANDING_COPY.productFlow).toBe(false);
    expect(EN_LANDING_COPY.footer.privacy.href).toBe("/privacy");
    expect(ES_LANDING_COPY.footer.privacy.href).toBe("/es/privacidad");
  });
});

describe("Spanish privacy page", () => {
  it("translates every English section", () => {
    expect(PRIVACY_SECTIONS_ES).toHaveLength(PRIVACY_SECTIONS.length);
    for (const section of PRIVACY_SECTIONS_ES) {
      expect(section.title.trim()).not.toBe("");
      expect(section.body.trim()).not.toBe("");
    }
  });

  it("keeps the facts that matter for consent", () => {
    const text = PRIVACY_SECTIONS_ES.map((section) => section.body).join(" ");
    for (const fact of [
      "solo lectura",
      "token de actualización cifrado",
      "rol, interés",
      "OpenAI",
      "hello@foundfy.me",
    ]) {
      expect(text).toContain(fact);
    }
  });
});
