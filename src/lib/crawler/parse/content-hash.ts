import { createHash } from "node:crypto";

export function hashNormalizedContent(normalizedText: string): string {
  return createHash("sha256").update(normalizedText).digest("hex");
}
