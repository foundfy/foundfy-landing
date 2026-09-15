import type { SiteModelEvidence, SiteModelUnderstanding } from "../types";
import { SITE_INTERPRETATION_PROMPT_VERSION } from "../types";

export const SITE_INTERPRETATION_SYSTEM_INSTRUCTIONS =
  "You interpret a bounded website crawl sample for Foundfy. Use only the supplied Site Model evidence. Never invent products, audiences, locations, rankings, demand, or search performance. If evidence is thin, say so.";

export function buildSiteInterpretationPrompt(input: {
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
}): string {
  return [
    "Write a cautious draft interpretation of this website.",
    "Rules:",
    "- Use only the supplied Site Model JSON.",
    "- Do not search the web or use outside knowledge.",
    "- Do not invent products, audiences, locations, rankings, traffic, or demand.",
    "- Do not give SEO recommendations or mention GSC, GA4, or keywords.",
    "- siteDescription must stay close to observed titles, headings, and excerpts.",
    "- offers, audiences, and locations must be empty unless the evidence directly supports them.",
    "- If the sample has two or fewer pages, leave audiences empty and include uncertainty.",
    "- If there is no URL locale and no place/address JSON-LD, leave locations empty.",
    "- uncertainty must name what is missing or too thin to claim.",
    "",
    "Return JSON matching the schema exactly.",
    "",
    JSON.stringify(
      {
        promptVersion: SITE_INTERPRETATION_PROMPT_VERSION,
        crawlRunId: input.evidence.crawlRunId,
        websiteId: input.evidence.websiteId,
        understanding: {
          hostname: input.understanding.hostname,
          seedUrl: input.understanding.seedUrl,
          sample: input.understanding.sample,
          pageTypeCounts: input.understanding.pageTypeCounts,
          languages: input.understanding.languages,
          navigationLabels: input.understanding.navigationLabels,
          jsonLdTypes: input.understanding.jsonLdTypes,
          jsonLdPropertyCount: input.understanding.jsonLdPropertyCount,
          siteDiscovery: input.understanding.siteDiscovery,
          pages: input.understanding.pages.map((page) => ({
            pathClass: page.pathClass,
            requestedUrl: page.requestedUrl,
            title: page.title,
            h1: page.h1,
            h2: page.h2.slice(0, 6),
            h3: page.h3.slice(0, 8),
            excerpt: page.excerpt,
            htmlLang: page.htmlLang,
            urlLocale: page.urlLocale,
            navLabels: page.navLabels,
            jsonLdTypes: page.jsonLdTypes,
          })),
        },
      },
      null,
      2,
    ),
  ].join("\n");
}

export const SITE_INTERPRETATION_RESPONSE_JSON_SCHEMA = {
  name: "site_interpretation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      siteDescription: { type: "string" },
      offers: { type: "array", items: { type: "string" } },
      audiences: { type: "array", items: { type: "string" } },
      locations: { type: "array", items: { type: "string" } },
      uncertainty: { type: "array", items: { type: "string" } },
    },
    required: ["siteDescription", "offers", "audiences", "locations", "uncertainty"],
  },
} as const;
