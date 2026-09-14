import type { WebsiteCrawlRunRecord, WebsiteRecord } from "@/lib/websites/types";
import { buildSiteModelEvidence, deriveSiteModelUnderstanding } from "./derive";
import {
  findSiteModelForCrawl,
  insertSiteModel,
  loadSiteModelEvidence,
  updateDraftSiteModel,
} from "./repository";
import {
  SITE_MODEL_DERIVATION_VERSION,
  SITE_MODEL_ROW_VERSION,
  type SiteModelRecord,
} from "./types";

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && /duplicate key|site_models_website_crawl_unique/i.test(error.message);
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

  if (existing) {
    const existingVersion =
      existing.understanding.derivationVersion ?? 0;
    if (
      existing.status !== "draft" ||
      existingVersion === SITE_MODEL_DERIVATION_VERSION
    ) {
      return existing;
    }

    return updateDraftSiteModel({
      id: existing.id,
      understanding,
      evidence,
    });
  }

  try {
    return await insertSiteModel({
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

    return findSiteModelForCrawl(input.website.id, input.crawlRun.id);
  }
}
