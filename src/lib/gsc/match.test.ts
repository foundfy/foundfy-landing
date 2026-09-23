import { describe, expect, it } from "vitest";
import {
  classifyGscProperty,
  partitionRankedProperties,
  rankGscProperties,
} from "./match";

const foundfy = {
  hostname: "foundfy.me",
  displayUrl: "https://www.foundfy.me/",
};

describe("Search Console property matching", () => {
  it("treats a domain property as an exact domain match", () => {
    expect(classifyGscProperty("sc-domain:foundfy.me", foundfy)).toBe("exact_domain");
  });

  it("treats the preferred URL-prefix as an exact URL-prefix match", () => {
    expect(classifyGscProperty("https://www.foundfy.me/", foundfy)).toBe("exact_url_prefix");
  });

  it("treats apex vs www as a related host", () => {
    expect(classifyGscProperty("https://foundfy.me/", foundfy)).toBe("related_host");
  });

  it("treats http vs https as a related host", () => {
    expect(classifyGscProperty("http://www.foundfy.me/", foundfy)).toBe("related_host");
  });

  it("does not treat unrelated properties as matches", () => {
    expect(classifyGscProperty("sc-domain:example.com", foundfy)).toBe("not_a_match");
    expect(classifyGscProperty("https://other.example/", foundfy)).toBe("not_a_match");
  });

  it("matches URL-prefix against an apex display URL", () => {
    const apex = { hostname: "foundfy.me", displayUrl: "https://foundfy.me/" };
    expect(classifyGscProperty("https://foundfy.me/", apex)).toBe("exact_url_prefix");
    expect(classifyGscProperty("https://www.foundfy.me/", apex)).toBe("related_host");
  });

  it("ranks exact domain first and keeps unrelated properties last", () => {
    const ranked = rankGscProperties(
      [
        { siteUrl: "https://other.example/", permissionLevel: "siteFullUser" },
        { siteUrl: "https://foundfy.me/", permissionLevel: "siteOwner" },
        { siteUrl: "sc-domain:foundfy.me", permissionLevel: "siteOwner" },
        { siteUrl: "https://www.foundfy.me/", permissionLevel: "siteOwner" },
      ],
      foundfy,
    );

    expect(ranked.map((property) => property.siteUrl)).toEqual([
      "sc-domain:foundfy.me",
      "https://www.foundfy.me/",
      "https://foundfy.me/",
      "https://other.example/",
    ]);
    expect(ranked.map((property) => property.match)).toEqual([
      "exact_domain",
      "exact_url_prefix",
      "related_host",
      "not_a_match",
    ]);
  });

  it("does not auto-select a property; it only recommends the first likely match", () => {
    const ranked = rankGscProperties(
      [
        { siteUrl: "sc-domain:foundfy.me", permissionLevel: "siteOwner" },
        { siteUrl: "https://www.foundfy.me/", permissionLevel: "siteOwner" },
      ],
      foundfy,
    );
    const partitioned = partitionRankedProperties(ranked);

    expect(partitioned.recommendedSiteUrl).toBe("sc-domain:foundfy.me");
    expect(partitioned.likely).toHaveLength(2);
    expect(partitioned.other).toHaveLength(0);
  });

  it("keeps a no-property account as an empty truthful list", () => {
    expect(partitionRankedProperties([])).toEqual({
      recommendedSiteUrl: null,
      likely: [],
      other: [],
    });
  });
});
