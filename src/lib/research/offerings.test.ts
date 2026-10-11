import { describe, expect, it } from "vitest";
import { ResearchGateError } from "./errors";
import {
  isValidResearchOffering,
  offeringQualityReason,
  selectResearchOfferings,
  validConfirmedOfferings,
} from "./offerings";

describe("RESEARCH offering quality", () => {
  it("rejects empty, short, long, generic, brand-only, and invalid characters", () => {
    expect(offeringQualityReason("  ", "dbhobby.com")).toBe("empty");
    expect(offeringQualityReason("ab", "dbhobby.com")).toBe("too_short");
    expect(offeringQualityReason("a".repeat(81), "dbhobby.com")).toBe("too_long");
    expect(offeringQualityReason("services", "dbhobby.com")).toBe("generic");
    expect(offeringQualityReason("Products", "dbhobby.com")).toBe("generic");
    expect(offeringQualityReason("solution", "dbhobby.com")).toBe("generic");
    expect(offeringQualityReason("dbhobby", "dbhobby.com")).toBe("brand_only");
    expect(offeringQualityReason("silk paint 😀", "dbhobby.com")).toBe("invalid_characters");
  });

  it("does not reject SEO-ish words that are otherwise specific", () => {
    expect(isValidResearchOffering("Website visibility analysis", "foundfy.me")).toBe(true);
    expect(isValidResearchOffering("Content and technical opportunities", "foundfy.me")).toBe(true);
  });

  it("keeps valid confirmed offerings in order and drops invalid ones", () => {
    expect(
      validConfirmedOfferings(
        ["silk paint", "services", "dbhobby", "alginate powder"],
        "dbhobby.com",
      ),
    ).toEqual(["silk paint", "alginate powder"]);
  });

  it("requires selection only from the confirmed valid set and caps at 5", () => {
    const confirmedValid = ["one offer", "two offer", "three offer", "four offer", "five offer", "six offer"];
    expect(() =>
      selectResearchOfferings({ confirmedValid, selected: undefined }),
    ).toThrow(ResearchGateError);

    expect(
      selectResearchOfferings({
        confirmedValid,
        selected: ["two offer", "four offer"],
      }),
    ).toEqual(["two offer", "four offer"]);

    expect(() =>
      selectResearchOfferings({
        confirmedValid,
        selected: ["not confirmed"],
      }),
    ).toThrow(/must match currently confirmed/);
  });

  it("uses all valid offerings when there are five or fewer and no selection is sent", () => {
    expect(
      selectResearchOfferings({
        confirmedValid: ["silk paint", "gutta"],
        selected: undefined,
      }),
    ).toEqual(["silk paint", "gutta"]);
  });
});
