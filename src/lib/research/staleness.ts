import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import type { ResearchRunRecord, ResearchStaleReason } from "./types";

const UTC_INSTANT =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseResearchUtcMs(value: string | null | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!UTC_INSTANT.test(trimmed)) {
    return null;
  }

  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

export function sameResearchUtcInstant(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftMs = parseResearchUtcMs(left);
  const rightMs = parseResearchUtcMs(right);
  if (leftMs == null || rightMs == null) {
    return false;
  }

  return leftMs === rightMs;
}

function completedAtMs(run: ResearchRunRecord): number {
  return run.completedAt ? Date.parse(run.completedAt) : Number.NaN;
}

function createdAtMs(run: ResearchRunRecord): number {
  return Date.parse(run.createdAt);
}

export function compareResearchRunsNewestFirst(
  left: ResearchRunRecord,
  right: ResearchRunRecord,
): number {
  const completedDelta = completedAtMs(right) - completedAtMs(left);
  if (completedDelta !== 0 && Number.isFinite(completedDelta)) {
    return completedDelta;
  }

  const leftCompleted = completedAtMs(left);
  const rightCompleted = completedAtMs(right);
  if (Number.isFinite(rightCompleted) !== Number.isFinite(leftCompleted)) {
    return Number.isFinite(rightCompleted) ? 1 : -1;
  }

  const createdDelta = createdAtMs(right) - createdAtMs(left);
  if (createdDelta !== 0) {
    return createdDelta;
  }

  return right.id.localeCompare(left.id);
}

export function researchStaleReasons(input: {
  run: ResearchRunRecord;
  confirmedAt: string | null;
  confirmedOffers: string[];
  currentFingerprintRunId: string | null;
  now?: Date;
}): ResearchStaleReason[] {
  const reasons: ResearchStaleReason[] = [];
  const now = input.now ?? new Date();
  const retrieved = Date.parse(input.run.completedAt ?? input.run.createdAt);
  if (Number.isFinite(retrieved) && now.getTime() - retrieved > RESEARCH_REUSE_WINDOW_MS) {
    reasons.push("older_than_30_days");
  }

  if (!sameResearchUtcInstant(input.confirmedAt, input.run.siteModelConfirmedAt)) {
    reasons.push("business_context_changed");
  }

  const currentOffers = new Set(input.confirmedOffers);
  if (input.run.offeringSeeds.some((seed) => !currentOffers.has(seed))) {
    reasons.push("offerings_changed");
  }

  if (
    input.run.status === "completed" &&
    input.currentFingerprintRunId &&
    input.currentFingerprintRunId !== input.run.id
  ) {
    reasons.push("superseded");
  }

  return reasons;
}

export function isReadableCompletedRun(input: {
  run: ResearchRunRecord;
  fingerprint: string;
}): boolean {
  if (input.run.status !== "completed" || input.run.closedAt) {
    return false;
  }

  if (input.run.requestFingerprint !== input.fingerprint) {
    return false;
  }

  return Number.isFinite(completedAtMs(input.run));
}

export function isReusableCompletedRun(input: {
  run: ResearchRunRecord;
  fingerprint: string;
  now?: Date;
}): boolean {
  if (!isReadableCompletedRun(input)) {
    return false;
  }

  const now = input.now ?? new Date();
  return now.getTime() - completedAtMs(input.run) < RESEARCH_REUSE_WINDOW_MS;
}

export function currentCompletedRunForFingerprint(input: {
  runs: ResearchRunRecord[];
  fingerprint: string;
}): ResearchRunRecord | null {
  return (
    input.runs
      .filter((run) => isReadableCompletedRun({ run, fingerprint: input.fingerprint }))
      .sort(compareResearchRunsNewestFirst)[0] ?? null
  );
}

export function currentCompletedRunsByFingerprint(input: {
  runs: ResearchRunRecord[];
}): ResearchRunRecord[] {
  const fingerprints = [...new Set(input.runs.map((run) => run.requestFingerprint))];
  return fingerprints
    .map((fingerprint) => currentCompletedRunForFingerprint({ runs: input.runs, fingerprint }))
    .filter((run): run is ResearchRunRecord => run != null)
    .sort(compareResearchRunsNewestFirst);
}
