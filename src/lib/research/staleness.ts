import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import type { ResearchRunRecord, ResearchStaleReason } from "./types";

export function researchStaleReasons(input: {
  run: ResearchRunRecord;
  confirmedAt: string | null;
  confirmedOffers: string[];
  latestCompatibleRunId: string | null;
  now?: Date;
}): ResearchStaleReason[] {
  const reasons: ResearchStaleReason[] = [];
  const now = input.now ?? new Date();
  const retrieved = Date.parse(input.run.completedAt ?? input.run.createdAt);
  if (Number.isFinite(retrieved) && now.getTime() - retrieved > RESEARCH_REUSE_WINDOW_MS) {
    reasons.push("older_than_30_days");
  }

  if (!input.confirmedAt || input.confirmedAt !== input.run.siteModelConfirmedAt) {
    reasons.push("business_context_changed");
  }

  const currentOffers = new Set(input.confirmedOffers);
  if (input.run.offeringSeeds.some((seed) => !currentOffers.has(seed))) {
    reasons.push("offerings_changed");
  }

  if (input.latestCompatibleRunId && input.latestCompatibleRunId !== input.run.id) {
    reasons.push("superseded");
  }

  return reasons;
}

export function isReusableCompletedRun(input: {
  run: ResearchRunRecord;
  fingerprint: string;
  now?: Date;
}): boolean {
  if (input.run.status !== "completed") {
    return false;
  }

  if (input.run.requestFingerprint !== input.fingerprint) {
    return false;
  }

  const completedAt = input.run.completedAt ? Date.parse(input.run.completedAt) : Number.NaN;
  if (!Number.isFinite(completedAt)) {
    return false;
  }

  const now = input.now ?? new Date();
  return now.getTime() - completedAt < RESEARCH_REUSE_WINDOW_MS;
}
