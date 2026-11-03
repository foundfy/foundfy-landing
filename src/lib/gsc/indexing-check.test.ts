import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV } from "./indexing-pilot";
import { GOOGLE_WEBMASTERS_READONLY_SCOPE } from "./scopes";
import {
  GoogleAuthExpiredError,
  GoogleIndexingError,
  GoogleIndexingPilotError,
  ObserveAuthError,
} from "./types";

const requireObserveOwnerMock = vi.fn();
const requireSearchConsoleConnectionMock = vi.fn();
const refreshGoogleAccessTokenMock = vi.fn();
const inspectUrlIndexStatusMock = vi.fn();
const listSearchConsoleSitemapsMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const pagesEqMock = vi.fn();
const artifactsEqMock = vi.fn();
const decryptSecretMock = vi.fn();

vi.mock("./observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
  requireSearchConsoleConnection: (...args: unknown[]) =>
    requireSearchConsoleConnectionMock(...args),
}));

vi.mock("./google", () => ({
  refreshGoogleAccessToken: (...args: unknown[]) => refreshGoogleAccessTokenMock(...args),
}));

vi.mock("./url-inspection", () => ({
  inspectUrlIndexStatus: (...args: unknown[]) => inspectUrlIndexStatusMock(...args),
}));

vi.mock("./sitemaps", () => ({
  listSearchConsoleSitemaps: (...args: unknown[]) => listSearchConsoleSitemapsMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "pages") {
        return { select: () => ({ eq: pagesEqMock }) };
      }
      return { select: () => ({ eq: () => ({ eq: artifactsEqMock }) }) };
    },
  }),
}));

vi.mock("./crypto", () => ({
  decryptSecret: (...args: unknown[]) => decryptSecretMock(...args),
}));

import {
  checkGoogleIndexing,
  resetGoogleIndexingCheckCacheForTests,
} from "./indexing-check";

const WEBSITE_A = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const WEBSITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IDENTITY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IDENTITY_B = "11111111-1111-4111-8111-111111111111";
const SESSION_TOKEN = "owner-session-token";
const ORIGINAL_ENV = { ...process.env };

function connection(overrides: {
  websiteId?: string;
  hostname?: string;
  ownerIdentityId?: string;
  propertyUri?: string;
} = {}) {
  const websiteId = overrides.websiteId ?? WEBSITE_A;
  return {
    website: { id: websiteId, hostname: overrides.hostname ?? "selcukdemirci.me" },
    session: { websiteId },
    owner: { googleIdentityId: overrides.ownerIdentityId ?? IDENTITY_A },
    token: {
      refreshTokenCiphertext: "cipher",
      scopes: GOOGLE_WEBMASTERS_READONLY_SCOPE,
      revokedAt: null,
    },
    connection: { propertyUri: overrides.propertyUri ?? "sc-domain:selcukdemirci.me" },
  };
}

describe("checkGoogleIndexing", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetGoogleIndexingCheckCacheForTests();
    process.env = { ...ORIGINAL_ENV };
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] =
      `${WEBSITE_A}:${IDENTITY_A},${WEBSITE_B}:${IDENTITY_A},${WEBSITE_A}:${IDENTITY_B}`;
    requireObserveOwnerMock.mockResolvedValue(connection());
    requireSearchConsoleConnectionMock.mockResolvedValue(connection());
    refreshGoogleAccessTokenMock.mockResolvedValue("access-token");
    decryptSecretMock.mockReturnValue("refresh-token");
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "selcuk-run" });
    pagesEqMock.mockResolvedValue({
      data: [
        {
          requested_url: "https://selcukdemirci.me/",
          final_url: "https://selcukdemirci.me/",
          status_code: 200,
        },
        {
          requested_url: "https://selcukdemirci.me/about",
          final_url: "https://selcukdemirci.me/about",
          status_code: 200,
        },
        {
          requested_url: "https://selcukdemirci.me/contact",
          final_url: "https://selcukdemirci.me/contact",
          status_code: 200,
        },
      ],
      error: null,
    });
    artifactsEqMock.mockResolvedValue({
      data: [{ url: "https://selcukdemirci.me/sitemap.xml" }],
      error: null,
    });
    inspectUrlIndexStatusMock.mockImplementation(async (input: { inspectionUrl: string }) => ({
      coverageState: `Mocked coverage for ${input.inspectionUrl}`,
    }));
    listSearchConsoleSitemapsMock.mockResolvedValue([]);
  });

  it("inspects at most three crawl-derived URLs and lists sitemaps without writing", async () => {
    const view = await checkGoogleIndexing({
      websiteId: WEBSITE_A,
      sessionToken: SESSION_TOKEN,
    });

    expect(inspectUrlIndexStatusMock).toHaveBeenCalledTimes(3);
    expect(inspectUrlIndexStatusMock.mock.calls.map((call) => call[0].inspectionUrl)).toEqual([
      "https://selcukdemirci.me/",
      "https://selcukdemirci.me/about",
      "https://selcukdemirci.me/contact",
    ]);
    expect(listSearchConsoleSitemapsMock).toHaveBeenCalledTimes(1);
    expect(view.urls).toHaveLength(3);
    expect(view.sitemap.crawledSitemapUrls).toEqual(["https://selcukdemirci.me/sitemap.xml"]);
    expect(view.sitemap.interpretation).toBe("none_listed");
    expect(JSON.stringify(inspectUrlIndexStatusMock.mock.calls)).not.toMatch(
      /urlNotifications|publish|submit/i,
    );
  });

  it("P. reuses an in-flight check and a recent result instead of repeating Google calls", async () => {
    const now = new Date("2026-11-02T23:30:00.000Z");
    const first = checkGoogleIndexing({
      websiteId: WEBSITE_A,
      sessionToken: SESSION_TOKEN,
      now,
    });
    const second = checkGoogleIndexing({
      websiteId: WEBSITE_A,
      sessionToken: SESSION_TOKEN,
      now,
    });
    const [firstView, secondView] = await Promise.all([first, second]);

    expect(inspectUrlIndexStatusMock).toHaveBeenCalledTimes(3);
    expect(firstView.reused).toBe(false);
    expect(secondView).toEqual(firstView);

    inspectUrlIndexStatusMock.mockClear();
    listSearchConsoleSitemapsMock.mockClear();
    const reused = await checkGoogleIndexing({
      websiteId: WEBSITE_A,
      sessionToken: SESSION_TOKEN,
      now: new Date("2026-11-02T23:31:00.000Z"),
    });
    expect(reused.reused).toBe(true);
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
    expect(listSearchConsoleSitemapsMock).not.toHaveBeenCalled();
    expect(requireSearchConsoleConnectionMock).toHaveBeenCalled();
  });

  it("N. does not reuse website A evidence for website B", async () => {
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    requireObserveOwnerMock.mockResolvedValue(
      connection({
        websiteId: WEBSITE_B,
        hostname: "b.example",
        propertyUri: "sc-domain:b.example",
      }),
    );
    requireSearchConsoleConnectionMock.mockResolvedValue(
      connection({
        websiteId: WEBSITE_B,
        hostname: "b.example",
        propertyUri: "sc-domain:b.example",
      }),
    );
    pagesEqMock.mockResolvedValue({
      data: [
        {
          requested_url: "https://b.example/",
          final_url: "https://b.example/",
          status_code: 200,
        },
      ],
      error: null,
    });
    inspectUrlIndexStatusMock.mockClear();

    await checkGoogleIndexing({ websiteId: WEBSITE_B, sessionToken: SESSION_TOKEN });
    expect(inspectUrlIndexStatusMock).toHaveBeenCalled();
    expect(inspectUrlIndexStatusMock.mock.calls[0]?.[0].inspectionUrl).toBe("https://b.example/");
  });

  it("does not reuse a result across Google identities or properties", async () => {
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    inspectUrlIndexStatusMock.mockClear();
    requireObserveOwnerMock.mockResolvedValue(connection({ ownerIdentityId: IDENTITY_B }));
    requireSearchConsoleConnectionMock.mockResolvedValue(
      connection({ ownerIdentityId: IDENTITY_B }),
    );
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    expect(inspectUrlIndexStatusMock).toHaveBeenCalled();
  });

  it("L. fails expired credentials without caching a successful check", async () => {
    inspectUrlIndexStatusMock.mockRejectedValue(new GoogleAuthExpiredError());
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);

    inspectUrlIndexStatusMock.mockResolvedValue({});
    const view = await checkGoogleIndexing({
      websiteId: WEBSITE_A,
      sessionToken: SESSION_TOKEN,
    });
    expect(view.reused).toBe(false);
    expect(inspectUrlIndexStatusMock).toHaveBeenCalled();
  });

  it("M. surfaces quota errors from Google", async () => {
    inspectUrlIndexStatusMock.mockRejectedValue(new GoogleIndexingError("quota"));
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ code: "quota" });
  });

  it("does not inspect when the owner session is missing", async () => {
    requireObserveOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: null }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(requireSearchConsoleConnectionMock).not.toHaveBeenCalled();
  });

  it("allows an authorized pilot owner and still caps Google reads at three URLs", async () => {
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:${IDENTITY_A}`;
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    expect(inspectUrlIndexStatusMock).toHaveBeenCalledTimes(3);
    expect(refreshGoogleAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it("denies the same website with a different owner before any Google call", async () => {
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:${IDENTITY_A}`;
    requireObserveOwnerMock.mockResolvedValue(connection({ ownerIdentityId: IDENTITY_B }));
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);
    expect(requireSearchConsoleConnectionMock).not.toHaveBeenCalled();
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
    expect(listSearchConsoleSitemapsMock).not.toHaveBeenCalled();
  });

  it("denies the wrong website before any Google call", async () => {
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:${IDENTITY_A}`;
    requireObserveOwnerMock.mockResolvedValue(
      connection({ websiteId: WEBSITE_B, hostname: "b.example" }),
    );
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_B, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
  });

  it("denies a missing or malformed allowlist before any Google call", async () => {
    delete process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV];
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);

    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = "";
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);

    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:not-a-uuid`;
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
    expect(listSearchConsoleSitemapsMock).not.toHaveBeenCalled();
  });

  it("does not let cached website evidence bypass a later allowlist denial", async () => {
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:${IDENTITY_A}`;
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    inspectUrlIndexStatusMock.mockClear();
    refreshGoogleAccessTokenMock.mockClear();
    requireSearchConsoleConnectionMock.mockClear();

    delete process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV];
    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);
    expect(requireSearchConsoleConnectionMock).not.toHaveBeenCalled();
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
  });

  it("does not expose identity A cached evidence to identity B", async () => {
    process.env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV] = `${WEBSITE_A}:${IDENTITY_A}`;
    await checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN });
    inspectUrlIndexStatusMock.mockClear();
    refreshGoogleAccessTokenMock.mockClear();
    requireObserveOwnerMock.mockResolvedValue(connection({ ownerIdentityId: IDENTITY_B }));

    await expect(
      checkGoogleIndexing({ websiteId: WEBSITE_A, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleIndexingPilotError);
    expect(inspectUrlIndexStatusMock).not.toHaveBeenCalled();
    expect(refreshGoogleAccessTokenMock).not.toHaveBeenCalled();
  });
});
