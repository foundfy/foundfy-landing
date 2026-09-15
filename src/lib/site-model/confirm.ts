import { findLatestUsableCrawlRun, getWebsiteById } from "@/lib/websites/repository";
import type { SiteInterpretationFields, SiteModelRecord } from "./types";
import { loadOrCreateSiteModel } from "./load-for-website";
import { confirmSiteModelRow } from "./repository";
import { normalizeInterpretationFields } from "./interpretation/parse";

export async function confirmWebsiteSiteModel(input: {
  websiteId: string;
  fields: SiteInterpretationFields;
}): Promise<SiteModelRecord> {
  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  const latestUsable = await findLatestUsableCrawlRun(input.websiteId);
  if (!latestUsable) {
    throw new Error("No completed crawl is available to confirm.");
  }

  const siteModel = await loadOrCreateSiteModel({
    website,
    crawlRun: latestUsable,
  });

  if (!siteModel) {
    throw new Error("Site model is not available yet.");
  }

  const fields = normalizeInterpretationFields(input.fields);
  if (!fields.siteDescription) {
    throw new Error("A short description is required to confirm this site.");
  }

  const now = new Date().toISOString();
  const source = siteModel.interpretation;

  return confirmSiteModelRow({
    id: siteModel.id,
    confirmed: {
      confirmedAt: now,
      sourceInterpretationGeneratedAt: source?.generatedAt ?? now,
      sourceGenerator: source?.generator ?? "heuristic",
      evidenceHash: source?.evidenceHash ?? siteModel.evidence.crawlRunId,
      sourceCrawlRunId: siteModel.sourceCrawlRunId,
      siteDescription: fields.siteDescription,
      offers: fields.offers,
      audiences: fields.audiences,
      locations: fields.locations,
    },
  });
}
