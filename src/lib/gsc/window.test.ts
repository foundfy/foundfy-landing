import { describe, expect, it } from "vitest";
import { SEARCH_ANALYTICS_WINDOW_DAYS } from "./config";
import {
  calendarDateInTimeZone,
  lastNInclusiveDays,
  searchAnalyticsWindow,
  shiftIsoDate,
} from "./window";

describe("Search Analytics 28-day window", () => {
  it("uses an inclusive 28-day window in America/Los_Angeles", () => {
    const now = new Date("2026-09-24T18:00:00.000Z");
    const window = lastNInclusiveDays(now, SEARCH_ANALYTICS_WINDOW_DAYS, "UTC");

    expect(window.windowDays).toBe(28);
    expect(window.endDate).toBe("2026-09-24");
    expect(window.startDate).toBe("2026-08-28");
    expect(shiftIsoDate("2026-09-24", -27)).toBe("2026-08-28");
  });

  it("does not invent a date picker window", () => {
    const window = searchAnalyticsWindow(new Date("2026-09-24T12:00:00.000Z"));
    expect(window.windowDays).toBe(28);
    expect(calendarDateInTimeZone(new Date("2026-09-24T08:00:00.000Z"), "UTC")).toBe(
      "2026-09-24",
    );
  });
});
