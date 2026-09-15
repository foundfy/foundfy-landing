import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { parseWebsiteGoalsRecord } from "./parse";
import { WEBSITE_GOAL_SOURCE, type WebsiteGoalType, type WebsiteGoalsRecord } from "./types";

type WebsiteGoalsRow = {
  id: string;
  website_id: string;
  primary_goal_type: string;
  secondary_goal_type: string | null;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

const WEBSITE_GOALS_SELECT =
  "id, website_id, primary_goal_type, secondary_goal_type, note, source, created_at, updated_at";

function mapWebsiteGoalsRow(row: WebsiteGoalsRow): WebsiteGoalsRecord {
  const parsed = parseWebsiteGoalsRecord(row);
  if (!parsed) {
    throw new Error("Stored website goals were not readable.");
  }

  return parsed;
}

export async function findWebsiteGoals(
  websiteId: string,
): Promise<WebsiteGoalsRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("website_goals")
    .select(WEBSITE_GOALS_SELECT)
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load website goals: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapWebsiteGoalsRow(data as WebsiteGoalsRow);
}

export async function upsertWebsiteGoals(input: {
  websiteId: string;
  primaryType: WebsiteGoalType;
  secondaryType: WebsiteGoalType | null;
  note: string | null;
}): Promise<WebsiteGoalsRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("website_goals")
    .upsert(
      {
        website_id: input.websiteId,
        primary_goal_type: input.primaryType,
        secondary_goal_type: input.secondaryType,
        note: input.note,
        source: WEBSITE_GOAL_SOURCE,
        updated_at: now,
      },
      { onConflict: "website_id" },
    )
    .select(WEBSITE_GOALS_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to save website goals: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to save website goals: row was not returned.");
  }

  return mapWebsiteGoalsRow(data as WebsiteGoalsRow);
}
