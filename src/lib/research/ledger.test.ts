import { describe, expect, it } from "vitest";
import {
  ledgerHasAmbiguousRequest,
  ledgerHasSecrets,
  parseRequestLedger,
  serializeRequestLedger,
} from "./ledger";
import type { ResearchRequestLedgerEntry } from "./types";

const entry = (status: ResearchRequestLedgerEntry["status"]): ResearchRequestLedgerEntry => ({
  seedOffering: "silk paint",
  languageCode: "ca",
  locationCode: 2724,
  providerTaskId: status === "succeeded" ? "task-1" : null,
  status,
  requestedAt: "2026-10-11T00:00:00.000Z",
  retrievedAt: status === "skipped" ? null : "2026-10-11T00:00:01.000Z",
  ideaCount: status === "succeeded" ? 3 : 0,
  providerCost: status === "succeeded" ? 0.09 : null,
  failureCode: status === "failed" || status === "timeout" || status === "rate_limited" ? status : null,
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
    expect(parseRequestLedger(ledger).find((item) => item.status === "failed")?.ideaCount).toBe(0);
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
});
