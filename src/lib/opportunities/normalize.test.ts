import { describe, expect, it } from "vitest";
import {
  brandTokenFromHostname,
  compactBrandForms,
  isClearlyBrandedQuery,
  opportunityCompactKey,
  opportunityQueryKey,
} from "./normalize";

describe("Opportunity Grain v1 query keys", () => {
  it("folds case, punctuation, and whitespace while preserving diacritics", () => {
    expect(opportunityQueryKey("De dónde viene la seda")).toBe("de dónde viene la seda");
    expect(opportunityQueryKey("de-donde  viene la seda!")).toBe("de donde viene la seda");
    expect(opportunityQueryKey("CIANOTIPO")).toBe("cianotipo");
    expect(opportunityQueryKey("e\u0301")).toBe("é");
  });

  it("compares compact form by removing whitespace after mechanical normalization", () => {
    expect(opportunityCompactKey("compte gotes")).toBe("comptegotes");
    expect(opportunityCompactKey("comptegotes")).toBe("comptegotes");
    expect(opportunityCompactKey("compte-gotes")).toBe("comptegotes");
    expect(opportunityCompactKey("compta gotes")).toBe("comptagotes");
    expect(opportunityCompactKey("compta gotes")).not.toBe(opportunityCompactKey("compte gotes"));
    expect(opportunityCompactKey("alginat")).not.toBe(opportunityCompactKey("alginato"));
  });

  it("does not stem, drop function words, or fold diacritics", () => {
    expect(opportunityQueryKey("cianotip")).toBe("cianotip");
    expect(opportunityQueryKey("pintura en seda")).not.toBe(opportunityQueryKey("pintura seda"));
    expect(opportunityQueryKey("cinta de chiffon")).not.toBe(opportunityQueryKey("cinta chiffon"));
    expect(opportunityCompactKey("de dónde")).not.toBe(opportunityCompactKey("de donde"));
    expect(opportunityCompactKey("ı")).not.toBe(opportunityCompactKey("i"));
    expect(opportunityCompactKey("ł")).not.toBe(opportunityCompactKey("l"));
  });

  it("treats hostname tokens, spaced, possessive, and obvious plural brand queries as branded", () => {
    expect(brandTokenFromHostname("www.dbhobby.com")).toBe("dbhobby");
    expect(compactBrandForms("dbhobby").sort()).toEqual(["dbhobbies", "dbhobby", "dbhobbys"]);
    expect(isClearlyBrandedQuery("dbhobby", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("DB Hobby", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("db-hobby", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("DBHOBBY", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("dbhobby's", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("db hobbies", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("dbhobbies", "dbhobby.com")).toBe(true);
    expect(isClearlyBrandedQuery("foundfy", "foundfy.me")).toBe(true);
  });

  it("does not treat longer or unrelated queries as branded", () => {
    expect(isClearlyBrandedQuery("cianotipo", "dbhobby.com")).toBe(false);
    expect(isClearlyBrandedQuery("hobby pintura", "dbhobby.com")).toBe(false);
    expect(isClearlyBrandedQuery("de dónde viene la seda", "dbhobby.com")).toBe(false);
    expect(isClearlyBrandedQuery("best dbhobby paint", "dbhobby.com")).toBe(false);
    expect(isClearlyBrandedQuery("dbhobby cianotipo", "dbhobby.com")).toBe(false);
  });
});
