import { SEARCH_ANALYTICS_TIME_ZONE, SEARCH_ANALYTICS_WINDOW_DAYS } from "./config";

export type SearchAnalyticsWindow = {
  startDate: string;
  endDate: string;
  windowDays: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function calendarDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Search Analytics period could not be resolved.");
  }

  return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid Search Analytics date.");
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function lastNInclusiveDays(
  now: Date,
  days: number,
  timeZone = SEARCH_ANALYTICS_TIME_ZONE,
): SearchAnalyticsWindow {
  const endDate = calendarDateInTimeZone(now, timeZone);
  const startDate = shiftIsoDate(endDate, -(days - 1));
  return { startDate, endDate, windowDays: days };
}

export function searchAnalyticsWindow(now = new Date()): SearchAnalyticsWindow {
  return lastNInclusiveDays(now, SEARCH_ANALYTICS_WINDOW_DAYS);
}

export function formatEvidenceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }

  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
