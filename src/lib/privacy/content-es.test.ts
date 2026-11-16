import { describe, expect, it } from "vitest";
import { PRIVACY_SECTIONS } from "./content";
import { PRIVACY_INTRO_ES, PRIVACY_PAGE_TITLE_ES, PRIVACY_SECTIONS_ES } from "./content-es";

// Facts that must appear identically in both languages, section by section:
// providers, products, UI labels, contact and figures. If one language gains or
// loses one of these, the translations have diverged.
const ANCHORS = [
  "OpenAI",
  "Supabase",
  "Resend",
  "Google",
  "Search Console",
  "ChatGPT",
  "Gemini",
  "Perplexity",
  "Connect Google",
  "Explain further",
  "DNS",
  "CTR",
  "sitemap",
  "robots.txt",
  "hello@foundfy.me",
] as const;

function anchorsIn(text: string): string[] {
  const found: string[] = ANCHORS.filter((anchor) => text.includes(anchor));
  // Figures: "1,000" (en) and "1.000" (es) are the same number.
  for (const match of text.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{2,}\b/g)) {
    found.push(match[0].replace(/[.,]/g, ""));
  }
  return [...new Set(found)].sort();
}

function sectionBody(title: string): string {
  return PRIVACY_SECTIONS_ES.find((section) => section.title === title)?.body ?? "";
}

describe("Spanish privacy page stays in sync with the English one", () => {
  it("has one Spanish section per English section, in the same order", () => {
    expect(PRIVACY_PAGE_TITLE_ES).toBe("Privacidad");
    expect(PRIVACY_INTRO_ES.trim()).not.toBe("");
    expect(PRIVACY_SECTIONS_ES).toHaveLength(PRIVACY_SECTIONS.length);
  });

  it("states the same providers, labels, contact and figures in every section", () => {
    PRIVACY_SECTIONS.forEach((english, index) => {
      const spanish = PRIVACY_SECTIONS_ES[index];
      expect(anchorsIn(spanish.body), `${english.title} / ${spanish.title}`).toEqual(
        anchorsIn(english.body),
      );
    });
  });

  it("discloses automatic OpenAI processing, like the English notice", () => {
    const body = sectionBody("Explicaciones con IA (OpenAI)");
    expect(body).toContain("Foundfy usa OpenAI de forma automática");
    expect(body).toContain("Al abrir un análisis completado");
    expect(body).toContain("Al abrir la página de una web en Foundfy");
    expect(body).toContain("datos limitados sobre los hallazgos destacados");
    expect(body).toContain("fragmentos de texto de hasta 1.000 caracteres por página");
    expect(body).toContain("solo muestra una explicación que ya se ha generado");
    expect(body).toContain("se guardan con el análisis");
  });

  it("does not reintroduce the outdated on-request OpenAI claim", () => {
    const text = PRIVACY_SECTIONS_ES.map((section) => `${section.title} ${section.body}`).join(" ");
    expect(text).not.toMatch(/si usas la opción de explicación ampliada/i);
    expect(text).not.toMatch(/puede enviarse a OpenAI evidencia limitada del hallazgo/i);
    expect(text).not.toContain("Explicación ampliada");
  });

  it("makes no OpenAI retention promises", () => {
    expect(sectionBody("Explicaciones con IA (OpenAI)")).not.toMatch(
      /conservación cero|retención cero|OpenAI no (guarda|conserva)|OpenAI (elimina|borra)|store: false/i,
    );
  });

  it("discloses where form details go, without new purposes", () => {
    const body = sectionBody("Qué guardamos");
    expect(body).toContain("rol, interés y, opcionalmente, una web");
    expect(body).toContain("alojada en Supabase");
    expect(body).toContain("a través de Resend, un servicio de envío de emails");
    expect(body).toContain("para que el equipo pueda gestionar tu solicitud");
    expect(body).not.toMatch(/marketing|newsletter|boletín|publicidad|promocional/i);
  });
});
