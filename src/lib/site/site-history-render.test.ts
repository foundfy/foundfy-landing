import { describe, expect, it } from "vitest";
import {
  formatHistoryFindingsLabel,
  formatHistoryStatusLabel,
  isHistoryRowClickable,
} from "./site-overview-view-model";

describe("site history rendering", () => {
  it("renders completed, failed, running, and queued statuses honestly", () => {
    expect(formatHistoryStatusLabel("completed")).toBe("Completed");
    expect(formatHistoryStatusLabel("failed")).toBe("Failed");
    expect(formatHistoryStatusLabel("running")).toBe("In progress");
    expect(formatHistoryStatusLabel("queued")).toBe("Queued");
  });

  it("links completed and in-progress rows but not failed rows", () => {
    expect(isHistoryRowClickable({ status: "completed" } as never)).toBe(true);
    expect(isHistoryRowClickable({ status: "running" } as never)).toBe(true);
    expect(isHistoryRowClickable({ status: "queued" } as never)).toBe(true);
    expect(isHistoryRowClickable({ status: "failed" } as never)).toBe(false);
  });

  it("omits findings text when count is unavailable", () => {
    expect(formatHistoryFindingsLabel(null)).toBeNull();
  });
});
