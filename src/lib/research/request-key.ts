import { createHash } from "node:crypto";

const REQUEST_KEY_PATTERN = /^[a-f0-9]{64}$/;

export function researchRequestKey(seedOffering: string, languageCode: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: 1,
        seedOffering,
        languageCode,
      }),
    )
    .digest("hex");
}

export function isResearchRequestKey(value: unknown): value is string {
  return typeof value === "string" && REQUEST_KEY_PATTERN.test(value);
}

export function requestKeyMatchesPair(
  requestKey: string,
  seedOffering: string,
  languageCode: string,
): boolean {
  return requestKey === researchRequestKey(seedOffering, languageCode);
}
