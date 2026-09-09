import { evaluateIndexability } from "./evaluators/indexability";
import { evaluateInternalStructure } from "./evaluators/internal-structure";
import { evaluatePageFundamentals } from "./evaluators/page-fundamentals";
import { evaluateSiteDiscovery } from "./evaluators/site-discovery";
import type { CrawlEvidenceContext, ObservationDraft } from "./types";

export function generateObservationDrafts(context: CrawlEvidenceContext): ObservationDraft[] {
  return [
    ...evaluateIndexability(context),
    ...evaluatePageFundamentals(context),
    ...evaluateInternalStructure(context),
    ...evaluateSiteDiscovery(context),
  ];
}
