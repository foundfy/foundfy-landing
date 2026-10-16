import type { RelatedDemandInspectionView } from "@/lib/decisions/inspect-display";
import type { ResearchFilterReasonCounts } from "./filter-reasons";

export type { ResearchFilterReasonCounts };

export const RESEARCH_PROVIDER_MODES = ["disabled", "fixture", "sandbox", "live"] as const;
export type ResearchProviderMode = (typeof RESEARCH_PROVIDER_MODES)[number];

export const RESEARCH_PROVIDER_ENVIRONMENTS = ["fixture", "sandbox", "live"] as const;
export type ResearchProviderEnvironment = (typeof RESEARCH_PROVIDER_ENVIRONMENTS)[number];

export const RESEARCH_PROVIDERS = ["fixture", "dataforseo"] as const;
export type ResearchProviderId = (typeof RESEARCH_PROVIDERS)[number];

export const RESEARCH_RUN_STATUSES = [
  "requested",
  "running",
  "completed",
  "partial",
  "failed",
  "interrupted",
  "closed",
] as const;
export type ResearchRunStatus = (typeof RESEARCH_RUN_STATUSES)[number];

export const RESEARCH_REQUEST_STATUSES = [
  "pending",
  "in_flight",
  "succeeded",
  "zero_results",
  "failed",
  "timeout",
  "rate_limited",
  "skipped",
] as const;
export type ResearchRequestStatus = (typeof RESEARCH_REQUEST_STATUSES)[number];

export const INITIAL_GSC_SAMPLE_STATUSES = [
  "in_current_gsc_sample",
  "not_in_current_gsc_sample",
] as const;
export type InitialGscSampleStatus = (typeof INITIAL_GSC_SAMPLE_STATUSES)[number];

export const CURRENT_GSC_SAMPLE_STATUSES = [
  "in_current_gsc_sample",
  "not_in_current_gsc_sample",
  "gsc_unavailable",
] as const;
export type CurrentGscSampleStatus = (typeof CURRENT_GSC_SAMPLE_STATUSES)[number];

export const RESEARCH_STALE_REASONS = [
  "older_than_30_days",
  "business_context_changed",
  "offerings_changed",
  "superseded",
] as const;
export type ResearchStaleReason = (typeof RESEARCH_STALE_REASONS)[number];

export type ResearchCountry = {
  key: string;
  name: string;
  locationCode: number;
};

export type ResearchLanguage = {
  code: string;
  name: string;
};

export type ResearchEmptyOutcome = "unknown" | "provider_empty" | "filtered_all";

export type ResearchRequestLedgerEntry = {
  requestKey: string;
  seedOffering: string;
  languageCode: string;
  locationCode: number;
  providerTaskId: string | null;
  status: ResearchRequestStatus;
  requestedAt: string;
  attemptedAt: string | null;
  retrievedAt: string | null;
  ideaCount: number;
  providerResultCount: number | null;
  filterReasonCounts: ResearchFilterReasonCounts | null;
  providerCost: number | null;
  failureCode: string | null;
};

export type ResearchIdeaRecord = {
  id: string;
  runId: string;
  websiteId: string;
  seedOffering: string;
  languageCode: string;
  providerTaskId: string | null;
  keyword: string;
  compactKey: string;
  estimatedMonthlySearches: number | null;
  providerResultOrder: number;
  initialGscSampleStatus: InitialGscSampleStatus;
  requestKey: string;
  createdAt: string;
};

export type ResearchClaimOutcome =
  | "reuse_completed"
  | "reuse_active"
  | "block_retry"
  | "recovery_required"
  | "claimed";

export type ResearchRecoveryOutcome =
  | "claimed_recovery"
  | "recovery_busy"
  | "not_recoverable"
  | "not_found";

export type ResearchFenceOutcome =
  | "claimed"
  | "persisted"
  | "finalized"
  | "superseded"
  | "already_attempted"
  | "missing_request"
  | "invalid_state";

export type ResearchCloseOutcome =
  | "closed"
  | "already_closed"
  | "not_closeable"
  | "recovery_busy"
  | "not_found";

export type ResearchClaimResult = {
  kind: ResearchClaimOutcome;
  run: ResearchRunRecord;
};

export type ResearchRunRecord = {
  id: string;
  websiteId: string;
  siteModelId: string | null;
  siteModelConfirmedAt: string;
  requestedBy: string | null;
  gscSyncId: string | null;
  gscQueriesTruncated: boolean;
  countryKey: string;
  countryName: string;
  locationCode: number;
  languageCodes: string[];
  offeringSeeds: string[];
  provider: ResearchProviderId;
  providerEnvironment: ResearchProviderEnvironment;
  status: ResearchRunStatus;
  requestFingerprint: string;
  requestLedger: ResearchRequestLedgerEntry[];
  providerCost: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lastProgressAt: string | null;
  executionGeneration: number;
  closedAt: string | null;
};

export type ResearchRecoveryResult = {
  kind: ResearchRecoveryOutcome;
  run: ResearchRunRecord | null;
};

export type ResearchIdeaView = {
  id: string;
  keyword: string;
  estimatedMonthlySearches: number | null;
  seedOffering: string;
  languageCode: string;
  countryKey: string;
  countryName: string;
  retrievedAt: string;
  initialGscSampleStatus: InitialGscSampleStatus;
  currentGscSampleStatus: CurrentGscSampleStatus;
  canInspect: boolean;
  inspection: RelatedDemandInspectionView | null;
};

export type ResearchRunView = {
  id: string;
  status: ResearchRunStatus;
  stale: boolean;
  staleReasons: ResearchStaleReason[];
  providerEnvironment: ResearchProviderEnvironment;
  isTestData: boolean;
  countryKey: string;
  countryName: string;
  languageCodes: string[];
  offeringSeeds: string[];
  retrievedAt: string;
  gscQueriesTruncatedAtRetrieval: boolean;
  currentGscQueriesTruncated: boolean;
  incomplete: boolean;
  recoveryRequired: boolean;
  canResumeUnattempted: boolean;
  safeUnattemptedCount: number;
  displayInterrupted: boolean;
  displayClosed: boolean;
  canClose: boolean;
  canStartNewCycle: boolean;
  emptyOutcome: ResearchEmptyOutcome | null;
  reviewedKeptCopy: string | null;
  filterReasonDetails: string[];
  ideas: ResearchIdeaView[];
};

export type ResearchGateCode =
  | "no_confirmed_site_model"
  | "no_valid_offering"
  | "invalid_offering_selection"
  | "offering_selection_required"
  | "no_research_country"
  | "invalid_country"
  | "no_research_language"
  | "unsupported_language"
  | "no_gsc_sync"
  | "provider_disabled"
  | "live_not_enabled"
  | "credentials_missing"
  | "request_cap_exceeded"
  | "retry_not_safe"
  | "recovery_busy"
  | "not_recoverable"
  | "execution_superseded"
  | "already_closed"
  | "not_closeable";

export type ResearchGate = {
  code: ResearchGateCode;
  message: string;
};

export type ResearchReadinessView = {
  gate: ResearchGate | null;
  executionAvailable: boolean;
  surfaceVisible: boolean;
  providerMode: ResearchProviderMode;
  requiresOfferingSelection: boolean;
  validOfferings: string[];
  countries: Array<{ key: string; name: string }>;
  languages: ResearchLanguage[];
  understandingHref: string;
};

export type ResearchOwnerView = {
  readiness: ResearchReadinessView;
  run: ResearchRunView | null;
};
