import { createHash } from "node:crypto";
import { SITE_INTERPRETATION_PROMPT_VERSION } from "../types";
import type { SiteModelEvidence, SiteModelUnderstanding } from "../types";

export function hashSiteInterpretationEvidence(input: {
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
  promptVersion?: string;
}): string {
  const payload = JSON.stringify({
    promptVersion: input.promptVersion ?? SITE_INTERPRETATION_PROMPT_VERSION,
    hostname: input.understanding.hostname,
    seedUrl: input.understanding.seedUrl,
    sample: input.understanding.sample,
    pageTypeCounts: input.understanding.pageTypeCounts,
    pages: input.understanding.pages.map((page) => ({
      pageId: page.pageId,
      requestedUrl: page.requestedUrl,
      pathClass: page.pathClass,
      title: page.title,
      h1: page.h1,
      h2: page.h2,
      h3: page.h3,
      excerpt: page.excerpt,
      htmlLang: page.htmlLang,
      urlLocale: page.urlLocale,
      navLabels: page.navLabels,
      jsonLdTypes: page.jsonLdTypes,
    })),
    languages: input.understanding.languages,
    navigationLabels: input.understanding.navigationLabels,
    jsonLdTypes: input.understanding.jsonLdTypes,
    jsonLdPropertyCount: input.understanding.jsonLdPropertyCount,
    siteDiscovery: input.understanding.siteDiscovery,
    evidence: {
      crawlRunId: input.evidence.crawlRunId,
      pageIds: input.evidence.pageIds,
      artifactIds: input.evidence.artifactIds,
    },
  });

  return createHash("sha256").update(payload).digest("hex");
}
