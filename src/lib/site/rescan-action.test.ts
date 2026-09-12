import { describe, expect, it } from "vitest";
import {
  buildRescanRequestPath,
  buildScanNavigationHref,
  parseRescanResponse,
} from "./rescan-action";

describe("rescan action helpers", () => {
  it("uses the website scan endpoint and navigates to that scan", () => {
    expect(buildRescanRequestPath("website-1")).toBe("/api/websites/website-1/scan");
    expect(buildScanNavigationHref("run-new")).toBe("/scan/run-new");
  });
});

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

  it("surfaces the beta capacity message from a non-500 rejection", () => {
    const result = parseRescanResponse(
      new Response(null, { status: 429 }),
      {
        crawlRunId: "",
        websiteId: "website-1",
        error: "Foundfy has reached today's beta analysis limit. Try again tomorrow.",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "Foundfy has reached today's beta analysis limit. Try again tomorrow.",
    });
  });
});
