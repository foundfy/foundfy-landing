import { afterEach, beforeEach, vi } from "vitest";

// Controlled clock for tests whose fixtures were recorded around 2026-10-10 →
// 2026-10-16. RESEARCH staleness and reuse depend on a 30-day window measured
// from "now"; with the real clock these suites started failing once the
// fixtures aged past 30 days (issue #62). Pinning "now" keeps them meaningful
// without editing fixture dates. Production code still uses the real clock.
export const RESEARCH_TEST_NOW = new Date("2026-10-20T12:00:00.000Z");

/**
 * Pins Date (only Date; timers stay real) to `now` for every test in the
 * calling file. Call once at module level.
 */
export function pinResearchTestClock(now: Date = RESEARCH_TEST_NOW): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
