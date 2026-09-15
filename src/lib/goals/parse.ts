import {
  WEBSITE_GOAL_NOTE_MAX_LENGTH,
  WEBSITE_GOAL_SOURCE,
  WEBSITE_GOAL_TYPES,
  type WebsiteGoalFields,
  type WebsiteGoalType,
  type WebsiteGoalsRecord,
} from "./types";

export function isWebsiteGoalType(value: unknown): value is WebsiteGoalType {
  return (
    typeof value === "string" &&
    (WEBSITE_GOAL_TYPES as readonly string[]).includes(value)
  );
}

function normalizeNote(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, WEBSITE_GOAL_NOTE_MAX_LENGTH);
}

export function normalizeWebsiteGoalFields(input: {
  primaryType: unknown;
  secondaryType?: unknown;
  note?: unknown;
}): WebsiteGoalFields {
  const primaryType = isWebsiteGoalType(input.primaryType) ? input.primaryType : "";
  const secondaryType = isWebsiteGoalType(input.secondaryType) ? input.secondaryType : "";
  const note = normalizeNote(input.note) ?? "";

  return {
    primaryType,
    secondaryType: secondaryType === primaryType ? "" : secondaryType,
    note,
  };
}

export function parseWebsiteGoalFields(input: {
  primaryType: unknown;
  secondaryType?: unknown;
  note?: unknown;
}): {
  primaryType: WebsiteGoalType;
  secondaryType: WebsiteGoalType | null;
  note: string | null;
} {
  const fields = normalizeWebsiteGoalFields(input);

  if (!fields.primaryType) {
    throw new Error("Choose what should happen when the right people find this site.");
  }

  const secondaryType = fields.secondaryType || null;
  const note = fields.note.trim() ? fields.note.trim().slice(0, WEBSITE_GOAL_NOTE_MAX_LENGTH) : null;
  const needsNote = fields.primaryType === "custom" || secondaryType === "custom";

  if (needsNote && !note) {
    throw new Error("Add a short note so Foundfy knows what “something else” means.");
  }

  return {
    primaryType: fields.primaryType,
    secondaryType,
    note,
  };
}

export function parseWebsiteGoalsRecord(value: unknown): WebsiteGoalsRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const primaryType = record.primaryType ?? record.primary_goal_type;
  const secondaryType = record.secondaryType ?? record.secondary_goal_type;
  const note = record.note;
  const websiteId =
    typeof record.websiteId === "string"
      ? record.websiteId
      : typeof record.website_id === "string"
        ? record.website_id
        : "";
  const id = typeof record.id === "string" ? record.id : "";
  const declaredAt =
    typeof record.declaredAt === "string"
      ? record.declaredAt
      : typeof record.created_at === "string"
        ? record.created_at
        : "";
  const updatedAt =
    typeof record.updatedAt === "string"
      ? record.updatedAt
      : typeof record.updated_at === "string"
        ? record.updated_at
        : declaredAt;

  if (!id || !websiteId || !isWebsiteGoalType(primaryType) || !declaredAt) {
    return null;
  }

  return {
    id,
    websiteId,
    primaryType,
    secondaryType: isWebsiteGoalType(secondaryType) ? secondaryType : null,
    note: normalizeNote(note),
    source: WEBSITE_GOAL_SOURCE,
    declaredAt,
    updatedAt,
  };
}
