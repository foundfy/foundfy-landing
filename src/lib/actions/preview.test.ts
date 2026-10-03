import { describe, expect, it } from "vitest";
import { executeAvailability } from "./preview";

describe("executeAvailability", () => {
  it("exposes unsafe_stale before adapter_not_connected", () => {
    expect(
      executeAvailability({
        status: "approved",
        unsafe: true,
        adapterReady: true,
      }),
    ).toEqual({ executeAvailable: false, executeBlockedReason: "unsafe_stale" });
  });

  it("exposes adapter_not_connected for a safe unsupported target", () => {
    expect(
      executeAvailability({
        status: "approved",
        unsafe: false,
        adapterReady: false,
      }),
    ).toEqual({ executeAvailable: false, executeBlockedReason: "adapter_not_connected" });
  });

  it("marks a safe Foundfy-ready approved action as executable", () => {
    expect(
      executeAvailability({
        status: "approved",
        unsafe: false,
        adapterReady: true,
      }),
    ).toEqual({ executeAvailable: true, executeBlockedReason: null });
  });

  it("does not expose execute for blocked or executed actions", () => {
    expect(executeAvailability({ status: "blocked", unsafe: true, adapterReady: true })).toEqual({
      executeAvailable: false,
      executeBlockedReason: null,
    });
    expect(executeAvailability({ status: "executed", unsafe: false, adapterReady: true })).toEqual({
      executeAvailable: false,
      executeBlockedReason: null,
    });
  });
});
