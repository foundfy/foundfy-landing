import type { SiteModelRecord } from "@/lib/site-model/types";
import type { WebsiteGoalType, WebsiteGoalsRecord } from "./types";
import { WEBSITE_GOAL_TYPES } from "./types";

export const WEBSITE_GOAL_HEADING = "What should happen when the right people find you?";

export const WEBSITE_GOAL_TYPE_LABELS: Record<WebsiteGoalType, string> = {
  get_more_enquiries: "Get more enquiries",
  sell_more_products: "Sell more products",
  increase_bookings: "Increase bookings",
  grow_signups: "Grow sign-ups",
  reach_more_readers: "Reach more readers",
  build_awareness: "Build awareness",
  get_discovered_locally: "Get discovered locally",
  custom: "Something else",
};

export type WebsiteGoalsView = {
  heading: string;
  promptCopy: string;
  secondaryPrompt: string;
  notePrompt: string;
  saveLabel: string;
  editLabel: string;
  narrative: string | null;
  noteCopy: string | null;
  options: Array<{ type: WebsiteGoalType; label: string }>;
};

export function shouldShowWebsiteGoals(siteModel: SiteModelRecord | null): boolean {
  return siteModel?.confirmed != null;
}

function outcomePhrase(type: WebsiteGoalType, note: string | null): string {
  if (type === "custom") {
    return note ?? "something else";
  }

  return WEBSITE_GOAL_TYPE_LABELS[type].charAt(0).toLowerCase() + WEBSITE_GOAL_TYPE_LABELS[type].slice(1);
}

export function formatWebsiteGoalsNarrative(goals: WebsiteGoalsRecord): string {
  const primary = outcomePhrase(goals.primaryType, goals.note);
  const parts = [`When the right people find this site, it should ${primary}.`];

  if (goals.secondaryType) {
    const secondaryNote = goals.secondaryType === "custom" ? goals.note : null;
    parts.push(`It should also ${outcomePhrase(goals.secondaryType, secondaryNote)}.`);
  }

  return parts.join(" ");
}

export function buildWebsiteGoalsView(goals: WebsiteGoalsRecord | null): WebsiteGoalsView {
  const usesCustom =
    goals?.primaryType === "custom" || goals?.secondaryType === "custom";

  return {
    heading: WEBSITE_GOAL_HEADING,
    promptCopy: "Choose the main thing that should happen.",
    secondaryPrompt: "If useful, add one more.",
    notePrompt: usesCustom
      ? "What should happen, in a sentence."
      : "Anything Foundfy should keep in mind. Optional.",
    saveLabel: goals ? "Save" : "Save this",
    editLabel: "Edit",
    narrative: goals ? formatWebsiteGoalsNarrative(goals) : null,
    noteCopy:
      goals?.note && goals.primaryType !== "custom" && goals.secondaryType !== "custom"
        ? goals.note
        : null,
    options: WEBSITE_GOAL_TYPES.map((type) => ({
      type,
      label: WEBSITE_GOAL_TYPE_LABELS[type],
    })),
  };
}
