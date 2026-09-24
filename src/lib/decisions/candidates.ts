import { DECISION_ENGINE_VERSION, DECISION_MAX_COUNT } from "./config";
import {
  bandForRank,
  combineScoring,
  evidenceConfidenceScore,
  hasAnySearchDemand,
  hasMeaningfulVisibility,
  isActionablePageObservation,
  isMultiPageObservation,
  issueImportance,
  searchDemandScore,
} from "./score";
import type {
  DecisionEngineInput,
  GscPageEvidenceInput,
  GoalSnapshot,
  ObservationInput,
  RankedDecision,
} from "./types";
import {
  actionTitleForRule,
  duplicateIssueTitle,
  inspectPageExplanation,
  inspectPageTitle,
  multiPageExplanation,
  pageIssueExplanation,
} from "./wording";

export type CandidateBuildInput = {
  engine: DecisionEngineInput;
  pages: GscPageEvidenceInput[];
  observations: ObservationInput[];
};

function maxImpressions(pages: GscPageEvidenceInput[]): number {
  return pages.reduce((max, page) => Math.max(max, page.impressions), 0);
}

function pagesById(pages: GscPageEvidenceInput[]): Map<string, GscPageEvidenceInput> {
  const map = new Map<string, GscPageEvidenceInput>();
  for (const page of pages) {
    if (page.pageId && !map.has(page.pageId)) {
      map.set(page.pageId, page);
    }
  }
  return map;
}

function sharedRefs(engine: DecisionEngineInput, goal: GoalSnapshot) {
  return [
    {
      kind: "crawl_run" as const,
      recordId: engine.crawlRunId,
      snapshot: {},
    },
    {
      kind: "gsc_sync" as const,
      recordId: engine.gscSearchSyncId,
      snapshot: {
        periodStart: engine.periodStart,
        periodEnd: engine.periodEnd,
        truncated: engine.gscTruncated,
      },
    },
    {
      kind: "site_model" as const,
      recordId: engine.siteModelId,
      snapshot: {},
    },
    {
      kind: "goal" as const,
      recordId: goal.id,
      snapshot: { primaryType: goal.primaryType },
    },
  ];
}

function gscSnapshot(page: GscPageEvidenceInput) {
  return {
    pageUrl: page.pageUrl,
    impressions: page.impressions,
    clicks: page.clicks,
  };
}

function duplicateGroupKey(observation: ObservationInput): string | null {
  if (observation.ruleKey === "page_fundamentals.duplicate_title") {
    const title =
      typeof observation.evidence.title === "string"
        ? observation.evidence.title.trim().toLowerCase()
        : "";
    return title ? `duplicate_title:${title}` : null;
  }

  if (observation.ruleKey === "page_fundamentals.duplicate_meta_description") {
    const description =
      typeof observation.evidence.metaDescription === "string"
        ? observation.evidence.metaDescription.trim().toLowerCase()
        : "";
    return description ? `duplicate_meta:${description}` : null;
  }

  return null;
}

function buildTypeC(input: CandidateBuildInput, maxDemand: number): RankedDecision[] {
  const gscPages = pagesById(input.pages);
  const groups = new Map<string, ObservationInput[]>();

  for (const observation of input.observations) {
    if (!isActionablePageObservation(observation) || !isMultiPageObservation(observation)) {
      continue;
    }

    const key = duplicateGroupKey(observation);
    if (!key) {
      continue;
    }

    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const candidates: RankedDecision[] = [];

  for (const group of groups.values()) {
    const visible = group.flatMap((observation) => {
      const page = observation.pageId ? gscPages.get(observation.pageId) : undefined;
      return page && hasAnySearchDemand(page)
        ? [{ observation, page }]
        : [];
    });

    if (visible.length < 2) {
      continue;
    }

    const demandPage = visible.reduce((best, item) =>
      item.page.impressions > best.page.impressions ? item : best,
    );
    const ruleKey = visible[0].observation.ruleKey as
      | "page_fundamentals.duplicate_title"
      | "page_fundamentals.duplicate_meta_description";
    const confidence = evidenceConfidenceScore({
      mapped: true,
      truncated: input.engine.gscTruncated,
    });
    const scoring = combineScoring({
      issueImportance: Math.max(...visible.map((item) => issueImportance(item.observation))),
      searchDemand: searchDemandScore(demandPage.page, maxDemand),
      evidenceConfidence: confidence.score,
    });

    candidates.push({
      decisionType: "multi_page_issue_with_visibility",
      title: duplicateIssueTitle(ruleKey, visible.length, demandPage.page.pageUrl),
      explanation: multiPageExplanation(visible[0].observation.title, visible.length),
      pageUrl: demandPage.page.pageUrl,
      pageId: demandPage.page.pageId,
      priorityBand: "next",
      rank: 0,
      scoring,
      confidence: confidence.confidence,
      evidenceRefs: [
        ...sharedRefs(input.engine, input.engine.goal),
        ...visible.flatMap((item) => [
          {
            kind: "observation" as const,
            recordId: item.observation.id,
            snapshot: { ruleKey: item.observation.ruleKey, title: item.observation.title },
          },
          {
            kind: "gsc_evidence" as const,
            recordId: item.page.id,
            snapshot: gscSnapshot(item.page),
          },
          ...(item.observation.pageId
            ? [
                {
                  kind: "page" as const,
                  recordId: item.observation.pageId,
                  snapshot: { pageUrl: item.observation.pageUrl },
                },
              ]
            : []),
        ]),
      ],
    });
  }

  return candidates;
}

function buildTypeA(
  input: CandidateBuildInput,
  maxDemand: number,
  consumedObservationIds: Set<string>,
): RankedDecision[] {
  const gscPages = pagesById(input.pages);
  const bestByPage = new Map<string, { observation: ObservationInput; page: GscPageEvidenceInput }>();

  for (const observation of input.observations) {
    if (
      !isActionablePageObservation(observation) ||
      consumedObservationIds.has(observation.id) ||
      !observation.pageId
    ) {
      continue;
    }

    const page = gscPages.get(observation.pageId);
    if (!page || !hasAnySearchDemand(page)) {
      continue;
    }

    const current = bestByPage.get(observation.pageId);
    if (
      !current ||
      issueImportance(observation) > issueImportance(current.observation) ||
      (issueImportance(observation) === issueImportance(current.observation) &&
        observation.ruleKey.localeCompare(current.observation.ruleKey) < 0)
    ) {
      bestByPage.set(observation.pageId, { observation, page });
    }
  }

  return [...bestByPage.values()].map(({ observation, page }) => {
    const confidence = evidenceConfidenceScore({
      mapped: true,
      truncated: input.engine.gscTruncated,
    });
    const scoring = combineScoring({
      issueImportance: issueImportance(observation),
      searchDemand: searchDemandScore(page, maxDemand),
      evidenceConfidence: confidence.score,
    });

    return {
      decisionType: "existing_demand_page_issue" as const,
      title: actionTitleForRule(observation.ruleKey, page.pageUrl),
      explanation: pageIssueExplanation(observation.title),
      pageUrl: page.pageUrl,
      pageId: page.pageId,
      priorityBand: "next" as const,
      rank: 0,
      scoring,
      confidence: confidence.confidence,
      evidenceRefs: [
        ...sharedRefs(input.engine, input.engine.goal),
        {
          kind: "observation" as const,
          recordId: observation.id,
          snapshot: { ruleKey: observation.ruleKey, title: observation.title },
        },
        {
          kind: "gsc_evidence" as const,
          recordId: page.id,
          snapshot: gscSnapshot(page),
        },
        {
          kind: "page" as const,
          recordId: observation.pageId as string,
          snapshot: { pageUrl: observation.pageUrl },
        },
      ],
    };
  });
}

function buildTypeB(input: CandidateBuildInput, maxDemand: number): RankedDecision[] {
  return input.pages
    .filter(
      (page) =>
        page.pageId == null && hasMeaningfulVisibility(page, maxDemand),
    )
    .map((page) => {
      const confidence = evidenceConfidenceScore({
        mapped: false,
        truncated: input.engine.gscTruncated,
      });
      const scoring = combineScoring({
        issueImportance: issueImportance(null),
        searchDemand: searchDemandScore(page, maxDemand),
        evidenceConfidence: confidence.score,
      });

      return {
        decisionType: "inspect_unanalyzed_page" as const,
        title: inspectPageTitle(page.pageUrl),
        explanation: inspectPageExplanation(),
        pageUrl: page.pageUrl,
        pageId: null,
        priorityBand: "next" as const,
        rank: 0,
        scoring,
        confidence: confidence.confidence,
        evidenceRefs: [
          ...sharedRefs(input.engine, input.engine.goal),
          {
            kind: "gsc_evidence" as const,
            recordId: page.id,
            snapshot: gscSnapshot(page),
          },
        ],
      };
    });
}

function compareDecisions(left: RankedDecision, right: RankedDecision): number {
  if (right.scoring.total !== left.scoring.total) {
    return right.scoring.total - left.scoring.total;
  }

  if (right.scoring.issueImportance !== left.scoring.issueImportance) {
    return right.scoring.issueImportance - left.scoring.issueImportance;
  }

  if (right.scoring.searchDemand !== left.scoring.searchDemand) {
    return right.scoring.searchDemand - left.scoring.searchDemand;
  }

  return (left.pageUrl ?? "").localeCompare(right.pageUrl ?? "");
}

export function buildRankedDecisions(input: CandidateBuildInput): RankedDecision[] {
  if (input.engine.engineVersion !== DECISION_ENGINE_VERSION) {
    return [];
  }

  const maxDemand = maxImpressions(input.pages);
  const typeC = buildTypeC(input, maxDemand);
  const consumed = new Set(
    typeC.flatMap((decision) =>
      decision.evidenceRefs.filter((ref) => ref.kind === "observation").map((ref) => ref.recordId),
    ),
  );
  const typeA = buildTypeA(input, maxDemand, consumed);
  const typeB = buildTypeB(input, maxDemand);

  return [...typeC, ...typeA, ...typeB]
    .sort(compareDecisions)
    .slice(0, DECISION_MAX_COUNT)
    .map((decision, index) => ({
      ...decision,
      rank: index + 1,
      priorityBand: bandForRank(index + 1),
    }));
}

export function emptyGscProducesNoDecisions(pages: GscPageEvidenceInput[]): boolean {
  return pages.length === 0 || pages.every((page) => page.impressions <= 0 && page.clicks <= 0);
}
