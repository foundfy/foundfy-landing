import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { CanonicalReviewEvidenceRef, CanonicalReviewRecord } from "./review-types";
import type { CanonicalReviewObservation, CanonicalReviewPage } from "./review-identity";

type ReviewRow = {
  id: string;
  website_id: string;
  review_type: CanonicalReviewRecord["reviewType"];
  outcome: CanonicalReviewRecord["outcome"];
  owner_id: string;
  reviewed_at: string;
  decision_id: string | null;
  decision_run_id: string | null;
  observation_id: string;
  page_id: string | null;
  crawl_run_id: string;
  gsc_sync_id: string | null;
  site_model_id: string;
  goal_id: string;
  requested_url: string;
  final_url: string;
  canonical_url: string;
  page_url: string;
  created_at: string;
};

const REVIEW_COLUMNS =
  "id, website_id, review_type, outcome, owner_id, reviewed_at, decision_id, decision_run_id, observation_id, page_id, crawl_run_id, gsc_sync_id, site_model_id, goal_id, requested_url, final_url, canonical_url, page_url, created_at";

function mapReview(row: ReviewRow, evidenceRefs: CanonicalReviewEvidenceRef[]): CanonicalReviewRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    reviewType: row.review_type,
    outcome: row.outcome,
    ownerId: row.owner_id,
    reviewedAt: row.reviewed_at,
    decisionId: row.decision_id,
    decisionRunId: row.decision_run_id,
    observationId: row.observation_id,
    pageId: row.page_id,
    crawlRunId: row.crawl_run_id,
    gscSyncId: row.gsc_sync_id,
    siteModelId: row.site_model_id,
    goalId: row.goal_id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    canonicalUrl: row.canonical_url,
    pageUrl: row.page_url,
    createdAt: row.created_at,
    evidenceRefs,
  };
}

async function loadReviewEvidenceRefs(
  reviewIds: string[],
): Promise<Map<string, CanonicalReviewEvidenceRef[]>> {
  const refsByReview = new Map<string, CanonicalReviewEvidenceRef[]>();
  if (reviewIds.length === 0) {
    return refsByReview;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_review_evidence_refs")
    .select("review_id, kind, record_id, snapshot")
    .in("review_id", reviewIds);

  if (error) {
    throw new Error(`Failed to load review evidence: ${error.message}`);
  }

  for (const ref of data ?? []) {
    const list = refsByReview.get(ref.review_id) ?? [];
    list.push({
      kind: ref.kind,
      recordId: ref.record_id,
      snapshot: (ref.snapshot ?? {}) as Record<string, unknown>,
    });
    refsByReview.set(ref.review_id, list);
  }

  return refsByReview;
}

export async function findCanonicalReviewObservation(
  observationId: string,
): Promise<CanonicalReviewObservation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("observations")
    .select("id, page_id, page_url, crawl_run_id, rule_key, status, evidence")
    .eq("id", observationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load observation for review: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    pageId: data.page_id,
    pageUrl: data.page_url,
    crawlRunId: data.crawl_run_id,
    ruleKey: data.rule_key,
    status: data.status,
    evidence: (data.evidence ?? {}) as Record<string, unknown>,
  };
}

export async function findCanonicalReviewPage(pageId: string): Promise<CanonicalReviewPage | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, crawl_run_id, requested_url, final_url, canonical")
    .eq("id", pageId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load page for review: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    crawlRunId: data.crawl_run_id,
    requestedUrl: data.requested_url,
    finalUrl: data.final_url,
    canonical: data.canonical,
  };
}

export async function insertCanonicalReview(input: {
  websiteId: string;
  ownerId: string;
  decisionId: string;
  decisionRunId: string;
  observationId: string;
  pageId: string | null;
  crawlRunId: string;
  gscSyncId: string | null;
  siteModelId: string;
  goalId: string;
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  pageUrl: string;
  outcome: CanonicalReviewRecord["outcome"];
  evidenceRefs: CanonicalReviewEvidenceRef[];
}): Promise<CanonicalReviewRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_reviews")
    .insert({
      website_id: input.websiteId,
      review_type: "review_canonical_target",
      outcome: input.outcome,
      owner_id: input.ownerId,
      decision_id: input.decisionId,
      decision_run_id: input.decisionRunId,
      observation_id: input.observationId,
      page_id: input.pageId,
      crawl_run_id: input.crawlRunId,
      gsc_sync_id: input.gscSyncId,
      site_model_id: input.siteModelId,
      goal_id: input.goalId,
      requested_url: input.requestedUrl,
      final_url: input.finalUrl,
      canonical_url: input.canonicalUrl,
      page_url: input.pageUrl,
    })
    .select(REVIEW_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to record canonical review: ${error?.message ?? "unknown error"}`);
  }

  const row = data as ReviewRow;
  if (input.evidenceRefs.length > 0) {
    const { error: refError } = await supabase.from("action_review_evidence_refs").insert(
      input.evidenceRefs.map((ref) => ({
        review_id: row.id,
        kind: ref.kind,
        record_id: ref.recordId,
        snapshot: ref.snapshot,
      })),
    );

    if (refError) {
      throw new Error(`Failed to store review evidence: ${refError.message}`);
    }
  }

  return mapReview(row, input.evidenceRefs);
}

export async function listCanonicalReviewsForWebsite(websiteId: string): Promise<CanonicalReviewRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_reviews")
    .select(REVIEW_COLUMNS)
    .eq("website_id", websiteId)
    .order("reviewed_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list canonical reviews: ${error.message}`);
  }

  const rows = (data ?? []) as ReviewRow[];
  const refs = await loadReviewEvidenceRefs(rows.map((row) => row.id));
  return rows.map((row) => mapReview(row, refs.get(row.id) ?? []));
}

export async function scrubGoogleMetricsFromReviewEvidence(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_reviews")
    .select("id")
    .eq("website_id", websiteId);

  if (error) {
    throw new Error(`Failed to load reviews for Google-metric cleanup: ${error.message}`);
  }

  const reviewIds = (data ?? []).map((row) => row.id as string);
  if (reviewIds.length === 0) {
    return;
  }

  const { error: refError } = await supabase
    .from("action_review_evidence_refs")
    .update({ snapshot: {} })
    .in("review_id", reviewIds)
    .in("kind", ["gsc_evidence", "gsc_sync"]);

  if (refError) {
    throw new Error(`Failed to remove Google metrics from review evidence: ${refError.message}`);
  }

  const { error: syncError } = await supabase
    .from("action_reviews")
    .update({ gsc_sync_id: null })
    .eq("website_id", websiteId);

  if (syncError) {
    throw new Error(`Failed to disconnect review GSC provenance: ${syncError.message}`);
  }
}
