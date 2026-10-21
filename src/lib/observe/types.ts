export const TARGETED_OBSERVATION_STATUSES = [
  "running",
  "analyzed",
  "fetch_failed",
] as const;

export type TargetedObservationStatus = (typeof TARGETED_OBSERVATION_STATUSES)[number];

export const TARGETED_OBSERVATION_SELECTION_MODES = [
  "owner_selected",
  "auto_candidate",
] as const;

export type TargetedObservationSelectionMode =
  (typeof TARGETED_OBSERVATION_SELECTION_MODES)[number];

export type TargetedObservation = {
  id: string;
  websiteId: string;
  requestedUrl: string;
  requestedUrlKey: string;
  sourceCrawlRunId: string;
  sourceQueueId: string;
  sourceInspectRunId: string;
  sourceResearchIdeaId: string;
  targetedCrawlRunId: string;
  resultPageId: string | null;
  requestedBy: string;
  selectionMode: TargetedObservationSelectionMode;
  status: TargetedObservationStatus;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
};

export const OBSERVE_CANDIDATE_RANK_CLASSES = [
  "exact_phrase",
  "exact_compact",
  "exact_tokens",
  "seed_offering",
  "incoming_anchor",
] as const;

export type ObserveCandidateRankClass = (typeof OBSERVE_CANDIDATE_RANK_CLASSES)[number];

export type ObserveCandidate = {
  queueItemId: string;
  url: string;
  urlKey: string;
  reasonCopy: string;
  rankClass: ObserveCandidateRankClass;
  gscSupport: boolean;
};

export const CLAIM_TARGETED_OBSERVATION_STATUSES = [
  "stale_source",
  "reused",
  "already_running",
  "claimed",
] as const;

export type ClaimTargetedObservationStatus =
  (typeof CLAIM_TARGETED_OBSERVATION_STATUSES)[number];

export type ClaimTargetedObservationResult =
  | { status: "stale_source" }
  | {
      status: "reused";
      observationId: string;
      targetedCrawlRunId: string;
      startedAt: string;
      completedAt: string;
    }
  | {
      status: "already_running";
      observationId: string;
      targetedCrawlRunId: string;
      startedAt: string;
    }
  | {
      status: "claimed";
      observationId: string;
      targetedCrawlRunId: string;
      startedAt: string;
    };

export type FinalizeTargetedObservationResult =
  | {
      status: "analyzed";
      observationId: string;
      targetedCrawlRunId: string;
      resultPageId: string;
      completedAt: string;
    }
  | {
      status: "fetch_failed";
      observationId: string;
      targetedCrawlRunId: string;
      failureReason: string;
      completedAt: string;
    };

export const OBSERVE_STALE_RUNNING_MS = 120_000;

export type ObserveCandidatesView =
  | { status: "stale_source"; copy: string }
  | { status: "t0_not_eligible"; copy: string }
  | { status: "already_running"; copy: string; observation: TargetedObservation }
  | {
      status: "observed";
      copy: string;
      observation: TargetedObservation;
    }
  | {
      status: "candidates";
      copy: string | null;
      candidates: ObserveCandidate[];
    };
