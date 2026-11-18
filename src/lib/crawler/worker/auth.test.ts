import { afterEach, describe, expect, it } from "vitest";
import { setTestNodeEnv } from "@/lib/testing/env";
import { isCrawlWorkerAuthorized } from "./auth";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isCrawlWorkerAuthorized", () => {
  it("accepts bearer tokens matching CRON_SECRET", () => {
    process.env.CRON_SECRET = "test-secret";
    setTestNodeEnv("production");

    const request = new Request("https://example.test/api/crawl/process", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    expect(isCrawlWorkerAuthorized(request)).toBe(true);
  });

  it("rejects missing authorization in production", () => {
    process.env.CRON_SECRET = "test-secret";
    setTestNodeEnv("production");

    const request = new Request("https://example.test/api/crawl/process");
    expect(isCrawlWorkerAuthorized(request)).toBe(false);
  });
});
