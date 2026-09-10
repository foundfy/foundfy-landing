import { normalizeDomainInput } from "../src/lib/analysis/domain";
import {
  isUsableCompletedCrawl,
  normalizeCrawlStatusForApiResponse,
} from "../src/lib/crawler/crawl-usability";
import { findPreviousCompletedCrawlRun } from "../src/lib/findings/comparison/previous-crawl";

async function main() {
  const wwwSeed = normalizeDomainInput("https://www.arngren.net");
  const legacyZeroPageId = "6380777a-2599-4f95-9334-e32553c49e04";
  const healthyBaselineId = "2dfa4485-ded9-4cae-911f-3a62cf199d3c";

  const legacyApiShape = normalizeCrawlStatusForApiResponse({
    status: "completed",
    pagesCrawled: 0,
    errorMessage: null,
  });

  const baseline = await findPreviousCompletedCrawlRun({
    websiteId: "9e2f8796-5da5-4325-bde0-5d504fe8e99a",
    currentCrawlRunId: "00000000-0000-4000-8000-000000000099",
  }).catch(() => null);

  console.log(
    JSON.stringify(
      {
        wwwSeed,
        legacyZeroPage: {
          id: legacyZeroPageId,
          usableAsCompletedAnalysis: isUsableCompletedCrawl({
            status: "completed",
            pagesCrawled: 0,
          }),
          apiResponseStatus: legacyApiShape.status,
          apiResponseErrorMessage: legacyApiShape.errorMessage,
          qualifiesAsComparisonBaseline: false,
        },
        expectedHealthyBaselineAfterWalkBack: healthyBaselineId,
        latestUsableBaselineLookup:
          baseline?.id === legacyZeroPageId
            ? "FAIL: zero-page crawl selected"
            : baseline?.id ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
