import { describe, expect, it } from "vitest";
import { buildWebsiteGoalsView, formatWebsiteGoalsNarrative, shouldShowWebsiteGoals } from "./display";
import type { WebsiteGoalsRecord } from "./types";
import type { SiteModelRecord } from "@/lib/site-model/types";

const goals: WebsiteGoalsRecord = {
  id: "goal-1",
  websiteId: "website-foundfy",
  primaryType: "grow_signups",
  secondaryType: "build_awareness",
  note: "Private beta.",
  source: "user_declared",
  declaredAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

describe("website goals display", () => {
  it("asks what should happen, not for SEO or traffic targets", () => {
    const view = buildWebsiteGoalsView(null);

    expect(view.heading).toBe("What should happen when the right people find you?");
    expect(view.narrative).toBeNull();
    expect(view.options.map((option) => option.label)).toEqual([
      "Get more enquiries",
      "Sell more products",
      "Increase bookings",
      "Grow sign-ups",
      "Reach more readers",
      "Build awareness",
      "Get discovered locally",
      "Something else",
    ]);
    expect(JSON.stringify(view)).not.toMatch(/keyword|ranking|traffic|GSC|GA4/i);
  });

  it("turns a saved goal into a human sentence", () => {
    expect(formatWebsiteGoalsNarrative(goals)).toBe(
      "When the right people find this site, it should grow sign-ups. It should also build awareness.",
    );
    expect(buildWebsiteGoalsView(goals).noteCopy).toBe("Private beta.");
  });

  it("only appears after the Site Model is confirmed", () => {
    expect(shouldShowWebsiteGoals({ confirmed: null } as SiteModelRecord)).toBe(false);
    expect(
      shouldShowWebsiteGoals({
        status: "stale",
        confirmed: { siteDescription: "Foundfy" },
      } as SiteModelRecord),
    ).toBe(true);
  });
});
