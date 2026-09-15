import { describe, expect, it } from "vitest";
import { parseWebsiteGoalFields } from "./parse";

describe("parseWebsiteGoalFields", () => {
  it("accepts a primary outcome with no secondary goal", () => {
    const parsed = parseWebsiteGoalFields({
      primaryType: "grow_signups",
      secondaryType: "",
      note: "  ",
    });

    expect(parsed).toEqual({
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
    });
  });

  it("keeps an optional note as user-declared context", () => {
    const parsed = parseWebsiteGoalFields({
      primaryType: "build_awareness",
      secondaryType: "get_discovered_locally",
      note: "Private beta. Foundfy should stay cautious.",
    });

    expect(parsed.secondaryType).toBe("get_discovered_locally");
    expect(parsed.note).toBe("Private beta. Foundfy should stay cautious.");
  });

  it("requires a note when the outcome is something else", () => {
    expect(() =>
      parseWebsiteGoalFields({
        primaryType: "custom",
        note: "   ",
      }),
    ).toThrow(/something else/i);
  });

  it("rejects a missing primary outcome", () => {
    expect(() => parseWebsiteGoalFields({ primaryType: "" })).toThrow(
      /right people find this site/i,
    );
  });

  it("drops a secondary outcome that duplicates the primary", () => {
    const parsed = parseWebsiteGoalFields({
      primaryType: "get_more_enquiries",
      secondaryType: "get_more_enquiries",
    });

    expect(parsed.secondaryType).toBeNull();
  });
});
