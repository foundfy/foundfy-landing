import { describe, expect, it } from "vitest";
import { classifyGscSampleStatus, currentGscSampleStatus, gscQueryCompactSet } from "./gsc-join";

describe("RESEARCH GSC join", () => {
  it("classifies retrieval-time membership with the mechanical compact key", () => {
    const keys = gscQueryCompactSet(["compte gotes", "cianotipo"]);
    expect(classifyGscSampleStatus("comptegotes", keys)).toBe("in_current_gsc_sample");
    expect(classifyGscSampleStatus("fixture related term", keys)).toBe(
      "not_in_current_gsc_sample",
    );
  });

  it("recomputes current membership separately from historical state", () => {
    const initial = classifyGscSampleStatus("fixture related term", gscQueryCompactSet([]));
    expect(initial).toBe("not_in_current_gsc_sample");
    expect(
      currentGscSampleStatus({
        keyword: "fixture related term",
        queryKeys: gscQueryCompactSet(["fixture related term"]),
      }),
    ).toBe("in_current_gsc_sample");
  });

  it("returns gsc_unavailable when there is no current query sample", () => {
    expect(
      currentGscSampleStatus({
        keyword: "fixture related term",
        queryKeys: null,
      }),
    ).toBe("gsc_unavailable");
  });
});
