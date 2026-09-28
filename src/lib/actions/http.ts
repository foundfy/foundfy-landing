import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { ObserveAuthError } from "@/lib/gsc/types";
import { ActionError } from "./types";

export function actionErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ActionError) {
    return observeJson({ error: error.message, reason: error.code }, error.status);
  }

  if (error instanceof ObserveAuthError) {
    return observeJson({ error: error.message }, error.status);
  }

  return observeErrorResponse(error, fallback);
}
