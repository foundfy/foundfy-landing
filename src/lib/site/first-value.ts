import { formatCompletedScopeCopy } from "@/lib/analysis/analysis-scope";
import type { AnalysisFinding, PriorityLevel } from "@/lib/analysis/crawl-status";
import {
  formatAffectedPagesPhrase,
  formatFindingPath,
  formatGroupedProblemTitle,
} from "@/lib/analysis/finding-display";
import {
  buildResultsDisplayModel,
  type GroupedFindingCard,
} from "@/lib/analysis/results-display-model";
import { interpretFoundationNextStep } from "@/lib/foundations/evaluate";
import type {
  CrawlFoundationsAssessment,
  FoundationNextStepCode,
  GoogleIndexingEvidenceInput,
  GooglePerformanceEvidenceInput,
} from "@/lib/foundations/types";
import type { WebsiteOverview } from "@/lib/websites/types";
import { formatSiteScanDate } from "./site-overview-view-model";

export const FIRST_VALUE_HEADING = "Where things stand";
export const FIRST_VALUE_COMPLETED_HEADING = "What Foundfy has completed";
export const FIRST_VALUE_ATTENTION_HEADING = "Needs attention";
export const FIRST_VALUE_NOTES_HEADING = "Recorded notes";
export const FIRST_VALUE_UNKNOWN_HEADING = "What remains unknown";
export const FIRST_VALUE_NEXT_HEADING = "What happens next";
export const FIRST_VALUE_OWNER_HEADING = "Is anything required from you now?";

export const GOOGLE_INDEXING_UNKNOWN =
  "Google indexing is not checked yet. Check Google indexing reads the version known to Google's index. It is not a live URL test, and it does not ask Google to index the site.";

export const GOOGLE_PERFORMANCE_LOADING =
  "Foundfy is still checking whether Google search performance is available in this view.";

export const GOOGLE_SYNC_CLARIFICATION =
  "Sync Google search data refreshes performance numbers Foundfy can already load. It does not ask Google to index your pages, and Foundfy does not run it on a schedule.";

export type FirstValueCapabilityKind =
  | "completed_work"
  | "confirmed_issue"
  | "owner_action_supported"
  | "no_immediate_action"
  | "capability_not_available";

export type FirstValueNote = {
  key: string;
  ruleKey: string;
  title: string;
  explanation: string;
  affectedPageCount: number;
  affectedUrls: string[];
  pageLabels: string[];
  priorityLevel: PriorityLevel | null;
  severity: AnalysisFinding["severity"];
  classification: "attention" | "note";
};

export type FirstValueNextStep = {
  kind: FirstValueCapabilityKind;
  code: FoundationNextStepCode | "review_scan_findings" | "google_performance_loading";
  message: string;
  evidence: string;
};

export type FirstValueOwnerNeed = {
  required: boolean;
  message: string;
};

export type FirstValueView = {
  heading: string;
  completedHeading: string;
  completedBody: string;
  attentionHeading: string;
  attention: FirstValueNote[];
  attentionCards: GroupedFindingCard[];
  notesHeading: string;
  notes: FirstValueNote[];
  unknownHeading: string;
  unknownBody: string;
  nextHeading: string;
  nextStep: FirstValueNextStep;
  ownerHeading: string;
  ownerNeed: FirstValueOwnerNeed;
  googleSyncClarification: string | null;
  latestScanHrefLabel: boolean;
};

const TITLE_LENGTH_RULE = "page_fundamentals.title_length_out_of_range";

const REVIEW_CODES = new Set<FoundationNextStepCode>([
  "review_homepage_block",
  "review_fetch_error",
  "review_indexability_block",
  "review_sitemap_urls",
]);

function findingsForOverview(overview: WebsiteOverview): AnalysisFinding[] {
  const latest = overview.latestUsableScan;
  if (!latest) {
    return [];
  }

  return latest.findings.length > 0 ? latest.findings : overview.highlightedFindings;
}

function pageLabels(urls: string[]): string[] {
  return urls.map((url) => formatFindingPath(url) ?? url);
}

function explainNote(card: GroupedFindingCard): string {
  const title = formatGroupedProblemTitle(
    card.finding.ruleKey,
    card.finding.title,
    card.affectedPageCount,
  );
  const pages = formatAffectedPagesPhrase(card.affectedPageCount);
  const lead = pages ? `${title} ${pages}` : title;

  if (card.finding.ruleKey === TITLE_LENGTH_RULE) {
    return `${lead}. This is a recorded scan note about title length, not a technical blocker for search discovery.`;
  }

  return `${lead}. This is a recorded scan note. Foundfy is not treating it as the current technical blocker.`;
}

function toNote(
  card: GroupedFindingCard,
  classification: "attention" | "note",
): FirstValueNote {
  return {
    key: card.key,
    ruleKey: card.finding.ruleKey,
    title: card.title,
    explanation: explainNote(card),
    affectedPageCount: card.affectedPageCount,
    affectedUrls: card.affectedUrls,
    pageLabels: pageLabels(card.affectedUrls),
    priorityLevel: card.finding.priority?.level ?? null,
    severity: card.finding.severity,
    classification,
  };
}

function completedBody(overview: WebsiteOverview): string {
  const latest = overview.latestUsableScan;
  if (!latest) {
    return "Foundfy has not completed a usable scan for this site yet. Failed or in-progress scans do not replace a successful baseline.";
  }

  const date = formatSiteScanDate(latest.completedAt);
  const scope = formatCompletedScopeCopy(latest.pagesCrawled);
  return `Foundfy completed a website scan on ${date}. ${scope}. Opening the website and recording that scan is completed work, not an SEO job. Technical SEO Foundations lists what that scan verified.`;
}

function indexingUnknownLine(indexing: GoogleIndexingEvidenceInput | null): string {
  if (indexing == null || indexing.kind === "not_checked") {
    return GOOGLE_INDEXING_UNKNOWN;
  }

  if (indexing.kind === "no_session") {
    return "Google indexing is unavailable in this view. Connect Google to check the version known to Google's index.";
  }

  if (indexing.kind === "not_connected") {
    return "Search Console is not connected, so Foundfy cannot check Google indexing.";
  }

  if (indexing.kind === "expired") {
    return "Google access expired. Connect Google again to check indexing. That is not a missing owner session.";
  }

  if (indexing.kind === "unavailable") {
    return "Foundfy could not load Google indexing data right now. That is not an indexing result.";
  }

  const homepage = indexing.urls.find((url) => url.role === "homepage");
  if (homepage?.verdict === "indexed") {
    return "Google reports the homepage as indexed. That is the version known to Google's index, not a live URL test.";
  }

  if (homepage?.verdict === "not_indexed") {
    return `Google reports the homepage is not indexed${homepage.reason ? ` (${homepage.reason})` : ""}. That is the version known to Google's index, not a live URL test.`;
  }

  if (indexing.urls.some((url) => url.verdict === "indexed")) {
    return "Google reports at least one inspected page as indexed. That is the version known to Google's index, not a live URL test.";
  }

  return "Google did not clearly report whether these pages are indexed. That is not a live URL test.";
}

function unknownBody(
  google: GooglePerformanceEvidenceInput | null,
  indexing: GoogleIndexingEvidenceInput | null,
): string {
  const indexingLine = indexingUnknownLine(indexing);

  if (google === null) {
    return `${indexingLine} ${GOOGLE_PERFORMANCE_LOADING}`;
  }

  switch (google.kind) {
    case "empty":
      return `${indexingLine} Search Console synced, but reported no queries in the current window. Empty search performance is not an indexing result.`;
    case "reported":
      return `${indexingLine} Google has reported search performance for this site. That still is not an indexing check by itself.`;
    case "not_synced":
      return `${indexingLine} Search Console is connected, but Foundfy has not loaded search performance for this site yet.`;
    case "not_connected":
      return `${indexingLine} Search Console is not connected in this session.`;
    case "no_session":
      return `${indexingLine} Search performance is unavailable in this view. Connect Google to see what Google reports.`;
    case "unavailable":
      return `${indexingLine} Foundfy could not load Google search analytics right now. That is not an indexing result.`;
  }
}

function kindFromFoundation(code: FoundationNextStepCode): FirstValueCapabilityKind {
  if (REVIEW_CODES.has(code)) {
    return "confirmed_issue";
  }

  if (code === "no_scan" || code === "connect_google_for_performance") {
    return "owner_action_supported";
  }

  if (code === "sync_google_performance") {
    return "owner_action_supported";
  }

  if (code === "google_not_connected" || code === "google_unavailable") {
    return code === "google_unavailable"
      ? "capability_not_available"
      : "owner_action_supported";
  }

  if (code === "wait_for_google_discovery") {
    return "no_immediate_action";
  }

  if (code === "check_google_indexing" || code === "review_google_indexing") {
    return "owner_action_supported";
  }

  if (code === "indexing_not_checked") {
    return "no_immediate_action";
  }

  return "no_immediate_action";
}

function composeNextStep(input: {
  crawl: CrawlFoundationsAssessment | null;
  google: GooglePerformanceEvidenceInput | null;
  indexing: GoogleIndexingEvidenceInput | null;
  attentionCount: number;
  notesCount: number;
}): FirstValueNextStep {
  const { crawl, google, indexing, attentionCount, notesCount } = input;
  const noteClause =
    notesCount > 0
      ? "The recorded notes above were evaluated and are not the current technical blocker. "
      : "";

  if (attentionCount > 0) {
    const foundation = interpretFoundationNextStep(crawl, google, indexing);
    if (REVIEW_CODES.has(foundation.code)) {
      return {
        kind: "confirmed_issue",
        code: foundation.code,
        message: foundation.message,
        evidence: "crawl foundations plus highlight-level findings from the latest scan",
      };
    }

    return {
      kind: "confirmed_issue",
      code: "review_scan_findings",
      message:
        "Review the issue listed under Needs attention. Foundfy has not started a change on the website, and it has not checked whether Google has listed these pages.",
      evidence: "highlight-level findings from the latest scan",
    };
  }

  if (google === null && crawl?.crawlRunId) {
    return {
      kind: "capability_not_available",
      code: "google_performance_loading",
      message: `${noteClause}${GOOGLE_PERFORMANCE_LOADING} ${
        indexing?.kind === "checked"
          ? "Google indexing already has a result in this view."
          : "Google indexing remains not checked."
      }`,
      evidence: "owner observe API has not finished loading in this view",
    };
  }

  const foundation = interpretFoundationNextStep(crawl, google, indexing);
  return {
    kind: kindFromFoundation(foundation.code),
    code: foundation.code,
    message: `${noteClause}${foundation.message}`,
    evidence: `foundations interpreter ${foundation.code}`,
  };
}

function ownerNeed(input: {
  next: FirstValueNextStep;
  attentionCount: number;
  notesCount: number;
}): FirstValueOwnerNeed {
  if (input.attentionCount > 0 || input.next.kind === "confirmed_issue") {
    return {
      required: true,
      message:
        "Yes. Review the issue under Needs attention. Foundfy has not started a change on the website.",
    };
  }

  if (input.next.code === "no_scan") {
    return {
      required: true,
      message:
        "Yes. Run a scan so Foundfy can check this website. Foundfy is not scanning it in the background.",
    };
  }

  if (input.next.code === "connect_google_for_performance") {
    return {
      required: false,
      message:
        "No verified technical change is required from you for this scan. You can connect Google to see search performance. That is optional, and it does not make Google index the site.",
    };
  }

  if (input.next.code === "google_not_connected") {
    return {
      required: false,
      message:
        "No verified technical change is required from you for this scan. Search Console is not connected. Connecting it is optional and does not make Google index the site.",
    };
  }

  if (input.next.code === "sync_google_performance") {
    return {
      required: false,
      message:
        "No verified technical change is required from you for this scan. You can load Google search performance with Sync. Foundfy does not run that automatically, and it does not ask Google to index the site.",
    };
  }

  if (input.next.code === "google_unavailable") {
    return {
      required: false,
      message:
        "No verified technical change is required from you for this scan. Google search analytics could not be loaded right now. That is not an indexing result.",
    };
  }

  if (input.next.code === "review_google_indexing") {
    return {
      required: true,
      message:
        "Yes. Review Google indexing. Foundfy has not started a change on the website, and it has not asked Google to index the site.",
    };
  }

  if (input.next.code === "check_google_indexing") {
    return {
      required: false,
      message:
        "No verified technical change is required from you for this scan. You can check Google indexing. Foundfy does not run that automatically, and it does not ask Google to index the site.",
    };
  }

  if (input.next.code === "google_performance_loading") {
    return {
      required: false,
      message:
        input.notesCount > 0
          ? "The recorded notes were evaluated and are not a required website change. Foundfy is still checking whether Google search performance is available in this view."
          : "Foundfy is still checking whether Google search performance is available in this view. No website change has been identified yet from the scan sample.",
    };
  }

  const notesClause =
    input.notesCount > 0
      ? " The recorded notes remain visible if you want to tidy them later."
      : "";

  return {
    required: false,
    message: `No verified technical change is required from you for this scan.${notesClause} Foundfy is not running further website checks in the background.`,
  };
}

function googleSyncClarification(
  google: GooglePerformanceEvidenceInput | null,
): string | null {
  if (
    google?.kind === "empty" ||
    google?.kind === "not_synced" ||
    google?.kind === "reported"
  ) {
    return GOOGLE_SYNC_CLARIFICATION;
  }

  return null;
}

export function buildFirstValueView(
  overview: WebsiteOverview,
  google: GooglePerformanceEvidenceInput | null,
  indexing: GoogleIndexingEvidenceInput | null = null,
): FirstValueView {
  const latest = overview.latestUsableScan;
  const findings = findingsForOverview(overview);
  const model = latest
    ? buildResultsDisplayModel(findings, latest.findingsSummary, latest.searchPresence)
    : null;
  const highlightKeys = new Set((model?.highlightCards ?? []).map((card) => card.key));
  const attentionCards = model?.highlightCards ?? [];
  const notes = (model?.allFindingCards ?? [])
    .filter((card) => !highlightKeys.has(card.key))
    .map((card) => toNote(card, "note"));
  const attention = attentionCards.map((card) => toNote(card, "attention"));
  const crawl = latest?.foundations ?? null;
  const nextStep = composeNextStep({
    crawl,
    google,
    indexing,
    attentionCount: attention.length,
    notesCount: notes.length,
  });

  return {
    heading: FIRST_VALUE_HEADING,
    completedHeading: FIRST_VALUE_COMPLETED_HEADING,
    completedBody: completedBody(overview),
    attentionHeading: FIRST_VALUE_ATTENTION_HEADING,
    attention,
    attentionCards,
    notesHeading: FIRST_VALUE_NOTES_HEADING,
    notes,
    unknownHeading: FIRST_VALUE_UNKNOWN_HEADING,
    unknownBody: unknownBody(google, indexing),
    nextHeading: FIRST_VALUE_NEXT_HEADING,
    nextStep,
    ownerHeading: FIRST_VALUE_OWNER_HEADING,
    ownerNeed: ownerNeed({
      next: nextStep,
      attentionCount: attention.length,
      notesCount: notes.length,
    }),
    googleSyncClarification: googleSyncClarification(google),
    latestScanHrefLabel: Boolean(latest),
  };
}

export function firstValueCopyBlob(view: FirstValueView): string {
  return [
    view.heading,
    view.completedHeading,
    view.completedBody,
    view.attentionHeading,
    ...view.attention.map((note) => `${note.title} ${note.explanation}`),
    view.notesHeading,
    ...view.notes.map((note) => `${note.title} ${note.explanation}`),
    view.unknownHeading,
    view.unknownBody,
    view.nextHeading,
    view.nextStep.message,
    view.ownerHeading,
    view.ownerNeed.message,
    view.googleSyncClarification ?? "",
  ].join(" ");
}
