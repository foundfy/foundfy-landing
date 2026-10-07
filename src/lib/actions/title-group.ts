import {
  DUPLICATE_TITLE_RULE_KEY,
  TITLE_PRIMARY_REASON,
} from "@/lib/decisions/supported-action";
import type { DecisionEvidenceRef, DecisionRecord } from "@/lib/decisions/types";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import type { ActionObservationSnapshot } from "./db";

export function titlePrimaryPage(
  decision: Pick<DecisionRecord, "pageId" | "pageUrl">,
): { pageId: string; pageUrl: string } | null {
  if (!decision.pageId || !decision.pageUrl) {
    return null;
  }

  return { pageId: decision.pageId, pageUrl: decision.pageUrl };
}

function urlKey(raw: string | null | undefined): string | null {
  return raw ? pageComparisonKey(raw) : null;
}

function collectMemberUrls(observations: ActionObservationSnapshot[]): string[] {
  const urls: string[] = [];
  for (const observation of observations) {
    const duplicatePages = observation.evidence.duplicatePages;
    if (!Array.isArray(duplicatePages)) {
      continue;
    }
    for (const value of duplicatePages) {
      if (typeof value === "string" && value.trim()) {
        urls.push(value);
      }
    }
  }
  return urls;
}

export function otherDuplicateMemberUrls(input: {
  targetUrl: string;
  observations: ActionObservationSnapshot[];
  evidenceRefs: DecisionEvidenceRef[];
}): string[] {
  const targetKey = urlKey(input.targetUrl);
  const seen = new Set<string>();
  const others: string[] = [];

  const candidates = [
    ...collectMemberUrls(input.observations),
    ...input.evidenceRefs
      .filter((ref) => ref.kind === "page")
      .map((ref) => (typeof ref.snapshot.pageUrl === "string" ? ref.snapshot.pageUrl : "")),
  ];

  for (const candidate of candidates) {
    const key = urlKey(candidate);
    if (!key || key === targetKey || seen.has(key)) {
      continue;
    }
    seen.add(key);
    others.push(candidate);
  }

  return others;
}

export function sharedTitleFromEvidence(
  observations: ActionObservationSnapshot[],
  fallback: string | null,
): string | null {
  for (const observation of observations) {
    if (observation.ruleKey !== DUPLICATE_TITLE_RULE_KEY) {
      continue;
    }
    if (typeof observation.evidence.title === "string" && observation.evidence.title.trim()) {
      return observation.evidence.title;
    }
  }
  return fallback;
}

export function freezeTitleGroupEvidence(input: {
  evidenceRefs: DecisionEvidenceRef[];
  targetPageId: string;
  targetUrl: string;
  sharedTitle: string | null;
  otherMemberUrls: string[];
  group: boolean;
}): DecisionEvidenceRef[] {
  return input.evidenceRefs.map((ref) => {
    if (ref.kind !== "page" || ref.recordId !== input.targetPageId) {
      return ref;
    }

    return {
      ...ref,
      snapshot: {
        ...ref.snapshot,
        pageUrl: input.targetUrl,
        sharedTitle: input.sharedTitle,
        otherMemberUrls: input.otherMemberUrls,
        primaryReason: input.group ? TITLE_PRIMARY_REASON : null,
      },
    };
  });
}

export function titleGroupContextFromAction(evidenceRefs: Array<{ kind: string; snapshot: Record<string, unknown> }>): {
  sharedTitle: string | null;
  otherMemberUrls: string[];
  primaryReason: string | null;
} | null {
  const pageRef = evidenceRefs.find((ref) => ref.kind === "page");
  if (!pageRef) {
    return null;
  }

  const otherMemberUrls = Array.isArray(pageRef.snapshot.otherMemberUrls)
    ? pageRef.snapshot.otherMemberUrls.filter((value): value is string => typeof value === "string")
    : [];
  const sharedTitle =
    typeof pageRef.snapshot.sharedTitle === "string" ? pageRef.snapshot.sharedTitle : null;
  const primaryReason =
    typeof pageRef.snapshot.primaryReason === "string" ? pageRef.snapshot.primaryReason : null;

  if (!sharedTitle && otherMemberUrls.length === 0) {
    return null;
  }

  return { sharedTitle, otherMemberUrls, primaryReason };
}
