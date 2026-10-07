import { describe, expect, it } from "vitest";
import { buildMutationSpec, normalizeProposedMetaDescription, normalizeProposedTitle } from "./mutation";
import { ActionError } from "./types";

describe("mutation_spec", () => {
  it("stores a provider-neutral meta description change", () => {
    expect(
      buildMutationSpec({
        targetUrl: "https://www.dbhobby.com/es/gutta",
        field: "meta_description",
        before: null,
        proposedValue: "Pintura sobre seda.",
      }),
    ).toEqual({
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "meta_description",
      before: null,
      after: "Pintura sobre seda.",
    });
    expect(
      buildMutationSpec({
        targetUrl: "https://www.dbhobby.com/",
        field: "title",
        before: "Pintura sobre seda | DBHOBBY",
        proposedValue: "Pintura sobre seda en Barcelona | DBHobby",
      }),
    ).toEqual({
      targetUrl: "https://www.dbhobby.com/",
      field: "title",
      before: "Pintura sobre seda | DBHOBBY",
      after: "Pintura sobre seda en Barcelona | DBHobby",
    });
  });

  it("does not invent placeholder copy", () => {
    expect(
      buildMutationSpec({
        targetUrl: "https://www.dbhobby.com/es/gutta",
        field: "meta_description",
        before: null,
        proposedValue: null,
      }).after,
    ).toBeNull();
  });

  it("rejects oversized proposed values", () => {
    expect(() => normalizeProposedMetaDescription("x".repeat(321))).toThrow(ActionError);
    expect(() => normalizeProposedTitle("x".repeat(321))).toThrow(ActionError);
    expect(normalizeProposedTitle("x".repeat(61))).toBe("x".repeat(61));
  });
});
