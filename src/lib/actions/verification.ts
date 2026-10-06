import { SUPPORTED_ACTION_RULE_KEY } from "@/lib/decisions/supported-action";
import { metaValuesEqual, normalizeMetaDescription } from "./meta";
import type { ActionVerificationStatus } from "./types";

export type VerificationPageEvidence = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  metaDescription: string | null;
};

export type VerificationObservationEvidence = {
  id: string;
  pageId: string | null;
  ruleKey: string;
  status: string;
};

export function pageUrlsEquivalent(left: string, right: string): boolean {
  return pageUrlKey(left) !== null && pageUrlKey(left) === pageUrlKey(right);
}

export function pageUrlKey(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.trim().toLowerCase().replace(/^www\./, "");
  if (!host) {
    return null;
  }

  const pathname = parsed.pathname === "" || parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "") || "/";
  return `https://${host}${pathname}${parsed.search}`;
}

export function pageWasFetchedSuccessfully(statusCode: number | null): boolean {
  return statusCode != null && statusCode >= 200 && statusCode < 400;
}

export function evaluateMetaDescriptionVerification(input: {
  expectedValue: string | null;
  page: VerificationPageEvidence | null;
  missingMetaObservation: VerificationObservationEvidence | null;
}): {
  status: ActionVerificationStatus;
  observedValue: string | null;
  missingMetaPresent: boolean;
} {
  const observedValue = normalizeMetaDescription(input.page?.metaDescription);
  const missingMetaPresent = Boolean(
    input.missingMetaObservation &&
      input.missingMetaObservation.status === "active" &&
      input.missingMetaObservation.ruleKey === SUPPORTED_ACTION_RULE_KEY,
  );

  if (!input.page || !pageWasFetchedSuccessfully(input.page.statusCode)) {
    return { status: "inconclusive", observedValue, missingMetaPresent };
  }

  if (!metaValuesEqual(observedValue, input.expectedValue) || missingMetaPresent) {
    return { status: "not_verified", observedValue, missingMetaPresent };
  }

  return { status: "verified", observedValue, missingMetaPresent };
}
