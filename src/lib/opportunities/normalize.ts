/** Deterministic grouping key: case, accents, punctuation, whitespace. No stemming. */
export function opportunityQueryKey(query: string): string {
  const folded = query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/ł/g, "l")
    .toLowerCase();

  return folded.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function brandTokenFromHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const label = host.split(".")[0] ?? "";
  return opportunityQueryKey(label).replace(/\s+/g, "");
}

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isConsonant(character: string): boolean {
  return character.length === 1 && /[a-z]/.test(character) && !VOWELS.has(character);
}

/** Whole-query brand forms: exact token, token + s, and consonant+y → ies. */
export function compactBrandForms(brand: string): string[] {
  const forms = new Set<string>();
  if (!brand) {
    return [];
  }

  forms.add(brand);
  forms.add(`${brand}s`);

  if (brand.length >= 2 && brand.endsWith("y") && isConsonant(brand[brand.length - 2] ?? "")) {
    forms.add(`${brand.slice(0, -1)}ies`);
  }

  return [...forms];
}

export function isClearlyBrandedQuery(query: string, hostname: string): boolean {
  const brand = brandTokenFromHostname(hostname);
  if (!brand) {
    return false;
  }

  const compact = opportunityQueryKey(query).replace(/\s+/g, "");
  return compact.length > 0 && compactBrandForms(brand).includes(compact);
}
