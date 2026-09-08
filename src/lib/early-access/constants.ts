export const EARLY_ACCESS_ROLES = [
  "business-owner",
  "seo-professional",
  "agency",
  "other",
] as const;

export const EARLY_ACCESS_INTERESTS = [
  "seo",
  "ai",
  "content",
  "technical",
  "all",
] as const;

export type EarlyAccessRole = (typeof EARLY_ACCESS_ROLES)[number];
export type EarlyAccessInterest = (typeof EARLY_ACCESS_INTERESTS)[number];

export const EARLY_ACCESS_FIELD_LIMITS = {
  role: 50,
  interest: 50,
  website: 500,
  email: 254,
} as const;

export type EarlyAccessSubmission = {
  role: EarlyAccessRole;
  interest: EarlyAccessInterest;
  website: string | null;
  email: string;
};
