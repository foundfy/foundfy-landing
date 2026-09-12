import * as cheerio from "cheerio";
import type { JsonLdAddressSnippet, JsonLdOfferSnippet, JsonLdPropertySnippet } from "../types";
import { normalizeWhitespace } from "./text";

export const MAX_JSON_LD_PROPERTY_RECORDS = 8;
export const MAX_JSON_LD_OFFERS = 3;
export const MAX_JSON_LD_TEXT_CHARS = 280;

function boundJsonLdText(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= MAX_JSON_LD_TEXT_CHARS) {
    return normalized;
  }

  return normalized.slice(0, MAX_JSON_LD_TEXT_CHARS);
}

function parseJsonLdBlocks(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim();
    if (!raw) {
      return;
    }

    try {
      blocks.push(JSON.parse(raw) as unknown);
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  });

  return blocks;
}

function collectJsonLdTypes(value: unknown, types: Set<string>): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, types);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];

  if (typeof typeValue === "string") {
    types.add(typeValue);
  } else if (Array.isArray(typeValue)) {
    for (const entry of typeValue) {
      if (typeof entry === "string") {
        types.add(entry);
      }
    }
  }

  if (record["@graph"]) {
    collectJsonLdTypes(record["@graph"], types);
  }
}

function collectJsonLdNodes(value: unknown, nodes: Record<string, unknown>[]): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdNodes(item, nodes);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  if (record["@type"]) {
    nodes.push(record);
  }

  if (record["@graph"]) {
    collectJsonLdNodes(record["@graph"], nodes);
  }
}

function stringifyType(typeValue: unknown): string | null {
  if (typeof typeValue === "string" && typeValue.trim()) {
    return typeValue.trim();
  }

  if (Array.isArray(typeValue)) {
    const types = typeValue.filter(
      (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
    );
    return types.length > 0 ? types.join(",") : null;
  }

  return null;
}

function extractName(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = boundJsonLdText(value);
    return text || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const name = extractName(item);
      if (name) {
        return name;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractName(record.name);
  }

  return undefined;
}

function extractOffers(value: unknown): JsonLdOfferSnippet[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const offers: JsonLdOfferSnippet[] = [];

  for (const item of items) {
    if (offers.length >= MAX_JSON_LD_OFFERS) {
      break;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const snippet: JsonLdOfferSnippet = {};

    if (typeof record.price === "string" || typeof record.price === "number") {
      snippet.price = String(record.price);
    }

    if (typeof record.priceCurrency === "string" && record.priceCurrency.trim()) {
      snippet.priceCurrency = record.priceCurrency.trim();
    }

    if (typeof record.availability === "string" && record.availability.trim()) {
      snippet.availability = record.availability.trim();
    }

    if (snippet.price || snippet.priceCurrency || snippet.availability) {
      offers.push(snippet);
    }
  }

  return offers;
}

function extractAddress(value: unknown): JsonLdAddressSnippet | undefined {
  if (typeof value === "string") {
    const text = boundJsonLdText(value);
    return text ? { streetAddress: text } : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const address = extractAddress(item);
      if (address) {
        return address;
      }
    }
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const snippet: JsonLdAddressSnippet = {};

  for (const key of [
    "streetAddress",
    "addressLocality",
    "addressRegion",
    "postalCode",
    "addressCountry",
  ] as const) {
    const field = record[key];
    if (typeof field === "string" && field.trim()) {
      snippet[key] = boundJsonLdText(field);
    }
  }

  return Object.keys(snippet).length > 0 ? snippet : undefined;
}

function extractLocation(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = boundJsonLdText(value);
    return text || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const location = extractLocation(item);
      if (location) {
        return location;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractName(record.name) ?? extractName(record);
  }

  return undefined;
}

function toPropertySnippet(node: Record<string, unknown>): JsonLdPropertySnippet | null {
  const type = stringifyType(node["@type"]);
  if (!type) {
    return null;
  }

  const snippet: JsonLdPropertySnippet = { type };
  const name = extractName(node.name);
  const description =
    typeof node.description === "string" ? boundJsonLdText(node.description) : undefined;
  const brand = extractName(node.brand);
  const category =
    typeof node.category === "string" ? boundJsonLdText(node.category) : extractName(node.category);
  const offers = extractOffers(node.offers);
  const address = extractAddress(node.address);
  const location = extractLocation(node.location);

  if (name) {
    snippet.name = name;
  }
  if (description) {
    snippet.description = description;
  }
  if (brand) {
    snippet.brand = brand;
  }
  if (category) {
    snippet.category = category;
  }
  if (offers.length > 0) {
    snippet.offers = offers;
  }
  if (address) {
    snippet.address = address;
  }
  if (location) {
    snippet.location = location;
  }

  const hasPublicProperty = Boolean(
    snippet.name ||
      snippet.description ||
      snippet.brand ||
      snippet.category ||
      snippet.offers ||
      snippet.address ||
      snippet.location,
  );

  return hasPublicProperty ? snippet : null;
}

export function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  for (const block of parseJsonLdBlocks(html)) {
    collectJsonLdTypes(block, types);
  }
  return [...types];
}

export function extractJsonLdProperties(html: string): JsonLdPropertySnippet[] {
  const nodes: Record<string, unknown>[] = [];
  for (const block of parseJsonLdBlocks(html)) {
    collectJsonLdNodes(block, nodes);
  }

  const properties: JsonLdPropertySnippet[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (properties.length >= MAX_JSON_LD_PROPERTY_RECORDS) {
      break;
    }

    const snippet = toPropertySnippet(node);
    if (!snippet) {
      continue;
    }

    const key = JSON.stringify(snippet);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    properties.push(snippet);
  }

  return properties;
}
