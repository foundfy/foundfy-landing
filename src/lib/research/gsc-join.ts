import { opportunityCompactKey } from "@/lib/opportunities/normalize";
import type { CurrentGscSampleStatus, InitialGscSampleStatus } from "./types";

export function gscQueryCompactSet(queries: string[]): Set<string> {
  const keys = new Set<string>();
  for (const query of queries) {
    const compact = opportunityCompactKey(query);
    if (compact) {
      keys.add(compact);
    }
  }

  return keys;
}

export function classifyGscSampleStatus(
  keyword: string,
  queryKeys: Set<string>,
): InitialGscSampleStatus {
  const compact = opportunityCompactKey(keyword);
  return compact && queryKeys.has(compact)
    ? "in_current_gsc_sample"
    : "not_in_current_gsc_sample";
}

export function currentGscSampleStatus(input: {
  keyword: string;
  queryKeys: Set<string> | null;
}): CurrentGscSampleStatus {
  if (!input.queryKeys) {
    return "gsc_unavailable";
  }

  return classifyGscSampleStatus(input.keyword, input.queryKeys);
}
