import { describe, expect, it } from "vitest";
import { buildRequestPlan } from "./ledger";
import { researchRunMayCallProvider } from "./query-keys";
import { researchRequestKey } from "./request-key";
import type { ResearchRequestLedgerEntry } from "./types";

function plan(): ResearchRequestLedgerEntry[] {
  return buildRequestPlan({
    offerings: ["silk paint", "gutta resist"],
    languages: ["en"],
    locationCode: 2840,
    requestedAt: "2026-10-11T00:00:00.000Z",
  });
}

function withStatus(
  entry: ResearchRequestLedgerEntry,
  status: ResearchRequestLedgerEntry["status"],
  attemptedAt: string | null,
): ResearchRequestLedgerEntry {
  return { ...entry, status, attemptedAt };
}

describe("researchRunMayCallProvider", () => {
  it("treats an empty ledger as executable provider work", () => {
    expect(researchRunMayCallProvider({ requestLedger: [] })).toBe(true);
  });

  it("treats pending and skipped-unattempted entries as executable", () => {
    const pending = plan();
    expect(researchRunMayCallProvider({ requestLedger: pending })).toBe(true);
    expect(
      researchRunMayCallProvider({
        requestLedger: [
          withStatus(pending[0]!, "rate_limited", "2026-10-11T00:00:01.000Z"),
          withStatus(pending[1]!, "skipped", null),
        ],
      }),
    ).toBe(true);
    expect(
      researchRunMayCallProvider({
        requestLedger: [withStatus(pending[0]!, "skipped", null)],
      }),
    ).toBe(true);
  });

  it("does not treat attempted, rate-limited, or completed work as executable", () => {
    const pending = plan();
    expect(
      researchRunMayCallProvider({
        requestLedger: pending.map((entry) =>
          withStatus(entry, "succeeded", "2026-10-11T00:00:01.000Z"),
        ),
      }),
    ).toBe(false);
    expect(
      researchRunMayCallProvider({
        requestLedger: [
          withStatus(pending[0]!, "rate_limited", "2026-10-11T00:00:01.000Z"),
          withStatus(pending[1]!, "skipped", "2026-10-11T00:00:02.000Z"),
        ],
      }),
    ).toBe(false);
    expect(
      researchRunMayCallProvider({
        requestLedger: [
          withStatus(pending[0]!, "in_flight", "2026-10-11T00:00:01.000Z"),
          withStatus(pending[1]!, "failed", "2026-10-11T00:00:02.000Z"),
        ],
      }),
    ).toBe(false);
  });

  it("keeps mixed ledgers executable only when a safe unattempted entry remains", () => {
    const pending = plan();
    expect(
      researchRunMayCallProvider({
        requestLedger: [
          withStatus(pending[0]!, "succeeded", "2026-10-11T00:00:01.000Z"),
          withStatus(pending[1]!, "pending", null),
        ],
      }),
    ).toBe(true);
    expect(pending[1]?.requestKey).toBe(researchRequestKey("gutta resist", "en"));
  });
});
