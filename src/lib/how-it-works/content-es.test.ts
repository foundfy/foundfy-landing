import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_ES } from "./content-es";

function strings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(strings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

const text = strings(HOW_IT_WORKS_ES);

describe("Spanish how-it-works copy", () => {
  it("has no empty strings", () => {
    expect(text.filter((value) => value.trim() === "")).toEqual([]);
  });

  it("shows no price figure", () => {
    expect(text.filter((value) => /€|\beur\b|\b\d+\s?(euros?)\b|\+\s?iva/i.test(value))).toEqual(
      [],
    );
  });

  it("does not claim automated execution or publication", () => {
    expect(
      text.filter((value) =>
        /automátic|ejecutad|ejecuta |lo hacemos todo|sin que hagas nada|publicamos por ti/i.test(
          value,
        ),
      ),
    ).toEqual([]);
  });

  it("does not add AI search visibility claims or a FAQ", () => {
    expect(
      text.filter((value) => /chatgpt|gemini|perplexity|asistentes? de ia|faq|preguntas frecuentes/i.test(value)),
    ).toEqual([]);
  });

  it("does not include the Founding Pilot", () => {
    expect(text.filter((value) => /piloto/i.test(value))).toEqual([]);
  });

  it("keeps the approved service, approval and verification statements", () => {
    const all = text.join(" ");
    for (const fact of [
      "Foundfy es un servicio de SEO para pequeñas empresas",
      "Tú decides qué cambios se aprueban.",
      "hasta 10 páginas",
      "configuraciones que pueden dificultar que Google rastree o indexe tus páginas",
      "el acceso es de solo lectura",
      "Google te pedirá un permiso adicional",
      "aunque no podemos priorizarlos con las mismas señales de búsqueda",
      "Nada se modifica sin tu aprobación.",
      "Foundfy no modifica tu web por su cuenta.",
      "Esa interpretación se confirma antes de utilizarla para priorizar.",
      "La IA no publica cambios ni sustituye tu aprobación.",
      "No garantizamos una posición concreta en Google ni un número de clientes.",
      "Distinguimos entre lo que hemos comprobado y lo que todavía necesita tiempo y datos para evaluarse.",
      "El análisis inicial es gratuito",
    ]) {
      expect(all).toContain(fact);
    }
  });

  it("has five steps and links the call to action to the Spanish form", () => {
    expect(HOW_IT_WORKS_ES.steps.items).toHaveLength(5);
    expect(HOW_IT_WORKS_ES.cta).toEqual({
      title: "¿Quieres que revisemos tu web?",
      label: "Solicitar una revisión",
      href: "/es#early-access",
    });
    expect(HOW_IT_WORKS_ES.path).toBe("/es/como-funciona");
  });
});
