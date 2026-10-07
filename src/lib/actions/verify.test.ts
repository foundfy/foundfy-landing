import { afterEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";

const requireObserveOwnerMock = vi.fn();
const findActionByIdMock = vi.fn();
const findSuccessfulExecuteAttemptMock = vi.fn();
const findLatestCompletedCrawlAfterMock = vi.fn();
const findLatestVerificationForActionMock = vi.fn();
const findVerificationByIdempotencyMock = vi.fn();
const listPagesForCrawlRunMock = vi.fn();
const findActiveMissingMetaObservationMock = vi.fn();
const insertActionVerificationMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("./db", () => ({
  findActionById: (...args: unknown[]) => findActionByIdMock(...args),
  findSuccessfulExecuteAttempt: (...args: unknown[]) => findSuccessfulExecuteAttemptMock(...args),
  findLatestCompletedCrawlAfter: (...args: unknown[]) => findLatestCompletedCrawlAfterMock(...args),
  findLatestVerificationForAction: (...args: unknown[]) => findLatestVerificationForActionMock(...args),
  findVerificationByIdempotency: (...args: unknown[]) => findVerificationByIdempotencyMock(...args),
  listPagesForCrawlRun: (...args: unknown[]) => listPagesForCrawlRunMock(...args),
  findActiveMissingMetaObservation: (...args: unknown[]) => findActiveMissingMetaObservationMock(...args),
  insertActionVerification: (...args: unknown[]) => insertActionVerificationMock(...args),
}));

import { verificationViewFor, verifyAction } from "./verify";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION = "owner-session-token";
const EXPECTED = "Foundfy turns on-page SEO insights into clear actions.";
const fetchSpy = vi.spyOn(globalThis, "fetch");

function executedAction() {
  return {
    id: "action-1",
    websiteId: WEBSITE_ID,
    decisionId: "decision-1",
    decisionRunId: "run-1",
    ownerId: "owner-1",
    actionType: "update_meta_description" as const,
    targetPageId: "page-before",
    targetPageUrl: "https://www.foundfy.me/",
    field: "meta_description" as const,
    observedBefore: null,
    proposedValue: EXPECTED,
    mutationSpec: {
      targetUrl: "https://www.foundfy.me/",
      field: "meta_description" as const,
      before: null,
      after: EXPECTED,
    },
    pageContentHashAtPrepare: "hash-unchanged",
    crawlRunId: "crawl-before",
    gscSyncId: "sync-1",
    siteModelId: "site-model-1",
    goalId: "goal-1",
    status: "executed" as const,
    approvedByOwnerId: "owner-1",
    approvedAt: "2026-10-04T10:00:00.000Z",
    createdAt: "2026-10-04T09:00:00.000Z",
    updatedAt: "2026-10-04T10:05:00.000Z",
    evidenceRefs: [],
  };
}

function successAttempt() {
  return {
    id: "attempt-1",
    actionId: "action-1",
    attemptNumber: 1,
    idempotencyKey: "action-1:github:execute",
    provider: "github",
    result: "success" as const,
    errorCode: null,
    artifact: {
      deploymentObserved: true,
      deploymentObservedAt: "2026-10-04T10:06:00.000Z",
      commitShaAfter: "abc123",
    },
    createdAt: "2026-10-04T10:05:00.000Z",
    finishedAt: "2026-10-04T10:05:30.000Z",
  };
}

function postExecutionCrawl(id = "crawl-after") {
  return {
    id,
    websiteId: WEBSITE_ID,
    status: "completed",
    pagesCrawled: 8,
    completedAt: "2026-10-04T12:00:00.000Z",
    createdAt: "2026-10-04T11:55:00.000Z",
  };
}

function homepagePage(metaDescription: string | null) {
  return {
    id: "page-after",
    crawlRunId: "crawl-after",
    requestedUrl: "https://foundfy.me/",
    finalUrl: "https://www.foundfy.me/",
    statusCode: 200,
    metaDescription,
    contentHash: "hash-unchanged",
  };
}

function verificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "verification-1",
    actionId: "action-1",
    websiteId: WEBSITE_ID,
    executionAttemptId: "attempt-1",
    crawlRunId: "crawl-after",
    targetPageId: "page-after",
    verificationType: "update_meta_description" as const,
    status: "verified" as const,
    expectedValue: EXPECTED,
    observedValue: EXPECTED,
    evidenceSnapshot: {
      crawlCompletedAt: "2026-10-04T12:00:00.000Z",
      missingMetaPresent: false,
    },
    verifiedAt: "2026-10-04T12:01:00.000Z",
    createdAt: "2026-10-04T12:01:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockReset();
});

describe("verificationViewFor", () => {
  it("hides verification until the action is executed", async () => {
    expect(await verificationViewFor({ ...executedAction(), status: "approved" })).toBeNull();
  });

  it("does not fabricate verification for a title action", async () => {
    expect(
      await verificationViewFor({
        ...executedAction(),
        actionType: "update_page_title",
        field: "title",
        mutationSpec: {
          targetUrl: "https://www.foundfy.me/",
          field: "title",
          before: "Old title",
          after: "New title",
        },
      }),
    ).toBeNull();
  });

  it("asks for a fresh crawl when none exists after execute", async () => {
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestVerificationForActionMock.mockResolvedValue(null);
    findLatestCompletedCrawlAfterMock.mockResolvedValue(null);

    expect(await verificationViewFor(executedAction())).toMatchObject({
      state: "fresh_crawl_required",
      canCheck: false,
      expectedValue: EXPECTED,
    });
  });

  it("offers Check verification when a post-execution crawl exists", async () => {
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestVerificationForActionMock.mockResolvedValue(null);
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());

    expect(await verificationViewFor(executedAction())).toMatchObject({
      state: "ready",
      canCheck: true,
      crawlRunId: "crawl-after",
    });
  });
});

describe("verifyAction", () => {
  it("denies a non-owner", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(403, "Owner session required."));

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: "other", actionId: "action-1" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not verify a non-executed action", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue({ ...executedAction(), status: "approved" });

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "not_executed" });
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
  });

  it("returns fresh_crawl_required when there is no post-execution crawl", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(null);

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "fresh_crawl_required" });
    expect(findLatestCompletedCrawlAfterMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      afterIso: "2026-10-04T10:05:30.000Z",
    });
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
  });

  it("does not treat a pre-execution crawl as verification evidence", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(null);

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "fresh_crawl_required" });
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
  });

  it("does not treat deploymentObserved as verification evidence", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(null);

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "fresh_crawl_required" });
  });

  it("persists verified when the fresh crawl shows the approved meta", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([homepagePage(EXPECTED)]);
    findActiveMissingMetaObservationMock.mockResolvedValue(null);
    insertActionVerificationMock.mockResolvedValue(verificationRecord());

    const record = await verifyAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(record.status).toBe("verified");
    expect(insertActionVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "verified",
        expectedValue: EXPECTED,
        observedValue: EXPECTED,
        crawlRunId: "crawl-after",
        executionAttemptId: "attempt-1",
        evidenceSnapshot: expect.objectContaining({
          missingMetaPresent: false,
          contentHash: "hash-unchanged",
        }),
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("persists not_verified when the fresh crawl still lacks the meta description", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([homepagePage(null)]);
    findActiveMissingMetaObservationMock.mockResolvedValue({
      id: "obs-1",
      pageId: "page-after",
      ruleKey: "page_fundamentals.missing_meta_description",
      status: "active",
      evidence: {},
    });
    insertActionVerificationMock.mockResolvedValue(
      verificationRecord({ status: "not_verified", observedValue: null, verifiedAt: null }),
    );

    const record = await verifyAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(record.status).toBe("not_verified");
    expect(insertActionVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "not_verified",
        observedValue: null,
        evidenceSnapshot: expect.objectContaining({ missingMetaPresent: true }),
      }),
    );
  });

  it("persists not_verified when observed meta differs from the approved after value", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([homepagePage("Something else.")]);
    findActiveMissingMetaObservationMock.mockResolvedValue(null);
    insertActionVerificationMock.mockResolvedValue(
      verificationRecord({
        status: "not_verified",
        observedValue: "Something else.",
        verifiedAt: null,
      }),
    );

    await verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" });

    expect(insertActionVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "not_verified",
        observedValue: "Something else.",
      }),
    );
  });

  it("persists inconclusive when the fresh crawl did not capture the target page", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "other-page",
        crawlRunId: "crawl-after",
        requestedUrl: "https://www.foundfy.me/pricing",
        finalUrl: "https://www.foundfy.me/pricing",
        statusCode: 200,
        metaDescription: EXPECTED,
        contentHash: "hash-2",
      },
    ]);
    insertActionVerificationMock.mockResolvedValue(
      verificationRecord({
        status: "inconclusive",
        targetPageId: null,
        observedValue: null,
        verifiedAt: null,
      }),
    );

    await verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" });

    expect(findActiveMissingMetaObservationMock).not.toHaveBeenCalled();
    expect(insertActionVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "inconclusive",
        targetPageId: null,
        observedValue: null,
      }),
    );
  });

  it("reuses the same verification row for the same execution and crawl", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(verificationRecord());

    const first = await verifyAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });
    const second = await verifyAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(first.id).toBe("verification-1");
    expect(second.id).toBe("verification-1");
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
    expect(listPagesForCrawlRunMock).not.toHaveBeenCalled();
  });

  it("can persist newer verification evidence from a later crawl", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl("crawl-later"));
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([
      { ...homepagePage("Changed later."), crawlRunId: "crawl-later" },
    ]);
    findActiveMissingMetaObservationMock.mockResolvedValue(null);
    insertActionVerificationMock.mockResolvedValue(
      verificationRecord({
        id: "verification-2",
        crawlRunId: "crawl-later",
        status: "not_verified",
        observedValue: "Changed later.",
      }),
    );

    const record = await verifyAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(record.id).toBe("verification-2");
    expect(insertActionVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        crawlRunId: "crawl-later",
        status: "not_verified",
        observedValue: "Changed later.",
      }),
    );
  });

  it("does not verify a title action", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue({
      ...executedAction(),
      actionType: "update_page_title",
      field: "title",
    });

    await expect(
      verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });
    expect(insertActionVerificationMock).not.toHaveBeenCalled();
  });

  it("does not call GitHub, start a crawl, or call OpenAI", async () => {
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findActionByIdMock.mockResolvedValue(executedAction());
    findSuccessfulExecuteAttemptMock.mockResolvedValue(successAttempt());
    findLatestCompletedCrawlAfterMock.mockResolvedValue(postExecutionCrawl());
    findVerificationByIdempotencyMock.mockResolvedValue(null);
    listPagesForCrawlRunMock.mockResolvedValue([homepagePage(EXPECTED)]);
    findActiveMissingMetaObservationMock.mockResolvedValue(null);
    insertActionVerificationMock.mockResolvedValue(verificationRecord());

    await verifyAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
