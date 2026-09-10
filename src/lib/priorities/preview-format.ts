import type { StoredObservation } from "@/lib/observations/types";
import type { PriorityDraft, StoredPriority } from "./types";

function formatPath(pageUrl: string | null | undefined): string {
  if (!pageUrl) {
    return "/";
  }

  try {
    const url = new URL(pageUrl);
    return url.pathname || "/";
  } catch {
    return pageUrl;
  }
}

export function formatPriorityPreviewLine(input: {
  priority: PriorityDraft | StoredPriority;
  observation?: StoredObservation;
}): string {
  const level = input.priority.priorityLevel.toUpperCase().padEnd(8, " ");
  const score = String(input.priority.priorityScore).padStart(3, " ");
  const rule = input.priority.ruleKey.padEnd(38, " ");
  const path = formatPath(input.observation?.pageUrl);

  return `${score} ${level} ${rule} ${path}`;
}
