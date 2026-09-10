import { createHash } from "node:crypto";
import type { ExplanationInputFinding } from "./types";

export function hashExplanationInput(input: {
  promptVersion: string;
  hostname: string;
  pagesCrawled: number;
  finding: ExplanationInputFinding;
}): string {
  const payload = JSON.stringify({
    promptVersion: input.promptVersion,
    hostname: input.hostname,
    pagesCrawled: input.pagesCrawled,
    finding: input.finding,
  });

  return createHash("sha256").update(payload).digest("hex");
}
