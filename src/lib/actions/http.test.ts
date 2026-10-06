import { describe, expect, it } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";
import { actionErrorResponse } from "./http";
import { ActionError } from "./types";

describe("actionErrorResponse", () => {
  it("keeps owner and action errors private", async () => {
    const auth = actionErrorResponse(new ObserveAuthError(401, "Owner session required."), "fallback");
    expect(auth.status).toBe(401);
    expect(auth.headers.get("cache-control")).toMatch(/no-store/);

    const adapter = actionErrorResponse(
      new ActionError("adapter_not_connected", "No adapter."),
      "fallback",
    );
    expect(adapter.status).toBe(409);
    expect(await adapter.json()).toMatchObject({ reason: "adapter_not_connected" });
    expect(adapter.headers.get("cache-control")).toMatch(/no-store/);

    const freshCrawl = actionErrorResponse(
      new ActionError("fresh_crawl_required", "Run a new scan."),
      "fallback",
    );
    expect(freshCrawl.status).toBe(409);
    expect(await freshCrawl.json()).toMatchObject({ reason: "fresh_crawl_required" });
  });
});
