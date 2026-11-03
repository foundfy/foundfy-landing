import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeInterpretationFields } from "./parse";
import { applyListFieldEditorChange, listFieldToEditorText } from "./editor";

const SELCUK_WEBSITE_ID = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const OTHER_WEBSITE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function brokenTrimOnChange(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

describe("Site Model list field editing", () => {
  it("A/B. keeps spaces while typing a multiword service", () => {
    const typed = applyListFieldEditorChange("Wedding films ");
    expect(listFieldToEditorText(typed)).toBe("Wedding films ");
    expect(brokenTrimOnChange("Wedding films ")).toEqual(["Wedding films"]);
  });

  it("C. keeps pasted multiword text, including a trailing newline for the next item", () => {
    const pasted = applyListFieldEditorChange(
      "Documentary filmmaking for artists\nCommercial and branded films\n",
    );
    expect(listFieldToEditorText(pasted)).toBe(
      "Documentary filmmaking for artists\nCommercial and branded films\n",
    );
    expect(pasted).toEqual([
      "Documentary filmmaking for artists",
      "Commercial and branded films",
      "",
    ]);
  });

  it("D. lets an existing high-level offering be expanded in place", () => {
    const current = listFieldToEditorText(["Filmmaking"]);
    const edited = applyListFieldEditorChange(`${current} for artists and brands`);
    expect(edited).toEqual(["Filmmaking for artists and brands"]);
  });

  it("E. keeps a blank line so a second distinct service can be typed", () => {
    const afterEnter = applyListFieldEditorChange("Filmmaking\n");
    expect(listFieldToEditorText(afterEnter)).toBe("Filmmaking\n");
    const twoServices = applyListFieldEditorChange(
      "Filmmaking\nWedding and event films",
    );
    expect(twoServices).toEqual(["Filmmaking", "Wedding and event films"]);
    expect(brokenTrimOnChange("Filmmaking\n")).toEqual(["Filmmaking"]);
  });

  it("F. edits one service without changing the others", () => {
    const next = applyListFieldEditorChange(
      "Wedding and event films\nCommercial work",
    );
    expect(next).toEqual(["Wedding and event films", "Commercial work"]);
    const editedSecond = applyListFieldEditorChange(
      "Wedding and event films\nCommercial and branded films",
    );
    expect(editedSecond).toEqual([
      "Wedding and event films",
      "Commercial and branded films",
    ]);
  });

  it("G. removing one service does not drop the remaining copy", () => {
    const afterRemoval = applyListFieldEditorChange("Wedding and event films\n");
    expect(afterRemoval).toEqual(["Wedding and event films", ""]);
    expect(
      normalizeInterpretationFields({
        siteDescription: "Selcuk Demirci makes films for artists and brands.",
        offers: afterRemoval,
        audiences: ["artists", "brands"],
        locations: [],
      }).offers,
    ).toEqual(["Wedding and event films"]);
  });

  it("H/J. save normalization keeps multiple services and internal spaces", () => {
    const saved = normalizeInterpretationFields({
      siteDescription: "  Selcuk Demirci is a filmmaker for artists and brands.  ",
      offers: ["Wedding films ", "", "Commercial work"],
      audiences: [" Artists who need films "],
      locations: [" Istanbul "],
    });

    expect(saved.siteDescription).toBe(
      "Selcuk Demirci is a filmmaker for artists and brands.",
    );
    expect(saved.offers).toEqual(["Wedding films", "Commercial work"]);
    expect(saved.audiences).toEqual(["Artists who need films"]);
    expect(saved.locations).toEqual(["Istanbul"]);

    const again = normalizeInterpretationFields({
      ...saved,
      offers: ["Wedding films", "Commercial work", "Documentary filmmaking"],
    });
    expect(again.offers).toEqual([
      "Wedding films",
      "Commercial work",
      "Documentary filmmaking",
    ]);
    expect(again.siteDescription).toBe(saved.siteDescription);
  });

  it("I. empty list lines are dropped only at save, and a blank description stays blank", () => {
    expect(applyListFieldEditorChange("\n")).toEqual(["", ""]);
    const saved = normalizeInterpretationFields({
      siteDescription: "   ",
      offers: ["", "   ", "\t"],
      audiences: [],
      locations: [],
    });
    expect(saved.siteDescription).toBe("");
    expect(saved.offers).toEqual([]);
  });

  it("K. does not mix website A list text into website B", () => {
    const byWebsite: Record<string, string[]> = {
      [SELCUK_WEBSITE_ID]: applyListFieldEditorChange("Filmmaking\nWedding films"),
      [OTHER_WEBSITE_ID]: applyListFieldEditorChange("Search visibility"),
    };
    expect(byWebsite[SELCUK_WEBSITE_ID]).toEqual(["Filmmaking", "Wedding films"]);
    expect(byWebsite[OTHER_WEBSITE_ID]).toEqual(["Search visibility"]);
  });

  it("L. existing single-offer Site Models still round-trip", () => {
    const text = listFieldToEditorText(["Filmmaking"]);
    expect(text).toBe("Filmmaking");
    expect(applyListFieldEditorChange(text)).toEqual(["Filmmaking"]);
    expect(
      normalizeInterpretationFields({
        siteDescription: "The homepage heading is “Filmmaking”.",
        offers: applyListFieldEditorChange(text),
        audiences: [],
        locations: [],
      }).offers,
    ).toEqual(["Filmmaking"]);
  });
});

describe("Site Model editor wiring boundary", () => {
  it("does not trim list fields on every onChange", () => {
    const ui = readFileSync(
      path.join(__dirname, "../../../components/site/SiteUnderstandingSection.tsx"),
      "utf8",
    );
    const page = readFileSync(
      path.join(__dirname, "../../../components/site/SitePageView.tsx"),
      "utf8",
    );
    expect(page).toMatch(/<SiteUnderstandingSection[\s\S]*key=\{websiteId\}/);
    expect(page.match(/<SiteUnderstandingSection/g)).toHaveLength(1);
    expect(ui.match(/id="site-understanding"/g)).toHaveLength(1);
    expect(ui).toContain("applyListFieldEditorChange");
    expect(ui).toContain("listFieldToEditorText");
    expect(ui).not.toMatch(/\.map\(\(item\) => item\.trim\(\)\)/);
    expect(ui).toContain("await onUpdated()");
    const saveBlock = ui.slice(ui.indexOf("if (!response.ok)"), ui.indexOf("} finally"));
    expect(saveBlock.indexOf("await onUpdated()")).toBeLessThan(
      saveBlock.indexOf("setIsEditing(false)"),
    );
  });
});
