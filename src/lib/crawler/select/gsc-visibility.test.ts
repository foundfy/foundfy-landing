import { beforeEach, describe, expect, it, vi } from "vitest";

const findOwnerSessionByTokenHashMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const findOwnerSearchConsoleConnectionMock = vi.fn();
const findLatestCompletedSearchSyncMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();

vi.mock("@/lib/gsc/cookie", () => ({
  hashSessionToken: (token: string) => `hash:${token}`,
}));

vi.mock("@/lib/gsc/db", () => ({
  findOwnerSessionByTokenHash: (...args: unknown[]) => findOwnerSessionByTokenHashMock(...args),
  findActiveObserveOwner: (...args: unknown[]) => findActiveObserveOwnerMock(...args),
  findActivePropertyConnection: (...args: unknown[]) =>
    findOwnerSearchConsoleConnectionMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  findLatestCompletedSearchSync: (...args: unknown[]) => findLatestCompletedSearchSyncMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

import { resolveOwnerGscVisibilityPages } from "./gsc-visibility";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";

describe("resolveOwnerGscVisibilityPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no candidates without an owner session", async () => {
    await expect(
      resolveOwnerGscVisibilityPages({
        websiteId: WEBSITE_ID,
        hostname: "dbhobby.com",
        sessionToken: null,
      }),
    ).resolves.toEqual([]);
    expect(findOwnerSessionByTokenHashMock).not.toHaveBeenCalled();
  });

  it("ignores a session for a different website", async () => {
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: "other-website",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await expect(
      resolveOwnerGscVisibilityPages({
        websiteId: WEBSITE_ID,
        hostname: "dbhobby.com",
        sessionToken: "owner-token",
      }),
    ).resolves.toEqual([]);
    expect(findOwnerSearchConsoleConnectionMock).not.toHaveBeenCalled();
  });

  it("ignores a revoked or missing Search Console connection", async () => {
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findOwnerSearchConsoleConnectionMock.mockResolvedValue(null);

    await expect(
      resolveOwnerGscVisibilityPages({
        websiteId: WEBSITE_ID,
        hostname: "dbhobby.com",
        sessionToken: "owner-token",
      }),
    ).resolves.toEqual([]);
    expect(findLatestCompletedSearchSyncMock).not.toHaveBeenCalled();
  });

  it("ignores missing, failed, or running syncs", async () => {
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findOwnerSearchConsoleConnectionMock.mockResolvedValue({
      id: "connection-current",
      websiteId: WEBSITE_ID,
      status: "connected",
      googleIdentityId: "identity-1",
    });
    findLatestCompletedSearchSyncMock.mockResolvedValue(null);

    await expect(
      resolveOwnerGscVisibilityPages({
        websiteId: WEBSITE_ID,
        hostname: "dbhobby.com",
        sessionToken: "owner-token",
      }),
    ).resolves.toEqual([]);
    expect(findLatestCompletedSearchSyncMock).toHaveBeenCalledWith(WEBSITE_ID, "connection-current");
    expect(listEvidenceForSyncMock).not.toHaveBeenCalled();
  });

  it("loads only current-property completed page evidence for an owner session", async () => {
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findOwnerSearchConsoleConnectionMock.mockResolvedValue({
      id: "connection-current",
      websiteId: WEBSITE_ID,
      status: "connected",
      googleIdentityId: "identity-1",
    });
    findLatestCompletedSearchSyncMock.mockResolvedValue({
      id: "sync-1",
      status: "completed",
      propertyConnectionId: "connection-current",
    });
    listEvidenceForSyncMock.mockResolvedValue([
      {
        evidenceType: "query",
        pageUrl: null,
        queryText: "seda",
        impressions: 900,
        clicks: 40,
      },
      {
        evidenceType: "page",
        pageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        impressions: 133,
        clicks: 1,
      },
      {
        evidenceType: "page",
        pageUrl: "https://dbhobby.com/es/gutta-para-seda",
        impressions: 96,
        clicks: 3,
      },
    ]);

    const pages = await resolveOwnerGscVisibilityPages({
      websiteId: WEBSITE_ID,
      hostname: "dbhobby.com",
      sessionToken: "owner-token",
    });

    expect(pages.map((page) => page.url)).toEqual([
      "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
      "https://dbhobby.com/es/gutta-para-seda",
    ]);
    expect(pages.some((page) => page.url.includes("seda") && !page.url.startsWith("http"))).toBe(false);
  });

  it("falls back to no candidates when loading GSC evidence fails", async () => {
    findOwnerSessionByTokenHashMock.mockRejectedValue(new Error("db down"));

    await expect(
      resolveOwnerGscVisibilityPages({
        websiteId: WEBSITE_ID,
        hostname: "dbhobby.com",
        sessionToken: "owner-token",
      }),
    ).resolves.toEqual([]);
  });
});
