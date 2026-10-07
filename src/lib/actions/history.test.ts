import { describe, expect, it } from "vitest";
import { actionSafetyState, canOfferExecute, canSubmitExecute } from "./history";

describe("action history visibility", () => {
  it("keeps Execute submittable for approved stale actions so the server can fail closed", () => {
    expect(canSubmitExecute("approved")).toBe(true);
    expect(canSubmitExecute("blocked")).toBe(false);
    expect(canSubmitExecute("executed")).toBe(false);
    expect(canSubmitExecute("prepared")).toBe(false);
    expect(
      canOfferExecute({ status: "approved", actionType: "update_meta_description" }),
    ).toBe(true);
    expect(canOfferExecute({ status: "approved", actionType: "update_page_title" })).toBe(false);
  });

  it("renders stale safety independently of stored approved status", () => {
    expect(
      actionSafetyState({
        status: "approved",
        executeAvailable: false,
        executeBlockedReason: "unsafe_stale",
      }),
    ).toBe("unsafe_stale");
  });
});
