import { describe, expect, it } from "vitest";
import { metadata as scanMetadata } from "@/app/scan/layout";
import { metadata as siteMetadata } from "@/app/site/layout";
import robots from "@/app/robots";
import { RESULT_PAGE_ROBOTS, RESULT_ROBOTS_DISALLOW } from "./result-indexing";

describe("scan and site result indexing", () => {
  it("marks /scan and /site as noindex and keeps the landing indexable", () => {
    expect(RESULT_PAGE_ROBOTS).toEqual({ index: false, follow: false });
    expect(scanMetadata.robots).toEqual(RESULT_PAGE_ROBOTS);
    expect(siteMetadata.robots).toEqual(RESULT_PAGE_ROBOTS);
    expect(RESULT_ROBOTS_DISALLOW).toEqual(["/scan/", "/site/"]);

    const manifest = robots();
    const rules = Array.isArray(manifest.rules) ? manifest.rules[0] : manifest.rules;

    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(["/scan/", "/site/"]);
    expect(manifest.sitemap).toBe("https://www.foundfy.me/sitemap.xml");
  });
});
