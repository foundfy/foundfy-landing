import { META_DESCRIPTION_MAX_LENGTH } from "./config";
import { ActionError, type ActionMutationSpec } from "./types";

export function buildMutationSpec(input: {
  targetUrl: string;
  proposedValue: string | null;
}): ActionMutationSpec {
  return {
    targetUrl: input.targetUrl,
    field: "meta_description",
    before: null,
    after: input.proposedValue,
  };
}

export function normalizeProposedMetaDescription(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ActionError("invalid_proposed_value", "Proposed meta description must be text.", 400);
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > META_DESCRIPTION_MAX_LENGTH) {
    throw new ActionError(
      "invalid_proposed_value",
      `Proposed meta description must be ${META_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      400,
    );
  }

  return normalized;
}

export function statusAfterProposedValue(proposedValue: string | null): "prepared" | "awaiting_approval" {
  return proposedValue ? "awaiting_approval" : "prepared";
}
