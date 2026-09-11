import { describe, expect, it } from "vitest";
import { parseRescanResponse } from "./rescan-action";

describe("parseRescanResponse", () => {
  it("returns a new crawl run id when scan creation succeeds", () => {
    const result = parseRescanResponse(
      new Response(null, { status: 201 }),
      {
        crawlRunId: "run-new",
        websiteId: "website-1",
        reusedActiveScan: false,
      },
    );

    expect(result).toEqual({
      ok: true,
      crawlRunId: "run-new",
      reusedActiveScan: false,
    });
  });

  it("returns the reused active scan id without treating it as an error", () => {
    const result = parseRescanResponse(
      new Response(null, { status: 200 }),
      {
        crawlRunId: "run-active",
        websiteId: "website-1",
        reusedActiveScan: true,
      },
    );

    expect(result).toEqual({
      ok: true,
      crawlRunId: "run-active",
      reusedActiveScan: true,
    });
  });

  it("surfaces API errors", () => {
    const result = parseRescanResponse(
      new Response(null, { status: 500 }),
      {
        crawlRunId: "",
        websiteId: "website-1",
        error: "Unable to start scan right now.",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "Unable to start scan right now.",
    });
  });
});
