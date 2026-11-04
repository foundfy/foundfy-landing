import { readFileSync } from "node:fs";
import { evaluatePersistedManualSeoRegression } from "../src/lib/regression-safety/load";
import { formatOperatorRegressionReport } from "../src/lib/regression-safety/display";
import type { PersistedRegressionCheckInput } from "../src/lib/regression-safety/types";

function usage(): never {
  console.error(
    "Usage: tsx --env-file=.env.local scripts/check-regression-safety.ts <spec.json>",
  );
  console.error(
    "Spec requires websiteId, baselineCrawlId, verificationCrawlId, urls, and expectedChanges.",
  );
  process.exit(1);
}

function readSpec(path: string): PersistedRegressionCheckInput {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<PersistedRegressionCheckInput>;
  if (
    !raw.websiteId ||
    !raw.baselineCrawlId ||
    !raw.verificationCrawlId ||
    !Array.isArray(raw.urls) ||
    raw.urls.length === 0 ||
    !Array.isArray(raw.expectedChanges) ||
    raw.expectedChanges.length === 0
  ) {
    throw new Error(
      "Spec must include websiteId, baselineCrawlId, verificationCrawlId, non-empty urls, and non-empty expectedChanges.",
    );
  }

  return {
    websiteId: raw.websiteId,
    baselineCrawlId: raw.baselineCrawlId,
    verificationCrawlId: raw.verificationCrawlId,
    urls: raw.urls,
    expectedChanges: raw.expectedChanges,
    preserveFields: raw.preserveFields,
    originalFindingRuleKey: raw.originalFindingRuleKey,
  };
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) {
    usage();
  }

  const spec = readSpec(specPath);
  const report = await evaluatePersistedManualSeoRegression(spec);
  console.log(formatOperatorRegressionReport(report));
  if (report.verdict !== "pass") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
