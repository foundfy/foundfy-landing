import { findLatestConfirmedSiteModelForWebsite } from "@/lib/site-model/repository";
import { getWebsiteById } from "@/lib/websites/repository";
import { parseWebsiteGoalFields } from "./parse";
import { upsertWebsiteGoals } from "./repository";
import type { WebsiteGoalsRecord } from "./types";

export async function saveWebsiteGoals(input: {
  websiteId: string;
  primaryType: unknown;
  secondaryType?: unknown;
  note?: unknown;
}): Promise<WebsiteGoalsRecord> {
  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  const confirmed = await findLatestConfirmedSiteModelForWebsite(input.websiteId);
  if (!confirmed?.confirmed) {
    throw new Error("Confirm what Foundfy understands about this site first.");
  }

  const fields = parseWebsiteGoalFields(input);

  return upsertWebsiteGoals({
    websiteId: input.websiteId,
    primaryType: fields.primaryType,
    secondaryType: fields.secondaryType,
    note: fields.note,
  });
}
