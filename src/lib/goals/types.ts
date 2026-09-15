export const WEBSITE_GOAL_SOURCE = "user_declared" as const;

export const WEBSITE_GOAL_TYPES = [
  "get_more_enquiries",
  "sell_more_products",
  "increase_bookings",
  "grow_signups",
  "reach_more_readers",
  "build_awareness",
  "get_discovered_locally",
  "custom",
] as const;

export type WebsiteGoalType = (typeof WEBSITE_GOAL_TYPES)[number];

export type WebsiteGoalsRecord = {
  id: string;
  websiteId: string;
  primaryType: WebsiteGoalType;
  secondaryType: WebsiteGoalType | null;
  note: string | null;
  source: typeof WEBSITE_GOAL_SOURCE;
  declaredAt: string;
  updatedAt: string;
};

export type WebsiteGoalFields = {
  primaryType: WebsiteGoalType | "";
  secondaryType: WebsiteGoalType | "";
  note: string;
};

export const WEBSITE_GOAL_NOTE_MAX_LENGTH = 280;
