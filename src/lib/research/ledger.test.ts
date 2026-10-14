import { describe, expect, it } from "vitest";
import {
  buildRequestPlan,
  classifyLedgerReplay,
  ledgerEntrySafeToResume,
  ledgerHasAmbiguousRequest,
  ledgerHasSecrets,
  parseRequestLedger,
  serializeRequestLedger,
} from "./ledger";
import { researchRequestKey } from "./request-key";
import type { ResearchRequestLedgerEntry } from "./types";

const entry = (
  status: ResearchRequestLedgerEntry["status"],
  overrides: Partial<ResearchRequestLedgerEntry> = {},
): ResearchRequestLedgerEntry => ({
  requestKey: researchRequestKey(overrides.seedOffering ?? "silk paint", overrides.languageCode ?? "ca"),
  seedOffering: "silk paint",
  languageCode: "ca",
  locationCode: 2724,
  providerTaskId: status === "succeeded" ? "task-1" : null,
  status,
  requestedAt: "2026-10-11T00:00:00.000Z",
  attemptedAt: status === "pending" || status === "skipped" ? null : "2026-10-11T00:00:00.500Z",
  retrievedAt: status === "skipped" || status === "pending" ? null : "2026-10-11T00:00:01.000Z",
  ideaCount: status === "succeeded" ? 3 : 0,
  providerResultCount: status === "succeeded" ? 4 : status === "zero_results" ? 0 : null,
  providerCost: status === "succeeded" ? 0.09 : null,
  failureCode: status === "failed" || status === "timeout" || status === "rate_limited" ? status : null,
  ...overrides,
});

describe("RESEARCH request ledger", () => {
  it("keeps provenance for pending, in-flight, success, zero results, failure, timeout, 429, and skipped", () => {
    const ledger = serializeRequestLedger([
      entry("pending"),
      entry("in_flight"),
      entry("succeeded"),
      entry("zero_results"),
      entry("failed"),
      entry("timeout"),
      entry("rate_limited"),
      entry("skipped"),
    ]);
    expect(ledger).toHaveLength(8);
    expect(ledger.map((item) => item.status)).toEqual([
      "pending",
      "in_flight",
      "succeeded",
      "zero_results",
      "failed",
      "timeout",
      "rate_limited",
      "skipped",
    ]);
    expect(ledger.every((item) => item.requestKey === researchRequestKey("silk paint", "ca"))).toBe(
      true,
    );
    expect(parseRequestLedger(ledger).find((item) => item.status === "failed")?.ideaCount).toBe(0);
    expect(parseRequestLedger([{ ...entry("zero_results"), ideaCount: 0 }])[0]?.providerResultCount).toBe(
      0,
    );
    const withoutCount = { ...entry("succeeded") } as Record<string, unknown>;
    delete withoutCount.providerResultCount;
    expect(parseRequestLedger([withoutCount])[0]?.providerResultCount).toBeNull();
    expect(
      parseRequestLedger([
        {
          status: "zero_results",
          seedOffering: "silk paint",
          languageCode: "ca",
          locationCode: 2724,
          requestedAt: "2026-10-11T00:00:00.000Z",
          ideaCount: 0,
        },
      ])[0]?.providerResultCount,
    ).toBeNull();
    expect(parseRequestLedger(ledger).find((item) => item.status === "in_flight")?.attemptedAt).toBe(
      "2026-10-11T00:00:00.500Z",
    );
  });

  it("bounds the ledger to 15 entries and refuses secret-like payloads", () => {
    const many = Array.from({ length: 20 }, () => entry("skipped"));
    expect(serializeRequestLedger(many)).toHaveLength(15);
    expect(
      ledgerHasSecrets([
        {
          ...entry("failed"),
          failureCode: "Authorization Basic abc",
        },
      ]),
    ).toBe(true);
    expect(ledgerHasSecrets([entry("succeeded")])).toBe(false);
    expect(ledgerHasAmbiguousRequest([entry("in_flight")])).toBe(true);
    expect(ledgerHasAmbiguousRequest([entry("succeeded")])).toBe(false);
    expect(parseRequestLedger([{ ...entry("succeeded"), providerCost: -1 }])[0]?.providerCost).toBeNull();
  });

  it("pre-seeds a full pending plan with stable identities independent of later order", () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en", "es"],
      locationCode: 2724,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    expect(plan).toHaveLength(4);
    expect(plan.every((item) => item.status === "pending" && item.attemptedAt == null)).toBe(true);
    expect(new Set(plan.map((item) => item.requestKey)).size).toBe(4);
    expect(plan[0]?.requestKey).toBe(researchRequestKey("silk paint", "en"));
  });

  it("rejects duplicate request identities inside one plan", () => {
    expect(() =>
      buildRequestPlan({
        offerings: ["silk paint", "silk paint"],
        languages: ["en"],
        locationCode: 2724,
        requestedAt: "2026-10-11T00:00:00.000Z",
      }),
    ).toThrow(/duplicate request identity/);
  });

  it("classifies replay safety by request identity, not array position", () => {
    const ledger = [
      entry("in_flight", { seedOffering: "silk paint", languageCode: "en" }),
      entry("pending", { seedOffering: "gutta resist", languageCode: "en" }),
    ];
    const reordered = [...ledger].reverse();
    expect(classifyLedgerReplay(ledger)).toEqual(classifyLedgerReplay(reordered));
    expect(classifyLedgerReplay(reordered).blockedKeys).toContain(
      researchRequestKey("silk paint", "en"),
    );
    expect(classifyLedgerReplay(reordered).resumableKeys).toContain(
      researchRequestKey("gutta resist", "en"),
    );
    expect(ledgerEntrySafeToResume(ledger[0]!)).toBe(false);
    expect(ledgerEntrySafeToResume(ledger[1]!)).toBe(true);
  });
});
