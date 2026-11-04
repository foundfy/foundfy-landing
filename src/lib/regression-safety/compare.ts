import { isUsableCompletedCrawl } from "@/lib/crawler/crawl-usability";
import {
  DEFAULT_PRESERVE_FIELDS,
  RELATED_DESCRIPTION_FIELDS,
  fieldValuesEqual,
  pageIdentityKey,
  unknownField,
} from "./observe";
import type {
  CrawlMetadataSnapshot,
  ExpectedFieldChange,
  FieldCheck,
  ManualSeoImprovementSpec,
  ObservedField,
  OriginalIssueStatus,
  PageMetadataEvidence,
  RegressionSafetyField,
  RegressionSafetyReport,
  RegressionSafetyVerdict,
  UrlMatch,
} from "./types";

function pageWasFetchedSuccessfully(statusCode: number | null): boolean {
  return statusCode != null && statusCode >= 200 && statusCode < 400;
}

function pageMatchesUrl(page: PageMetadataEvidence, url: string): boolean {
  const wanted = pageIdentityKey(url);
  if (!wanted) {
    return false;
  }

  return (
    pageIdentityKey(page.requestedUrl) === wanted ||
    pageIdentityKey(page.finalUrl) === wanted
  );
}

function findPage(
  snapshot: CrawlMetadataSnapshot,
  url: string,
): PageMetadataEvidence | null {
  return snapshot.pages.find((page) => pageMatchesUrl(page, url)) ?? null;
}

function findingOnUrl(
  snapshot: CrawlMetadataSnapshot,
  ruleKey: string,
  url: string,
): boolean {
  const wanted = pageIdentityKey(url);
  return (snapshot.findings ?? []).some((finding) => {
    if (finding.ruleKey !== ruleKey) {
      return false;
    }
    if (!finding.pageUrl) {
      return true;
    }
    return pageIdentityKey(finding.pageUrl) === wanted;
  });
}

function checkExpectedChange(input: {
  url: string;
  field: RegressionSafetyField;
  expectedAfter: string;
  before: ObservedField;
  after: ObservedField;
  role: FieldCheck["role"];
}): FieldCheck {
  const { url, field, expectedAfter, before, after, role } = input;

  if (after.presence === "unknown" || before.presence === "unknown") {
    return {
      url,
      field,
      role,
      outcome: "unknown",
      before,
      after,
      result: "not_verified",
      note: "Foundfy did not store this field in one of the compared scans.",
    };
  }

  if (after.presence === "absent") {
    return {
      url,
      field,
      role,
      outcome: "removed",
      before,
      after,
      result: "fail",
      note: "The expected value is missing after publication.",
    };
  }

  if (after.value !== expectedAfter) {
    return {
      url,
      field,
      role,
      outcome: "changed",
      before,
      after,
      result: "fail",
      note: "The published value does not match the approved change.",
    };
  }

  return {
    url,
    field,
    role,
    outcome: "changed",
    before,
    after,
    result: "pass",
    note: "The approved value is present after publication.",
  };
}

function checkPreservedField(input: {
  url: string;
  field: RegressionSafetyField;
  before: ObservedField;
  after: ObservedField;
}): FieldCheck | null {
  const { url, field, before, after } = input;

  if (before.presence === "unknown" || after.presence === "unknown") {
    if (before.presence === "unknown" && after.presence === "unknown") {
      return {
        url,
        field,
        role: "preserve",
        outcome: "unknown",
        before,
        after,
        result: "not_verified",
        note: "Foundfy did not collect this field in these scans, so it cannot confirm the value was preserved.",
      };
    }

    return {
      url,
      field,
      role: "preserve",
      outcome: "unknown",
      before,
      after,
      result: "not_verified",
      note: "One of the compared scans is missing this field.",
    };
  }

  if (before.presence !== "present") {
    return null;
  }

  if (after.presence === "absent") {
    return {
      url,
      field,
      role: "preserve",
      outcome: "removed",
      before,
      after,
      result: "fail",
      note: "This field was present before publication and is now absent.",
    };
  }

  if (!fieldValuesEqual(before, after)) {
    return {
      url,
      field,
      role: "preserve",
      outcome: "changed",
      before,
      after,
      result: "fail",
      note: "This field changed without an approved expected change.",
    };
  }

  return {
    url,
    field,
    role: "preserve",
    outcome: "unchanged",
    before,
    after,
    result: "pass",
    note: "This field was preserved.",
  };
}

function expectedChangeFor(
  expectedChanges: ExpectedFieldChange[],
  url: string,
  field: RegressionSafetyField,
): ExpectedFieldChange | undefined {
  const wanted = pageIdentityKey(url);
  return expectedChanges.find(
    (change) => pageIdentityKey(change.url) === wanted && change.field === field,
  );
}

function originalIssueStatus(
  spec: ManualSeoImprovementSpec,
): OriginalIssueStatus | null {
  if (!spec.originalFindingRuleKey) {
    return null;
  }

  if (!spec.baseline.findings || !spec.verification.findings) {
    return "not_verified";
  }

  const stillPresent = spec.urls.some((url) =>
    findingOnUrl(spec.verification, spec.originalFindingRuleKey!, url),
  );
  if (stillPresent) {
    return "still_present";
  }

  const wasPresent = spec.urls.some((url) =>
    findingOnUrl(spec.baseline, spec.originalFindingRuleKey!, url),
  );
  return wasPresent ? "resolved" : "not_verified";
}

function snapshotUsable(snapshot: CrawlMetadataSnapshot): boolean {
  return isUsableCompletedCrawl({
    status: snapshot.status,
    pagesCrawled: snapshot.pagesCrawled,
  });
}

export function evaluateManualSeoRegression(
  spec: ManualSeoImprovementSpec,
): RegressionSafetyReport {
  const limitations: string[] = [];
  const urls: UrlMatch[] = spec.urls.map((url) => ({ url, matched: true }));
  const emptyReport = (
    verdict: RegressionSafetyVerdict,
    summary: string,
    extraLimitations: string[] = [],
  ): RegressionSafetyReport => ({
    verdict,
    websiteId: spec.websiteId,
    urls: spec.urls.map((url) => ({ url, matched: false })),
    baselineCrawlId: spec.baseline.crawlRunId,
    baselineCompletedAt: spec.baseline.completedAt,
    verificationCrawlId: spec.verification.crawlRunId,
    verificationCompletedAt: spec.verification.completedAt,
    originalIssueStatus: spec.originalFindingRuleKey ? "not_verified" : null,
    checks: [],
    limitations: [...extraLimitations, ...limitations],
    summary,
  });

  if (
    spec.baseline.websiteId !== spec.websiteId ||
    spec.verification.websiteId !== spec.websiteId
  ) {
    return emptyReport(
      "not_verified",
      "Foundfy did not compare these scans because they do not belong to the same website.",
    );
  }

  if (!snapshotUsable(spec.baseline) || !snapshotUsable(spec.verification)) {
    return emptyReport(
      "not_verified",
      "Foundfy did not compare these scans because at least one crawl is incomplete.",
      ["Only completed crawls with fetched pages can be compared."],
    );
  }

  if (
    !spec.baseline.completedAt ||
    !spec.verification.completedAt ||
    spec.verification.completedAt <= spec.baseline.completedAt
  ) {
    return emptyReport(
      "not_verified",
      "Foundfy did not compare these scans because the baseline must complete before the verification crawl.",
    );
  }

  const preserveFields = spec.preserveFields ?? [...DEFAULT_PRESERVE_FIELDS];
  const checks: FieldCheck[] = [];

  // Every declared expected change must target one of the compared URLs;
  // otherwise it would be silently skipped and could not block PASS.
  const requestedUrlKeys = new Set(
    spec.urls
      .map((url) => pageIdentityKey(url))
      .filter((key): key is string => key != null),
  );
  const unscopedExpectedChanges = spec.expectedChanges.filter((change) => {
    const key = pageIdentityKey(change.url);
    return key == null || !requestedUrlKeys.has(key);
  });
  for (const change of unscopedExpectedChanges) {
    limitations.push(
      `Expected ${change.field} change for ${change.url} is not one of the compared URLs.`,
    );
  }
  if (spec.expectedChanges.length === 0) {
    limitations.push(
      "No expected change was declared, so Foundfy cannot verify an approved change.",
    );
  }

  for (const url of spec.urls) {
    const beforePage = findPage(spec.baseline, url);
    const afterPage = findPage(spec.verification, url);
    const match = urls.find((item) => item.url === url);
    if (!beforePage || !afterPage) {
      if (match) {
        match.matched = false;
      }
      limitations.push(`No matching page evidence for ${url}.`);
      continue;
    }

    if (
      !pageWasFetchedSuccessfully(beforePage.statusCode) ||
      !pageWasFetchedSuccessfully(afterPage.statusCode)
    ) {
      if (match) {
        match.matched = false;
      }
      limitations.push(`${url} was not fetched successfully in both scans.`);
      continue;
    }

    const expectedOnUrl = spec.expectedChanges.filter(
      (change) => pageIdentityKey(change.url) === pageIdentityKey(url),
    );

    for (const change of expectedOnUrl) {
      checks.push(
        checkExpectedChange({
          url,
          field: change.field,
          expectedAfter: change.after,
          before: beforePage.fields[change.field] ?? unknownField(),
          after: afterPage.fields[change.field] ?? unknownField(),
          role: "expected_change",
        }),
      );

      if (change.field === "meta_description") {
        for (const related of RELATED_DESCRIPTION_FIELDS) {
          if (expectedChangeFor(spec.expectedChanges, url, related)) {
            continue;
          }
          const relatedBefore = beforePage.fields[related] ?? unknownField();
          const relatedAfter = afterPage.fields[related] ?? unknownField();
          if (relatedAfter.presence === "unknown" || relatedBefore.presence === "unknown") {
            checks.push({
              url,
              field: related,
              role: "related",
              outcome: "unknown",
              before: relatedBefore,
              after: relatedAfter,
              result: "not_verified",
              note: "Related social description was not stored, so Foundfy cannot confirm it followed the approved copy.",
            });
            continue;
          }
          if (relatedBefore.presence === "absent" && relatedAfter.presence === "absent") {
            continue;
          }
          checks.push(
            checkExpectedChange({
              url,
              field: related,
              expectedAfter: change.after,
              before: relatedBefore,
              after: relatedAfter,
              role: "related",
            }),
          );
        }
      }
    }

    for (const field of preserveFields) {
      if (expectedChangeFor(spec.expectedChanges, url, field)) {
        continue;
      }
      const preserved = checkPreservedField({
        url,
        field,
        before: beforePage.fields[field] ?? unknownField(),
        after: afterPage.fields[field] ?? unknownField(),
      });
      if (preserved) {
        checks.push(preserved);
      }
    }
  }

  const issueStatus = originalIssueStatus(spec);
  if (issueStatus === "still_present") {
    checks.push({
      url: spec.urls[0] ?? spec.websiteId,
      field: "meta_description",
      role: "expected_change",
      outcome: "unchanged",
      before: unknownField(),
      after: unknownField(),
      result: "fail",
      note: "The original duplicate meta description issue is still present.",
    });
  }

  if (urls.some((item) => !item.matched) && checks.length === 0) {
    return {
      verdict: "not_verified",
      websiteId: spec.websiteId,
      urls,
      baselineCrawlId: spec.baseline.crawlRunId,
      baselineCompletedAt: spec.baseline.completedAt,
      verificationCrawlId: spec.verification.crawlRunId,
      verificationCompletedAt: spec.verification.completedAt,
      originalIssueStatus: issueStatus,
      checks,
      limitations,
      summary: "Foundfy could not match the requested URLs in both scans.",
    };
  }

  const failed = checks.some((check) => check.result === "fail");
  const unverified = checks.some((check) => check.result === "not_verified");
  // PASS requires reliable evidence for every requested URL and every declared
  // expected change. A confirmed FAIL still takes precedence.
  const incompleteScope =
    urls.some((item) => !item.matched) ||
    unscopedExpectedChanges.length > 0 ||
    spec.expectedChanges.length === 0;
  const verdict: RegressionSafetyVerdict = failed
    ? "fail"
    : unverified || incompleteScope || issueStatus === "not_verified"
      ? "not_verified"
      : "pass";

  const summary =
    verdict === "pass"
      ? "Expected change verified and no regression detected in the required, fully observed checks."
      : verdict === "fail"
        ? "A required expected value differs, or a confirmed unapproved regression exists."
        : "Required evidence is missing, incomplete, or cannot be reliably compared.";

  limitations.push(
    "PASS means crawl evidence preserved the declared metadata invariants. It does not mean a social platform rendered a preview or that an image URL is reachable.",
  );

  if (checks.some((check) => check.outcome === "unknown")) {
    limitations.push(
      "Missing stored data is not proof that a metadata field was absent on the live page.",
    );
  }

  return {
    verdict,
    websiteId: spec.websiteId,
    urls,
    baselineCrawlId: spec.baseline.crawlRunId,
    baselineCompletedAt: spec.baseline.completedAt,
    verificationCrawlId: spec.verification.crawlRunId,
    verificationCompletedAt: spec.verification.completedAt,
    originalIssueStatus: issueStatus,
    checks,
    limitations,
    summary,
  };
}
