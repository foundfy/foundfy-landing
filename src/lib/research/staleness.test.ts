import { describe, expect, it } from "vitest";
import { RESEARCH_STALE_COPY } from "./display";
import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import {
  currentCompletedRunForFingerprint,
  currentCompletedRunsByFingerprint,
  isReadableCompletedRun,
  isReusableCompletedRun,
  researchStaleReasons,
} from "./staleness";
import type { ResearchRunRecord } from "./types";

function run(overrides: Partial<ResearchRunRecord> = {}): ResearchRunRecord {
  return {
    id: "run-1",
    websiteId: "site-1",
    siteModelId: "model-1",
    siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
    requestedBy: "owner-1",
    gscSyncId: "sync-1",
    gscQueriesTruncated: false,
    countryKey: "ES",
    countryName: "Spain",
    locationCode: 2724,
    languageCodes: ["ca"],
    offeringSeeds: ["silk paint"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "completed",
    requestFingerprint: "a".repeat(64),
    requestLedger: [],
    providerCost: 0,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    startedAt: "2026-10-10T00:00:00.000Z",
    completedAt: "2026-10-10T00:00:01.000Z",
    updatedAt: "2026-10-10T00:00:01.000Z",
    lastProgressAt: "2026-10-10T00:00:01.000Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

const FOUND_FY_LIVE = {
  confirmedJson: "2026-10-13T09:52:17.945Z",
  storedColumn: "2026-10-13T09:52:17.945+00:00",
  offering: "SEO audit for small businesses",
  completedAt: "2026-10-13T22:59:14.62+00:00",
};

describe("RESEARCH staleness and reuse", () => {
  it("stales after 30 days, business-context change, or offering change, but not GSC sync alone", () => {
    const old = researchStaleReasons({
      run: run({ completedAt: "2026-08-01T00:00:00.000Z" }),
      confirmedAt: "2026-10-01T00:00:00.000Z",
      confirmedOffers: ["silk paint"],
      currentFingerprintRunId: "run-1",
      now: new Date("2026-10-11T00:00:00.000Z"),
    });
    expect(old).toContain("older_than_30_days");

    const context = researchStaleReasons({
      run: run(),
      confirmedAt: "2026-10-11T00:00:00.000Z",
      confirmedOffers: ["silk paint"],
      currentFingerprintRunId: "run-1",
    });
    expect(context).toContain("business_context_changed");

    const offerings = researchStaleReasons({
      run: run(),
      confirmedAt: "2026-10-01T00:00:00.000Z",
      confirmedOffers: ["gutta"],
      currentFingerprintRunId: "run-1",
    });
    expect(offerings).toContain("offerings_changed");
  });

  it("treats equivalent ISO instants as the same confirmation, including the first live production pair", () => {
    const equivalent = researchStaleReasons({
      run: run({
        id: "105f3d46-5bb9-4825-bf0d-f1b1a50c8ea2",
        siteModelId: "42dce699-616d-44e2-90e0-0e14163b82f3",
        siteModelConfirmedAt: FOUND_FY_LIVE.storedColumn,
        offeringSeeds: [FOUND_FY_LIVE.offering],
        completedAt: FOUND_FY_LIVE.completedAt,
        createdAt: "2026-10-13T22:59:09.499191+00:00",
      }),
      confirmedAt: FOUND_FY_LIVE.confirmedJson,
      confirmedOffers: [FOUND_FY_LIVE.offering],
      currentFingerprintRunId: "105f3d46-5bb9-4825-bf0d-f1b1a50c8ea2",
      now: new Date("2026-10-14T12:00:00.000Z"),
    });
    expect(equivalent).toEqual([]);
    expect(equivalent).not.toContain("business_context_changed");
    expect(RESEARCH_STALE_COPY).toMatch(/out of date/);

    expect(
      researchStaleReasons({
        run: run({ siteModelConfirmedAt: "2026-10-13T11:52:17.945+02:00" }),
        confirmedAt: "2026-10-13T09:52:17.945Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "run-1",
      }),
    ).toEqual([]);
  });

  it("stales different milliseconds, different instants, and unparseable timestamps", () => {
    expect(
      researchStaleReasons({
        run: run({ siteModelConfirmedAt: "2026-10-13T09:52:17.946+00:00" }),
        confirmedAt: "2026-10-13T09:52:17.945Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "run-1",
      }),
    ).toContain("business_context_changed");

    expect(
      researchStaleReasons({
        run: run({ siteModelConfirmedAt: "2026-10-14T09:52:17.945+00:00" }),
        confirmedAt: "2026-10-13T09:52:17.945Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "run-1",
      }),
    ).toContain("business_context_changed");

    expect(
      researchStaleReasons({
        run: run({ siteModelConfirmedAt: "not-a-timestamp" }),
        confirmedAt: "2026-10-13T09:52:17.945Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "run-1",
      }),
    ).toContain("business_context_changed");

    expect(
      researchStaleReasons({
        run: run({ siteModelConfirmedAt: "2026-10-13T09:52:17.945Z" }),
        confirmedAt: "2026-10-13 09:52:17",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "run-1",
      }),
    ).toContain("business_context_changed");
  });

  it("does not stale owner-confirmed RESEARCH because a newer crawl exists", () => {
    const reasons = researchStaleReasons({
      run: run({
        siteModelId: "model-1",
        siteModelConfirmedAt: FOUND_FY_LIVE.storedColumn,
        offeringSeeds: [FOUND_FY_LIVE.offering],
      }),
      confirmedAt: FOUND_FY_LIVE.confirmedJson,
      confirmedOffers: [FOUND_FY_LIVE.offering],
      currentFingerprintRunId: "run-1",
    });
    expect(reasons).toEqual([]);
    expect(JSON.stringify(reasons)).not.toMatch(/crawl|gsc|sync/i);
  });

  it("does not reuse across fingerprints or unfinished runs", () => {
    expect(
      isReusableCompletedRun({
        run: run({ status: "partial" }),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isReusableCompletedRun({
        run: run(),
        fingerprint: "b".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isReusableCompletedRun({
        run: run(),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isReusableCompletedRun({
        run: run({ status: "closed", closedAt: "2026-10-11T00:00:00.000Z" }),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isReusableCompletedRun({
        run: run({ closedAt: "2026-10-11T00:00:00.000Z" }),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("selects the current completed run per fingerprint and ignores other fingerprints", () => {
    const spanish = run({
      id: "es",
      requestFingerprint: "fp-es",
      languageCodes: ["es"],
      completedAt: "2026-10-15T12:54:36.952Z",
      createdAt: "2026-10-15T12:54:32.806Z",
    });
    const catalan = run({
      id: "ca",
      requestFingerprint: "fp-ca",
      languageCodes: ["ca"],
      completedAt: "2026-10-15T20:32:58.531Z",
      createdAt: "2026-10-15T20:32:55.092Z",
    });
    const newerFailedSpanish = run({
      id: "es-failed",
      requestFingerprint: "fp-es",
      status: "failed",
      completedAt: null,
      createdAt: "2026-10-16T12:54:32.806Z",
    });
    expect(
      currentCompletedRunForFingerprint({
        runs: [catalan, newerFailedSpanish, spanish],
        fingerprint: "fp-es",
      })?.id,
    ).toBe("es");
    expect(
      currentCompletedRunsByFingerprint({
        runs: [catalan, newerFailedSpanish, spanish],
      }).map((row) => row.id),
    ).toEqual(["ca", "es"]);
    expect(
      researchStaleReasons({
        run: spanish,
        confirmedAt: "2026-10-01T00:00:00.000Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "es",
      }),
    ).toEqual([]);
    expect(
      researchStaleReasons({
        run: spanish,
        confirmedAt: "2026-10-01T00:00:00.000Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "es-newer",
      }),
    ).toContain("superseded");
    expect(
      researchStaleReasons({
        run: run({ status: "failed" }),
        confirmedAt: "2026-10-01T00:00:00.000Z",
        confirmedOffers: ["silk paint"],
        currentFingerprintRunId: "es",
      }),
    ).not.toContain("superseded");
  });

  it("keeps completed evidence readable after 30 days without making it provider-reusable", () => {
    const old = run({
      completedAt: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const now = new Date("2026-10-11T00:00:00.000Z");
    expect(isReadableCompletedRun({ run: old, fingerprint: "a".repeat(64) })).toBe(true);
    expect(isReusableCompletedRun({ run: old, fingerprint: "a".repeat(64), now })).toBe(false);
    expect(
      currentCompletedRunForFingerprint({
        runs: [old],
        fingerprint: "a".repeat(64),
      })?.id,
    ).toBe("run-1");
    expect(now.getTime() - Date.parse(old.completedAt ?? "")).toBeGreaterThan(RESEARCH_REUSE_WINDOW_MS);
  });

  it("selects the higher id when completed_at and created_at both tie", () => {
    const left = run({
      id: "00000000-0000-4000-8000-000000000001",
      requestFingerprint: "fp-es",
      completedAt: "2026-10-15T12:54:36.952Z",
      createdAt: "2026-10-15T12:54:32.806Z",
    });
    const right = run({
      id: "ffffffff-ffff-4fff-bfff-ffffffffffff",
      requestFingerprint: "fp-es",
      completedAt: "2026-10-15T12:54:36.952Z",
      createdAt: "2026-10-15T12:54:32.806Z",
    });
    expect(
      currentCompletedRunForFingerprint({
        runs: [left, right],
        fingerprint: "fp-es",
      })?.id,
    ).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(
      currentCompletedRunForFingerprint({
        runs: [right, left],
        fingerprint: "fp-es",
      })?.id,
    ).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("keeps an older completed run current when a newer same-fingerprint successor is requested or running", () => {
    const completed = run({
      id: "es",
      requestFingerprint: "fp-es",
      completedAt: "2026-10-15T12:54:36.952Z",
      createdAt: "2026-10-15T12:54:32.806Z",
    });
    for (const status of ["requested", "running"] as const) {
      expect(
        currentCompletedRunForFingerprint({
          runs: [
            run({
              id: `es-${status}`,
              requestFingerprint: "fp-es",
              status,
              completedAt: null,
              createdAt: "2026-10-16T12:54:32.806Z",
            }),
            completed,
          ],
          fingerprint: "fp-es",
        })?.id,
      ).toBe("es");
    }
  });
});
