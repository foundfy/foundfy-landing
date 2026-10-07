import { ACTION_PROPOSED_VALUE_MAX_LENGTH } from "./config";
import { ActionError, type ActionField, type ActionMutationSpec } from "./types";

export function buildMutationSpec(input: {
  targetUrl: string;
  field: ActionField;
  before: string | null;
  proposedValue: string | null;
}): ActionMutationSpec {
  if (input.field === "title") {
    return {
      targetUrl: input.targetUrl,
      field: "title",
      before: input.before,
      after: input.proposedValue,
    };
  }

  return {
    targetUrl: input.targetUrl,
    field: "meta_description",
    before: null,
    after: input.proposedValue,
  };
}

function normalizeProposedText(value: unknown, noun: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ActionError("invalid_proposed_value", `Proposed ${noun} must be text.`, 400);
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > ACTION_PROPOSED_VALUE_MAX_LENGTH) {
    throw new ActionError(
      "invalid_proposed_value",
      `Proposed ${noun} must be ${ACTION_PROPOSED_VALUE_MAX_LENGTH} characters or fewer.`,
      400,
    );
  }

  return normalized;
}

export function normalizeProposedMetaDescription(value: unknown): string | null {
  return normalizeProposedText(value, "meta description");
}

export function normalizeProposedTitle(value: unknown): string | null {
  return normalizeProposedText(value, "page title");
}

export function normalizeProposedValue(value: unknown, field: ActionField): string | null {
  return field === "title"
    ? normalizeProposedTitle(value)
    : normalizeProposedMetaDescription(value);
}

export function statusAfterProposedValue(proposedValue: string | null): "prepared" | "awaiting_approval" {
  return proposedValue ? "awaiting_approval" : "prepared";
}
