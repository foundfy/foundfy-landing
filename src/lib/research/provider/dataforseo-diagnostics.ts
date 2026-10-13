import type { ResearchProviderErrorCode } from "../errors";
import type { DataForSeoRequestCategory } from "./hosts";

export function logDataForSeoHttp(input: {
  category: DataForSeoRequestCategory;
  httpStatus?: number;
  errorCode?: ResearchProviderErrorCode;
}): void {
  const payload: Record<string, unknown> = {
    category: input.category,
  };
  if (input.httpStatus !== undefined) {
    payload.httpStatus = input.httpStatus;
  }
  if (input.errorCode) {
    payload.errorCode = input.errorCode;
    console.error("[Research] DataForSEO HTTP", payload);
    return;
  }

  console.info("[Research] DataForSEO HTTP", payload);
}

export function logDataForSeoMetadata(input: {
  category: "locations" | "languages";
  stage: "requested" | "parsed" | "failed";
  topLevelStatusCode?: number | null;
  taskStatusCode?: number | null;
  resultCount?: number;
  parsedCount?: number;
  errorCode?: ResearchProviderErrorCode;
}): void {
  const payload: Record<string, unknown> = {
    category: input.category,
    stage: input.stage,
  };
  if (input.topLevelStatusCode !== undefined) {
    payload.topLevelStatusCode = input.topLevelStatusCode;
  }
  if (input.taskStatusCode !== undefined) {
    payload.taskStatusCode = input.taskStatusCode;
  }
  if (input.resultCount !== undefined) {
    payload.resultCount = input.resultCount;
  }
  if (input.parsedCount !== undefined) {
    payload.parsedCount = input.parsedCount;
  }
  if (input.errorCode) {
    payload.errorCode = input.errorCode;
  }

  if (input.stage === "failed") {
    console.error("[Research] DataForSEO metadata", payload);
    return;
  }

  console.info("[Research] DataForSEO metadata", payload);
}

export async function loadDataForSeoMetadata<T>(input: {
  category: "locations" | "languages";
  request: () => Promise<unknown>;
  parse: (payload: unknown) => T;
}): Promise<T> {
  logDataForSeoMetadata({ category: input.category, stage: "requested" });
  return input.parse(await input.request());
}
