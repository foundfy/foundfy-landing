/**
 * Local live smoke test for Phase 3 AI explanation enrichment.
 * Usage: tsx --env-file=.env.local scripts/smoke-ai-enrichment-live.ts [baseUrl] [crawlUrl]
 */

import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";
import {
  getOpenAiEnrichmentModel,
  isAiEnrichmentEnabled,
} from "../src/lib/ai-enrichment/config";
import { listExplanationEnrichments } from "../src/lib/ai-enrichment/db/repository";
import { generateExplanationEnrichments } from "../src/lib/ai-enrichment/explanation/generate";
import type { AnalysisFinding } from "../src/lib/analysis/crawl-status";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_CRAWL_URL = "https://arngren.net";

const HIGHLIGHT_LEVELS = new Set(["critical", "high", "medium"]);

type CrawlPayload = {
  id?: string;
  status?: string;
  hostname?: string;
  pagesCrawled?: number;
  findings?: AnalysisFinding[];
  findingsSummary?: {
    highlightedFindingIds: string[];
  };
  explanationEnrichmentStatus?: string;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
}

async function verifyPrerequisites(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("finding_ai_explanations")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(
      `finding_ai_explanations table check failed: ${error.message}`,
    );
  }

  const aiEnabled = isAiEnrichmentEnabled();
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
  const model = getOpenAiEnrichmentModel();

  console.log(
    JSON.stringify(
      {
        findingAiExplanationsTable: "ok",
        aiEnrichmentEnabled: aiEnabled,
        openAiApiKeyPresent: apiKeyPresent,
        configuredEnrichmentModel: model,
      },
      null,
      2,
    ),
  );

  if (!aiEnabled) {
    throw new Error("AI_ENRICHMENT_ENABLED is not true.");
  }

  if (!apiKeyPresent) {
    throw new Error("OPENAI_API_KEY is missing.");
  }
}

async function pollCrawl(
  baseUrl: string,
  crawlRunId: string,
  options: {
    untilComplete?: boolean;
    untilEnrichmentReady?: boolean;
    maxPolls?: number;
    intervalMs?: number;
  },
): Promise<CrawlPayload> {
  const maxPolls = options.maxPolls ?? 60;
  const intervalMs = options.intervalMs ?? 3000;
  let last: CrawlPayload = {};

  for (let i = 0; i < maxPolls; i += 1) {
    const response = await fetch(`${baseUrl}/api/crawl/${crawlRunId}`, {
      cache: "no-store",
    });
    last = (await response.json()) as CrawlPayload;

    if (!response.ok) {
      throw new Error(
        `Crawl poll failed (${response.status}): ${JSON.stringify(last)}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          poll: i + 1,
          status: last.status,
          pagesCrawled: last.pagesCrawled,
          highlightedCount:
            last.findingsSummary?.highlightedFindingIds.length ?? 0,
          explanationEnrichmentStatus: last.explanationEnrichmentStatus,
        },
        null,
        2,
      ),
    );

    if (last.status === "failed") {
      throw new Error(`Crawl failed: ${JSON.stringify(last)}`);
    }

    if (last.status === "completed") {
      if (!options.untilEnrichmentReady) {
        return last;
      }

      if (
        last.explanationEnrichmentStatus === "ready" ||
        last.explanationEnrichmentStatus === "failed"
      ) {
        return last;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `Polling timed out. Last payload: ${JSON.stringify(last, null, 2)}`,
  );
}

async function verifyCacheSkipsSecondProviderCall(input: {
  crawlRunId: string;
  hostname: string;
  pagesCrawled: number;
  findings: AnalysisFinding[];
  highlightedFindingIds: string[];
}): Promise<{ providerCallCount: number; enrichmentRowsUnchanged: boolean }> {
  const beforeRows = await listExplanationEnrichments(input.crawlRunId);
  let providerCallCount = 0;

  await generateExplanationEnrichments({
    crawlRunId: input.crawlRunId,
    hostname: input.hostname,
    pagesCrawled: input.pagesCrawled,
    findings: input.findings,
    findingIds: input.highlightedFindingIds,
    provider: {
      model: "cache-test-should-not-run",
      async generateExplanations() {
        providerCallCount += 1;
        return [];
      },
    },
  });

  const afterRows = await listExplanationEnrichments(input.crawlRunId);
  const enrichmentRowsUnchanged =
    JSON.stringify(beforeRows) === JSON.stringify(afterRows);

  return { providerCallCount, enrichmentRowsUnchanged };
}

async function main() {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  const crawlUrl = process.argv[3] ?? DEFAULT_CRAWL_URL;

  console.log("=== Phase 3 AI enrichment live smoke test ===");
  await verifyPrerequisites();

  console.log("\n--- Starting crawl ---");
  console.log(JSON.stringify({ baseUrl, crawlUrl }, null, 2));

  const postResponse = await fetch(`${baseUrl}/api/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: crawlUrl }),
    cache: "no-store",
  });
  const postBody = (await postResponse.json()) as { crawlRunId?: string; error?: string };

  if (!postResponse.ok || !postBody.crawlRunId) {
    throw new Error(
      `Failed to start crawl (${postResponse.status}): ${JSON.stringify(postBody)}`,
    );
  }

  const crawlRunId = postBody.crawlRunId;
  console.log(JSON.stringify({ crawlRunId }, null, 2));

  const completedPayload = await pollCrawl(baseUrl, crawlRunId, {
    untilComplete: true,
    maxPolls: 60,
    intervalMs: 3000,
  });

  const findings = completedPayload.findings ?? [];
  const highlightedIds =
    completedPayload.findingsSummary?.highlightedFindingIds ?? [];
  const highlightedFindings = findings.filter((finding) =>
    highlightedIds.includes(finding.id),
  );

  if (highlightedFindings.length === 0) {
    throw new Error(
      `No highlighted findings (MEDIUM/HIGH/CRITICAL). Findings: ${JSON.stringify(
        findings.map((f) => ({
          id: f.id,
          ruleKey: f.ruleKey,
          priority: f.priority?.level ?? null,
        })),
        null,
        2,
      )}`,
    );
  }

  const deterministicSnapshot = findings.map((finding) => ({
    id: finding.id,
    ruleKey: finding.ruleKey,
    title: finding.title,
    priorityLevel: finding.priority?.level ?? null,
    priorityRank: finding.priority?.rank ?? null,
  }));

  console.log("\n--- Deterministic results (before enrichment) ---");
  console.log(JSON.stringify(deterministicSnapshot, null, 2));

  const firstCompletedHasEnrichment = highlightedFindings.some(
    (finding) => !finding.explanationEnrichment,
  );
  console.log(
    JSON.stringify(
      {
        crawlCompletedIndependently: completedPayload.status === "completed",
        deterministicFindingsAvailable: findings.length > 0,
        enrichmentNotBlockingInitialResponse: firstCompletedHasEnrichment,
        explanationEnrichmentStatusOnFirstComplete:
          completedPayload.explanationEnrichmentStatus,
      },
      null,
      2,
    ),
  );

  console.log("\n--- Waiting for async enrichment ---");
  const enrichedPayload = await pollCrawl(baseUrl, crawlRunId, {
    untilComplete: true,
    untilEnrichmentReady: true,
    maxPolls: 40,
    intervalMs: 3000,
  });

  if (enrichedPayload.explanationEnrichmentStatus === "failed") {
    const rows = await listExplanationEnrichments(crawlRunId);
    throw new Error(
      `Enrichment failed. DB rows: ${JSON.stringify(rows, null, 2)}`,
    );
  }

  const enrichedFindings = enrichedPayload.findings ?? [];
  const targetFinding = enrichedFindings.find(
    (finding) =>
      highlightedIds.includes(finding.id) && finding.explanationEnrichment,
  );

  if (!targetFinding?.explanationEnrichment) {
    throw new Error(
      "Expected at least one highlighted finding with explanationEnrichment attached.",
    );
  }

  const dbRows = await listExplanationEnrichments(crawlRunId);
  const readyRows = dbRows.filter((row) => row.status === "ready");
  const targetDbRow = readyRows.find(
    (row) => row.findingId === targetFinding.id,
  );

  if (!targetDbRow) {
    throw new Error(
      `No ready DB row for finding ${targetFinding.id}. Rows: ${JSON.stringify(dbRows, null, 2)}`,
    );
  }

  const citedKeys = targetFinding.explanationEnrichment.citedEvidenceKeys;
  const whitelistedKeys = new Set(Object.keys(targetFinding.evidence ?? {}));
  const invalidCitedKeys = citedKeys.filter((key) => !whitelistedKeys.has(key));

  if (invalidCitedKeys.length > 0) {
    throw new Error(
      `Cited evidence keys not in finding evidence: ${invalidCitedKeys.join(", ")}`,
    );
  }

  const deterministicUnchanged = JSON.stringify(
    enrichedFindings.map((finding) => ({
      id: finding.id,
      ruleKey: finding.ruleKey,
      title: finding.title,
      priorityLevel: finding.priority?.level ?? null,
      priorityRank: finding.priority?.rank ?? null,
    })),
  ) === JSON.stringify(deterministicSnapshot);

  console.log("\n--- Re-fetch / cache verification ---");
  const refetchResponse = await fetch(`${baseUrl}/api/crawl/${crawlRunId}`, {
    cache: "no-store",
  });
  const refetchPayload = (await refetchResponse.json()) as CrawlPayload;

  const cacheCheck = await verifyCacheSkipsSecondProviderCall({
    crawlRunId,
    hostname: enrichedPayload.hostname ?? "",
    pagesCrawled: enrichedPayload.pagesCrawled ?? 0,
    findings: enrichedFindings,
    highlightedFindingIds: highlightedIds,
  });

  const report = {
    testTarget: crawlUrl,
    crawlRunId,
    deterministicFinding: {
      id: targetFinding.id,
      ruleKey: targetFinding.ruleKey,
      title: targetFinding.title,
      priority: targetFinding.priority?.level ?? null,
    },
    configuredModel: getOpenAiEnrichmentModel(),
    persistedModel: targetDbRow.model,
    contextualExplanation:
      targetFinding.explanationEnrichment.contextualExplanation,
    evidenceExplanation:
      targetFinding.explanationEnrichment.evidenceExplanation,
    citedEvidenceKeys: citedKeys,
    persistenceStatus: targetDbRow.status,
    refetchExplanationEnrichmentStatus:
      refetchPayload.explanationEnrichmentStatus,
    cacheResult: {
      providerCallCountOnRegenerate: cacheCheck.providerCallCount,
      enrichmentRowsUnchanged: cacheCheck.enrichmentRowsUnchanged,
      secondOpenAiRequestSkipped:
        cacheCheck.providerCallCount === 0 &&
        cacheCheck.enrichmentRowsUnchanged,
    },
    deterministicResultsUnchanged: deterministicUnchanged,
    uiExplainFurtherAvailable: Boolean(targetFinding.explanationEnrichment),
  };

  console.log("\n=== Smoke test report ===");
  console.log(JSON.stringify(report, null, 2));

  if (
    cacheCheck.providerCallCount !== 0 ||
    !cacheCheck.enrichmentRowsUnchanged ||
    !deterministicUnchanged
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown smoke test failure";
  console.error(redactSecrets(message));
  process.exit(1);
});
