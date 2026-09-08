import {
  EARLY_ACCESS_FIELD_LIMITS,
  EARLY_ACCESS_INTERESTS,
  EARLY_ACCESS_ROLES,
  type EarlyAccessSubmission,
} from "./constants";

const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const ALLOWED_KEYS = new Set(["role", "interest", "website", "email"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeOptionalWebsite(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export type EarlyAccessValidationResult =
  | { ok: true; data: EarlyAccessSubmission }
  | { ok: false; error: string };

export function validateEarlyAccessPayload(
  payload: unknown,
): EarlyAccessValidationResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid submission." };
  }

  const record = payload as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: "Invalid submission." };
    }
  }

  if (!isNonEmptyString(record.role)) {
    return { ok: false, error: "Please select what best describes you." };
  }

  if (!isNonEmptyString(record.interest)) {
    return { ok: false, error: "Please select what you are most interested in." };
  }

  if (!isNonEmptyString(record.email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const role = record.role.trim();
  const interest = record.interest.trim();
  const email = record.email.trim().toLowerCase();
  const website = normalizeOptionalWebsite(record.website);

  if (role.length > EARLY_ACCESS_FIELD_LIMITS.role) {
    return { ok: false, error: "Invalid submission." };
  }

  if (interest.length > EARLY_ACCESS_FIELD_LIMITS.interest) {
    return { ok: false, error: "Invalid submission." };
  }

  if (email.length > EARLY_ACCESS_FIELD_LIMITS.email) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (website && website.length > EARLY_ACCESS_FIELD_LIMITS.website) {
    return { ok: false, error: "Website is too long." };
  }

  if (!(EARLY_ACCESS_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Please select what best describes you." };
  }

  if (!(EARLY_ACCESS_INTERESTS as readonly string[]).includes(interest)) {
    return { ok: false, error: "Please select what you are most interested in." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  return {
    ok: true,
    data: {
      role: role as EarlyAccessSubmission["role"],
      interest: interest as EarlyAccessSubmission["interest"],
      website,
      email,
    },
  };
}
