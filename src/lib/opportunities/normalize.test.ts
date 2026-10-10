import { describe, expect, it } from "vitest";
import {
  brandTokenFromHostname,
  compactBrandForms,
  isClearlyBrandedQuery,
  opportunityQueryKey,
} from "./normalize";

describe("Opportunity Discovery v0 query keys", () => {
  it("folds case, accents, punctuation, and whitespace", () => {
    expect(opportunityQueryKey("De dónde viene la seda")).toBe("de donde viene la seda");
    expect(opportunityQueryKey("de-donde  viene la seda!")).toBe("de donde viene la seda");
    expect(opportunityQueryKey("CIANOTIPO")).toBe("cianotipo");
  });

  it("does not stem or drop function words", () => {
    expect(opportunityQueryKey("cianotip")).toBe("cianotip");
    expect(opportunityQueryKey("pintura en seda")).not.toBe(opportunityQueryKey("pintura seda"));
    expect(opportunityQueryKey("cinta de chiffon")).not.toBe(opportunityQueryKey("cinta chiffon"));
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
