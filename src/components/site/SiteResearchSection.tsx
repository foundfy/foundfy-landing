"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RESEARCH_CLOSE_HELP_COPY,
  RESEARCH_CLOSE_LABEL,
  RESEARCH_CLOSED_COPY,
  RESEARCH_COUNTRY_LABEL,
  RESEARCH_CTA_LABEL,
  RESEARCH_DISABLED_COPY,
  researchEmptyCopy,
  RESEARCH_ERROR_COPY,
  RESEARCH_EVIDENCE_LABEL,
  RESEARCH_IN_SAMPLE_COPY,
  RESEARCH_INTERRUPTED_COPY,
  RESEARCH_LANGUAGE_LABEL,
  RESEARCH_NEW_CYCLE_HELP_COPY,
  RESEARCH_NEW_CYCLE_LABEL,
  RESEARCH_NO_REPLAY_COPY,
  RESEARCH_NO_SAFE_RETRY_COPY,
  RESEARCH_NOT_IN_SAMPLE_COPY,
  RESEARCH_PARTIAL_COPY,
  RESEARCH_RESUME_UNATTEMPTED_LABEL,
  RESEARCH_RETRIEVED_LABEL,
  RESEARCH_SECTION_COPY,
  RESEARCH_SECTION_HEADING,
  RESEARCH_SOURCE_OFFERING_LABEL,
  RESEARCH_STALE_COPY,
  RESEARCH_TEST_DATA_COPY,
  RESEARCH_TRUNCATED_COPY,
  RESEARCH_VOLUME_LABEL,
  currentGscSampleCopy,
  formatEstimatedMonthlySearches,
  formatResearchRetrievedAt,
} from "@/lib/research/display";
import type { ResearchOwnerView } from "@/lib/research/types";
import styles from "./SitePageView.module.css";

type SiteResearchSectionProps = {
  websiteId: string;
  refreshKey?: number;
};

export default function SiteResearchSection({
  websiteId,
  refreshKey = 0,
}: SiteResearchSectionProps) {
  const [view, setView] = useState<ResearchOwnerView | null>(null);
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [countryKey, setCountryKey] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/research`, {
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        setVisible(false);
        setView(null);
        return;
      }

      const payload = (await response.json()) as ResearchOwnerView & { error?: string };
      if (!response.ok) {
        setVisible(true);
        setErrorMessage(payload.error ?? RESEARCH_ERROR_COPY);
        return;
      }

      if (!payload.readiness?.surfaceVisible) {
        setVisible(false);
        setView(null);
        setErrorMessage(null);
        return;
      }

      setVisible(true);
      setView(payload);
      setErrorMessage(null);
      if (payload.readiness.requiresOfferingSelection) {
        setSelectedOfferings([]);
      } else {
        setSelectedOfferings(payload.readiness.validOfferings);
      }
    } catch {
      setVisible(false);
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const languageChoices = view?.readiness.languages ?? [];
  const offeringChoices = view?.readiness.validOfferings ?? [];
  const requiresSelection = view?.readiness.requiresOfferingSelection ?? false;

  const canSubmit = useMemo(() => {
    if (!view?.readiness.executionAvailable) {
      return false;
    }

    if (!countryKey) {
      return false;
    }

    if (selectedLanguages.length < 1 || selectedLanguages.length > 3) {
      return false;
    }

    if (requiresSelection && (selectedOfferings.length < 1 || selectedOfferings.length > 5)) {
      return false;
    }

    return true;
  }, [view, countryKey, selectedLanguages, selectedOfferings, requiresSelection]);

  const submit = async () => {
    if (!view) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/websites/${websiteId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryKey,
          languages: selectedLanguages,
          selectedOfferings: requiresSelection ? selectedOfferings : undefined,
        }),
      });
      const payload = (await response.json()) as ResearchOwnerView & {
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.error ?? RESEARCH_ERROR_COPY);
        return;
      }

      setView(payload);
    } catch {
      setErrorMessage(RESEARCH_ERROR_COPY);
    } finally {
      setIsSaving(false);
    }
  };

  const closeRun = async () => {
    if (!view?.run?.canClose) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/websites/${websiteId}/research/${view.run.id}/close`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ResearchOwnerView & {
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.error ?? RESEARCH_ERROR_COPY);
        return;
      }

      setView(payload);
    } catch {
      setErrorMessage(RESEARCH_ERROR_COPY);
    } finally {
      setIsSaving(false);
    }
  };

  const recover = async () => {
    if (!view?.run?.canResumeUnattempted) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/websites/${websiteId}/research/${view.run.id}/recover`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ResearchOwnerView & {
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.error ?? RESEARCH_ERROR_COPY);
        return;
      }

      setView(payload);
    } catch {
      setErrorMessage(RESEARCH_ERROR_COPY);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) {
    return null;
  }

  if (!view) {
    if (!errorMessage) {
      return null;
    }

    return (
      <section className={styles.section} aria-labelledby="site-research">
        <h2 id="site-research" className={styles.sectionHeading}>
          {RESEARCH_SECTION_HEADING}
        </h2>
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      </section>
    );
  }

  const gate = view.readiness.gate;
  const run = view.run;
  const recoveryOwnsCta = Boolean(run?.displayInterrupted);
  const showForm =
    !recoveryOwnsCta &&
    (!gate ||
      gate.code === "no_research_country" ||
      gate.code === "no_research_language" ||
      gate.code === "offering_selection_required" ||
      view.readiness.executionAvailable);
  const startLabel = run?.canStartNewCycle ? RESEARCH_NEW_CYCLE_LABEL : RESEARCH_CTA_LABEL;

  return (
    <section className={styles.section} aria-labelledby="site-research">
      <div className={styles.sectionIntro}>
        <h2 id="site-research" className={styles.sectionHeading}>
          {RESEARCH_SECTION_HEADING}
        </h2>
        <p className={styles.sectionMeta}>{RESEARCH_SECTION_COPY}</p>
      </div>

      {gate && !view.readiness.executionAvailable ? (
        <div className={styles.understandingBlock}>
          <p className={styles.understandingCopy}>{gate.message}</p>
          {gate.code === "no_confirmed_site_model" || gate.code === "no_valid_offering" ? (
            <p className={styles.emptyStateAction}>
              <a className={styles.fullAnalysisLink} href={view.readiness.understandingHref}>
                Confirm offerings
              </a>
            </p>
          ) : null}
          {gate.code === "live_not_enabled" || gate.code === "credentials_missing" ? (
            <p className={styles.sectionMeta}>{RESEARCH_DISABLED_COPY}</p>
          ) : null}
        </div>
      ) : null}

      {showForm && view.readiness.validOfferings.length > 0 ? (
        <form
          className={styles.interpretationForm}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {requiresSelection ? (
            <fieldset className={styles.goalOptions}>
              <legend className={styles.goalLegend}>Confirmed offerings</legend>
              {offeringChoices.map((offering) => (
                <label key={offering} className={styles.goalOption}>
                  <input
                    type="checkbox"
                    checked={selectedOfferings.includes(offering)}
                    onChange={() => {
                      setSelectedOfferings((current) =>
                        current.includes(offering)
                          ? current.filter((item) => item !== offering)
                          : current.length >= 5
                            ? current
                            : [...current, offering],
                      );
                    }}
                  />
                  {offering}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className={styles.understandingCopy}>
              {RESEARCH_SOURCE_OFFERING_LABEL}: {offeringChoices.join("; ")}
            </p>
          )}

          <label className={styles.interpretationLabel}>
            {RESEARCH_COUNTRY_LABEL}
            <select
              className={styles.interpretationInput}
              value={countryKey}
              onChange={(event) => setCountryKey(event.target.value)}
              required
            >
              <option value="">Choose a country</option>
              {view.readiness.countries.map((country) => (
                <option key={country.key} value={country.key}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={styles.goalOptions}>
            <legend className={styles.goalLegend}>{RESEARCH_LANGUAGE_LABEL}</legend>
            {languageChoices.map((language) => (
              <label key={language.code} className={styles.goalOption}>
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(language.code)}
                  onChange={() => {
                    setSelectedLanguages((current) =>
                      current.includes(language.code)
                        ? current.filter((item) => item !== language.code)
                        : current.length >= 3
                          ? current
                          : [...current, language.code],
                    );
                  }}
                />
                {language.name} ({language.code})
              </label>
            ))}
          </fieldset>

          {run?.canStartNewCycle ? (
            <p className={styles.sectionMeta}>{RESEARCH_NEW_CYCLE_HELP_COPY}</p>
          ) : null}
          <div className={styles.interpretationActions}>
            <button
              className={styles.scanButton}
              type="submit"
              disabled={isSaving || !canSubmit}
            >
              {isSaving ? "Researching…" : startLabel}
            </button>
          </div>
        </form>
      ) : null}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {run ? (
        <div className={styles.understandingBlock}>
          {run.isTestData ? <p className={styles.researchBanner}>{RESEARCH_TEST_DATA_COPY}</p> : null}
          {run.stale ? <p className={styles.sectionMeta}>{RESEARCH_STALE_COPY}</p> : null}
          {run.displayClosed ? (
            <div className={styles.understandingBlock}>
              <p className={styles.researchBanner}>{RESEARCH_CLOSED_COPY}</p>
              {run.incomplete ? (
                <p className={styles.sectionMeta}>{RESEARCH_PARTIAL_COPY}</p>
              ) : null}
            </div>
          ) : run.displayInterrupted ? (
            <div className={styles.understandingBlock}>
              <p className={styles.researchBanner}>{RESEARCH_INTERRUPTED_COPY}</p>
              <p className={styles.sectionMeta}>{RESEARCH_NO_REPLAY_COPY}</p>
              {run.canResumeUnattempted ? (
                <div className={styles.interpretationActions}>
                  <button
                    className={styles.scanButton}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      void recover();
                    }}
                  >
                    {isSaving ? "Resuming…" : RESEARCH_RESUME_UNATTEMPTED_LABEL}
                  </button>
                </div>
              ) : (
                <p className={styles.sectionMeta}>{RESEARCH_NO_SAFE_RETRY_COPY}</p>
              )}
              {run.canClose ? (
                <div className={styles.interpretationActions}>
                  <p className={styles.sectionMeta}>{RESEARCH_CLOSE_HELP_COPY}</p>
                  <button
                    className={styles.scanButton}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      void closeRun();
                    }}
                  >
                    {isSaving ? "Closing…" : RESEARCH_CLOSE_LABEL}
                  </button>
                </div>
              ) : null}
            </div>
          ) : run.incomplete ? (
            <p className={styles.sectionMeta}>{RESEARCH_PARTIAL_COPY}</p>
          ) : null}
          {run.ideas.length === 0 ? (
            <p className={styles.understandingCopy}>{researchEmptyCopy(run.emptyOutcome)}</p>
          ) : (
            <ol className={styles.opportunityList}>
              {run.ideas.map((idea) => {
                const volume = formatEstimatedMonthlySearches(
                  idea.estimatedMonthlySearches,
                  run.providerEnvironment,
                );
                return (
                  <li key={idea.id} className={styles.opportunityItem}>
                    <p className={styles.opportunityQuery}>{idea.keyword}</p>
                    {volume ? (
                      <p className={styles.opportunityMetrics}>
                        {RESEARCH_VOLUME_LABEL}: {volume}
                      </p>
                    ) : (
                      <p className={styles.opportunityMetrics}>{RESEARCH_VOLUME_LABEL}</p>
                    )}
                    <p className={styles.understandingCopy}>
                      {currentGscSampleCopy(idea.currentGscSampleStatus)}
                    </p>
                    <details className={styles.evidenceDetails}>
                      <summary className={styles.evidenceSummary}>{RESEARCH_EVIDENCE_LABEL}</summary>
                      <div className={styles.decisionWhyBody}>
                        <p className={styles.understandingCopy}>
                          {RESEARCH_SOURCE_OFFERING_LABEL}: {idea.seedOffering}
                        </p>
                        <p className={styles.understandingCopy}>
                          {RESEARCH_COUNTRY_LABEL}: {idea.countryName}
                        </p>
                        <p className={styles.understandingCopy}>
                          {RESEARCH_LANGUAGE_LABEL}: {idea.languageCode}
                        </p>
                        <p className={styles.understandingCopy}>
                          {RESEARCH_RETRIEVED_LABEL}: {formatResearchRetrievedAt(idea.retrievedAt)}
                        </p>
                        <p className={styles.sectionMeta}>
                          {idea.currentGscSampleStatus === "in_current_gsc_sample"
                            ? RESEARCH_IN_SAMPLE_COPY
                            : idea.currentGscSampleStatus === "not_in_current_gsc_sample"
                              ? RESEARCH_NOT_IN_SAMPLE_COPY
                              : currentGscSampleCopy(idea.currentGscSampleStatus)}
                        </p>
                        {run.currentGscQueriesTruncated || run.gscQueriesTruncatedAtRetrieval ? (
                          <p className={styles.sectionMeta}>{RESEARCH_TRUNCATED_COPY}</p>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
