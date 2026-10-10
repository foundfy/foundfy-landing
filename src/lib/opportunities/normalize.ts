/**
 * Mechanical query keys for Opportunity Grain v1.
 * Lowercase, Unicode NFC, punctuation/whitespace normalization.
 * Diacritics are preserved. No stemming, edit distance, or mark stripping.
 */
export function opportunityQueryKey(query: string): string {
  return query
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function opportunityCompactKey(query: string): string {
  return opportunityQueryKey(query).replace(/\s+/g, "");
}

export function brandTokenFromHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const label = host.split(".")[0] ?? "";
  return opportunityCompactKey(label);
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

  const compact = opportunityCompactKey(query);
  return compact.length > 0 && compactBrandForms(brand).includes(compact);
}
