import { describe, expect, it } from "vitest";
import {
  DECISION_BLOCKED_ACTION,
  DECISION_BLOCKED_COPY,
  DECISION_EMPTY_GSC_COPY,
  DECISION_NO_OVERLAP_COPY,
  DECISION_SECTION_HEADING,
} from "./display";

describe("DECIDE display copy", () => {
  it("keeps What to do next above Current state", () => {
    expect(DECISION_SECTION_HEADING).toBe("What to do next");
  });

  it("uses explicit blocked copy instead of a catch-all empty result", () => {
    expect(DECISION_BLOCKED_COPY.missing_site_model).toBe(
      "Confirm how Foundfy understands this site before prioritizing actions.",
    );
    expect(DECISION_BLOCKED_COPY.missing_goal).toBe(
      "Tell Foundfy what should happen when the right people find this site before prioritizing actions.",
    );
    expect(DECISION_BLOCKED_COPY.google_not_connected).toBe(
      "Connect Google Search before Foundfy can combine search demand with website evidence.",
    );
    expect(DECISION_BLOCKED_COPY.missing_gsc_sync).toBe(
      "Sync Google search data before Foundfy can prioritize cross-signal actions.",
    );
    expect(DECISION_BLOCKED_ACTION.missing_site_model.href).toBe("#site-understanding");
    expect(DECISION_BLOCKED_ACTION.missing_goal.href).toBe("#site-goals");
    expect(DECISION_BLOCKED_ACTION.google_not_connected.href).toBe("#site-observe");
    expect(DECISION_BLOCKED_ACTION.missing_gsc_sync.href).toBe("#site-observe");
  });

  it("keeps completed empty GSC and no-overlap copy distinct", () => {
    expect(DECISION_EMPTY_GSC_COPY).toBe(
      "Foundfy doesn't have enough Google Search evidence to prioritize cross-signal actions yet.",
    );
    expect(DECISION_NO_OVERLAP_COPY).toBe(
      "Foundfy has search evidence and website evidence, but they don't overlap strongly enough to prioritize an action yet.",
    );
    expect(DECISION_EMPTY_GSC_COPY).not.toBe(DECISION_NO_OVERLAP_COPY);
    expect(DECISION_EMPTY_GSC_COPY).not.toContain("enough cross-signal evidence to prioritize an action yet");
  });
});
