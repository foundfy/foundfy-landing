import { createHash } from "node:crypto";
import type { ResearchProviderEnvironment, ResearchProviderId } from "./types";

function canonicalList(values: string[]): string[] {
  return [...values].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }),
  );
}

export function researchRequestFingerprint(input: {
  websiteId: string;
  siteModelId: string;
  confirmedAt: string;
  offerings: string[];
  countryKey: string;
  languages: string[];
  provider: ResearchProviderId;
  environment: ResearchProviderEnvironment;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        websiteId: input.websiteId,
        siteModelId: input.siteModelId,
        confirmedAt: input.confirmedAt,
        offerings: canonicalList(input.offerings),
        countryKey: input.countryKey,
        languages: canonicalList(input.languages),
        provider: input.provider,
        environment: input.environment,
      }),
    )
    .digest("hex");
}
