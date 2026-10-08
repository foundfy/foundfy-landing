import { deleteDecisionEngineForWebsite } from "@/lib/decisions/db";
import { deleteSearchAnalyticsForWebsite } from "@/lib/gsc/db-search";
import {
  deleteActionLearningSnapshotsForWebsite,
  deleteOpenActionsForWebsite,
  scrubGoogleMetricsFromActionEvidence,
} from "./db";
import { scrubGoogleMetricsFromReviewEvidence } from "./review-db";

/**
 * Disconnect / property-change policy:
 * - Delete derived next actions (open prepared/awaiting_approval/approved).
 * - Delete Google-derived LEARN snapshots and GSC evidence.
 * - Scrub Google metrics copied onto remaining action evidence refs.
 * - Keep executed/verified/blocked/cancelled ACT history without Google numbers.
 * - Keep canonical reviews; SET NULL GSC FKs and scrub copied Google metrics.
 */
export async function removeGoogleDerivedOwnerDataForWebsite(websiteId: string): Promise<void> {
  await deleteOpenActionsForWebsite(websiteId);
  await deleteActionLearningSnapshotsForWebsite(websiteId);
  await scrubGoogleMetricsFromActionEvidence(websiteId);
  await scrubGoogleMetricsFromReviewEvidence(websiteId);
  await deleteDecisionEngineForWebsite(websiteId);
  await deleteSearchAnalyticsForWebsite(websiteId);
}
