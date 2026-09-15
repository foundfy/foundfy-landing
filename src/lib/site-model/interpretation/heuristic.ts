import {
  SITE_INTERPRETATION_PROMPT_VERSION,
  type SiteInterpretationDraft,
  type SiteModelEvidence,
  type SiteModelUnderstanding,
} from "../types";
import { hashSiteInterpretationEvidence } from "./hash";

function firstSentence(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^.{12,220}?(?:[.!?](?:\s|$)|$)/);
  return match?.[0]?.trim() ?? cleaned.slice(0, 220).trim();
}

function excerptSupport(text: string): string | null {
  const sentence = firstSentence(text);
  if (sentence && sentence.length >= 20) {
    return sentence;
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 20) {
    return null;
  }

  return cleaned.slice(0, 180).trim();
}

function readableExcerptQuote(text: string): string | null {
  const spacedSentences = [...text.matchAll(/[A-Z][^.!?]{18,180}[.!?]/g)]
    .map((match) => match[0].trim())
    .filter((sentence) => (sentence.match(/ /g) ?? []).length >= 4)
    .sort((left, right) => (right.match(/ /g) ?? []).length - (left.match(/ /g) ?? []).length);

  if (spacedSentences[0]) {
    return spacedSentences[0];
  }

  return excerptSupport(text);
}

function homepage(understanding: SiteModelUnderstanding) {
  return understanding.pages.find((page) => page.pathClass === "homepage") ?? null;
}

export function buildHeuristicSiteInterpretation(input: {
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
  generatedAt?: string;
}): SiteInterpretationDraft {
  const home = homepage(input.understanding);
  const pageCount = input.understanding.pages.length;
  const uncertainty: string[] = [];
  const descriptionParts: string[] = [];

  if (home?.title) {
    descriptionParts.push(`The homepage title is “${home.title}”.`);
  } else if (home?.h1[0]) {
    descriptionParts.push(`The homepage heading is “${home.h1[0]}”.`);
  }

  const excerptSentence = home?.excerpt ? readableExcerptQuote(home.excerpt) : null;
  if (excerptSentence && excerptSentence.length >= 20) {
    descriptionParts.push(`On-page copy includes: “${excerptSentence}”.`);
  }

  if (descriptionParts.length === 0) {
    descriptionParts.push(
      `Foundfy fetched ${pageCount} page${pageCount === 1 ? "" : "s"} for ${input.understanding.hostname}, but the stored titles and excerpts are too thin to describe the site.`,
    );
  }

  if (pageCount <= 2) {
    uncertainty.push(
      `Only ${pageCount} page${pageCount === 1 ? " was" : "s were"} fetched, so this is a cautious reading rather than a complete picture of the site.`,
    );
  }

  if (input.understanding.sample.sampleIsCapped) {
    uncertainty.push(
      "The crawl sample is bounded, so Foundfy is not treating this as a full content catalog.",
    );
  }

  if (input.understanding.navigationLabels.length === 0) {
    uncertainty.push("No navigation labels were stored, so sections and offerings are not confirmed from a menu.");
  }

  if (input.understanding.jsonLdTypes.length === 0) {
    uncertainty.push("No JSON-LD was stored, so products, services, and organization details are not confirmed from structured data.");
  }

  if (input.understanding.languages.urlLocales.length === 0) {
    uncertainty.push("No URL locale segment was observed, so locations are unknown from the URL structure.");
  }

  const hasIdentity = input.understanding.pages.some((page) => page.pathClass === "identity");
  if (!hasIdentity) {
    uncertainty.push("No about or identity URL was fetched in this sample.");
  }

  return {
    promptVersion: SITE_INTERPRETATION_PROMPT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    generator: "heuristic",
    status: "ready",
    evidenceHash: hashSiteInterpretationEvidence({
      understanding: input.understanding,
      evidence: input.evidence,
    }),
    sourceCrawlRunId: input.evidence.crawlRunId,
    siteDescription: descriptionParts.join(" "),
    offers: [],
    audiences: [],
    locations: [],
    uncertainty,
  };
}
