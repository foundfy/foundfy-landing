import type { ResearchGateCode } from "./types";

export class ResearchGateError extends Error {
  readonly code: ResearchGateCode;
  readonly status: number;

  constructor(code: ResearchGateCode, message: string, status = 409) {
    super(message);
    this.name = "ResearchGateError";
    this.code = code;
    this.status = status;
  }
}

export const RESEARCH_PROVIDER_ERROR_CODES = [
  "timeout",
  "rate_limited",
  "server_error",
  "invalid_response",
  "unauthorized",
  "host_rejected",
  "live_not_enabled",
  "credentials_missing",
  "provider_disabled",
] as const;

export type ResearchProviderErrorCode = (typeof RESEARCH_PROVIDER_ERROR_CODES)[number];

export class ResearchProviderError extends Error {
  readonly code: ResearchProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ResearchProviderErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "ResearchProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
