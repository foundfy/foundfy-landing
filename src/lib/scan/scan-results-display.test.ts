import { describe, expect, it } from "vitest";
import { shouldShowScanResults } from "./scan-results-display";

describe("scan results display", () => {
  it("shows historical completed scans immediately without client context", () => {
    expect(
      shouldShowScanResults({
        phase: "completed",
        loadedAsCompleted: true,
        showResults: false,
      }),
    ).toBe(true);
  });

  it("waits for the completion animation before showing live-scan results", () => {
    expect(
      shouldShowScanResults({
        phase: "completed",
        loadedAsCompleted: false,
        showResults: false,
      }),
    ).toBe(false);

    expect(
      shouldShowScanResults({
        phase: "completed",
        loadedAsCompleted: false,
        showResults: true,
      }),
    ).toBe(true);
  });

  it("does not show results while a scan is still analyzing", () => {
    expect(
      shouldShowScanResults({
        phase: "analyzing",
        loadedAsCompleted: false,
        showResults: false,
      }),
    ).toBe(false);
  });

  it("does not treat the live shell as a completed results page", () => {
    expect(
      shouldShowScanResults({
        phase: "analyzing",
        loadedAsCompleted: false,
        showResults: true,
      }),
    ).toBe(false);
  });
});
