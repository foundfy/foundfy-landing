import { requireObserveOwner } from "@/lib/gsc/observe";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";
import { loadResearchForOwner } from "./load";
import { closeResearchRun, findResearchRunForWebsite } from "./repository";
import type { ResearchOwnerView } from "./types";

export type CloseResearchInput = {
  websiteId: string;
  runId: string;
  sessionToken: string | null;
  env?: NodeJS.ProcessEnv;
};

export async function closeResearchForOwner(
  input: CloseResearchInput,
): Promise<ResearchOwnerView> {
  await requireObserveOwner(input);
  const existing = await findResearchRunForWebsite({
    runId: input.runId,
    websiteId: input.websiteId,
  });
  if (!existing) {
    throw new ResearchGateError("not_closeable", researchGate("not_closeable").message, 404);
  }

  const result = await closeResearchRun({
    runId: input.runId,
    websiteId: input.websiteId,
  });

  if (result.outcome === "not_found" || !result.run) {
    throw new ResearchGateError("not_closeable", researchGate("not_closeable").message, 404);
  }
  if (result.outcome === "recovery_busy") {
    throw new ResearchGateError("recovery_busy", researchGate("recovery_busy").message, 409);
  }
  if (result.outcome === "not_closeable") {
    throw new ResearchGateError("not_closeable", researchGate("not_closeable").message, 409);
  }

  return loadResearchForOwner(input);
}
