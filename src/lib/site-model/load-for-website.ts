import type { WebsiteCrawlRunRecord, WebsiteRecord } from "@/lib/websites/types";
import { buildSiteModelEvidence, deriveSiteModelUnderstanding } from "./derive";
import { buildHeuristicSiteInterpretation } from "./interpretation/heuristic";
import { hashSiteInterpretationEvidence } from "./interpretation/hash";
import { parseSiteInterpretationDraft } from "./interpretation/parse";
import {
  findLatestConfirmedSiteModelForWebsite,
  findSiteModelForCrawl,
  insertSiteModel,
  loadSiteModelEvidence,
  markSiteModelStale,
  updateDraftInterpretation,
  updateDraftSiteModel,
} from "./repository";
import {
  SITE_MODEL_DERIVATION_VERSION,
  SITE_MODEL_ROW_VERSION,
  type SiteModelRecord,
  type SiteModelUnderstanding,
} from "./types";

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && /duplicate key|site_models_website_crawl_unique/i.test(error.message);
}

function hasInterpretableUnderstanding(
  understanding: SiteModelUnderstanding,
): boolean {
  return Array.isArray(understanding.pages) && typeof understanding.hostname === "string";
}

async function ensureDraftInterpretation(
  model: SiteModelRecord,
): Promise<SiteModelRecord> {
  if (model.status !== "draft" || !hasInterpretableUnderstanding(model.understanding)) {
    return model;
  }

  const evidenceHash = hashSiteInterpretationEvidence({
    understanding: model.understanding,
    evidence: model.evidence,
  });
  const existing = parseSiteInterpretationDraft(model.interpretation);
  if (
    existing &&
    existing.status === "ready" &&
    existing.evidenceHash === evidenceHash
  ) {
    return model;
  }

  const interpretation = buildHeuristicSiteInterpretation({
    understanding: model.understanding,
    evidence: model.evidence,
  });

  try {
    return await updateDraftInterpretation({
      id: model.id,
      interpretation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save site interpretation.";
    console.error("[Site Interpretation] Failed to persist heuristic draft:", message);
    return {
      ...model,
      interpretation,
    };
  }
}

export async function loadOrCreateSiteModel(input: {
  website: WebsiteRecord;
  crawlRun: WebsiteCrawlRunRecord;
}): Promise<SiteModelRecord | null> {
  const existing = await findSiteModelForCrawl(input.website.id, input.crawlRun.id);
  const evidenceBundle = await loadSiteModelEvidence(input.crawlRun.id);

  if (!evidenceBundle) {
    return existing;
  }

  const understanding = deriveSiteModelUnderstanding({
    crawl: {
      id: evidenceBundle.crawl.id,
      websiteId: evidenceBundle.crawl.website_id,
      hostname: input.website.hostname,
      seedUrl: evidenceBundle.crawl.seed_url,
      pagesCrawled: evidenceBundle.crawl.pages_crawled,
      pagesDiscovered: evidenceBundle.crawl.pages_discovered,
      maxPages: evidenceBundle.crawl.max_pages,
    },
    pages: evidenceBundle.pages,
    artifacts: evidenceBundle.artifacts,
  });

  const evidence = buildSiteModelEvidence({
    websiteId: input.website.id,
    crawlRunId: input.crawlRun.id,
    pages: evidenceBundle.pages,
    artifacts: evidenceBundle.artifacts,
  });

  let materialized: SiteModelRecord | null = existing;

  if (existing) {
    const existingVersion = existing.understanding.derivationVersion ?? 0;
    if (existing.status === "draft" && existingVersion !== SITE_MODEL_DERIVATION_VERSION) {
      materialized = await updateDraftSiteModel({
        id: existing.id,
        understanding,
        evidence,
      });
    }
  } else {
    try {
      materialized = await insertSiteModel({
        websiteId: input.website.id,
        sourceCrawlRunId: input.crawlRun.id,
        version: SITE_MODEL_ROW_VERSION,
        status: "draft",
        understanding,
        evidence,
      });
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }

      materialized = await findSiteModelForCrawl(input.website.id, input.crawlRun.id);
    }
  }

  if (!materialized) {
    return null;
  }

  const confirmed = await findLatestConfirmedSiteModelForWebsite(input.website.id);
  if (confirmed && confirmed.sourceCrawlRunId !== input.crawlRun.id) {
    if (confirmed.status === "confirmed") {
      return (await markSiteModelStale(confirmed.id)) ?? confirmed;
    }

    return confirmed;
  }

  return ensureDraftInterpretation(materialized);
}
