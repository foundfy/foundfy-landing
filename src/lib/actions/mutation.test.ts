import { describe, expect, it } from "vitest";
import { buildMutationSpec, normalizeProposedMetaDescription } from "./mutation";
import { ActionError } from "./types";

describe("mutation_spec", () => {
  it("stores a provider-neutral meta description change", () => {
    expect(
      buildMutationSpec({
        targetUrl: "https://www.dbhobby.com/es/gutta",
        proposedValue: "Pintura sobre seda.",
      }),
    ).toEqual({
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "meta_description",
      before: null,
      after: "Pintura sobre seda.",
    });
  });

  it("does not invent placeholder copy", () => {
    expect(
      buildMutationSpec({
        targetUrl: "https://www.dbhobby.com/es/gutta",
        proposedValue: null,
      }).after,
    ).toBeNull();
  });

  it("rejects oversized proposed values", () => {
    expect(() => normalizeProposedMetaDescription("x".repeat(321))).toThrow(ActionError);
  });
});
