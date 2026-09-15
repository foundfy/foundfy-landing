import { isAiEnrichmentEnabled } from "@/lib/ai-enrichment/config";
import type { SiteModelRecord } from "../types";
import { parseSiteInterpretationDraft } from "./parse";
import { generateOpenAiSiteInterpretation } from "./generate";
import { hashSiteInterpretationEvidence } from "./hash";
import { updateDraftInterpretation } from "../repository";

export async function scheduleSiteInterpretationIfNeeded(
  siteModel: SiteModelRecord | null,
): Promise<void> {
  if (!siteModel || siteModel.status !== "draft") {
    return;
  }

  if (!isAiEnrichmentEnabled()) {
    return;
  }

  const current = parseSiteInterpretationDraft(siteModel.interpretation);
  const evidenceHash = hashSiteInterpretationEvidence({
    understanding: siteModel.understanding,
    evidence: siteModel.evidence,
  });

  if (
    current?.generator === "openai" &&
    current.status === "ready" &&
    current.evidenceHash === evidenceHash
  ) {
    return;
  }

  try {
    const interpretation = await generateOpenAiSiteInterpretation({
      understanding: siteModel.understanding,
      evidence: siteModel.evidence,
    });
    await updateDraftInterpretation({
      id: siteModel.id,
      interpretation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Site interpretation generation failed.";
    console.error("[Site Interpretation] Async generation failed:", message);
  }
}
