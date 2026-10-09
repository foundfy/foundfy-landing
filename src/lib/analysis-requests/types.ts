export const ANALYSIS_REQUEST_STATUSES = [
  "requested",
  "running",
  "analyzed",
  "fetch_failed",
  "blocked",
] as const;

export type AnalysisRequestStatus = (typeof ANALYSIS_REQUEST_STATUSES)[number];

export const ANALYSIS_REQUEST_FAILURE_REASONS = [
  "scan_already_running",
  "google_disconnected",
  "fetch_failed",
] as const;

export type AnalysisRequestFailureReason = (typeof ANALYSIS_REQUEST_FAILURE_REASONS)[number];

export type AnalysisRequestRecord = {
  id: string;
  websiteId: string;
  decisionId: string | null;
  decisionRunId: string | null;
  gscSyncId: string | null;
  requestedUrl: string;
  requestedUrlKey: string;
  requestedBy: string;
  requestedAt: string;
  crawlRunId: string | null;
  resultPageId: string | null;
  status: AnalysisRequestStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisRequestView = {
  id: string;
  decisionId: string | null;
  requestedUrl: string;
  crawlRunId: string | null;
  resultPageId: string | null;
  status: AnalysisRequestStatus;
  failureReason: string | null;
  requestedAt: string;
};

export type AnalysisRequestErrorCode =
  | "decision_stale"
  | "unsupported_decision"
  | "invalid_url"
  | "missing_gsc_evidence"
  | "not_found";

export class AnalysisRequestError extends Error {
  readonly code: AnalysisRequestErrorCode;
  readonly status: number;

  constructor(code: AnalysisRequestErrorCode, message: string, status = 409) {
    super(message);
    this.name = "AnalysisRequestError";
    this.code = code;
    this.status = status;
  }
}
