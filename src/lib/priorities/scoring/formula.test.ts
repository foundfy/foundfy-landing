import { describe, expect, it } from "vitest";
import {
  calculatePriorityScore,
  mapScoreToPriorityLevel,
  PRIORITY_WEIGHTS,
} from "./formula";

describe("calculatePriorityScore", () => {
  it("applies centralized weights to normalized dimensions", () => {
    expect(PRIORITY_WEIGHTS).toEqual({
      impact: 0.5,
      reach: 0.3,
      confidence: 0.2,
    });

    expect(
      calculatePriorityScore({
        impact: 80,
        reach: 100,
        confidence: 100,
      }),
    ).toBe(90);
  });

  it("clamps scores to 0-100", () => {
    expect(
      calculatePriorityScore({
        impact: 120,
        reach: 120,
        confidence: 120,
      }),
    ).toBe(100);

    expect(
      calculatePriorityScore({
        impact: -10,
        reach: -10,
        confidence: -10,
      }),
    ).toBe(0);
  });
});

describe("mapScoreToPriorityLevel", () => {
  it("maps score thresholds to priority levels", () => {
    expect(mapScoreToPriorityLevel(100)).toBe("critical");
    expect(mapScoreToPriorityLevel(80)).toBe("critical");
    expect(mapScoreToPriorityLevel(79)).toBe("high");
    expect(mapScoreToPriorityLevel(60)).toBe("high");
    expect(mapScoreToPriorityLevel(59)).toBe("medium");
    expect(mapScoreToPriorityLevel(35)).toBe("medium");
    expect(mapScoreToPriorityLevel(34)).toBe("low");
    expect(mapScoreToPriorityLevel(0)).toBe("low");
  });
});
