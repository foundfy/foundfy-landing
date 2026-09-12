"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useAnimatedPlaceholder } from "@/hooks/useAnimatedPlaceholder";
import { useCrawlPolling } from "@/hooks/useCrawlPolling";
import { useExplanationEnrichmentPolling } from "@/hooks/useExplanationEnrichmentPolling";
import { validateDomainInput } from "@/lib/analysis/domain";
import AnalysisAnalyzingView from "./AnalysisAnalyzingView";
import AnalysisResultsView from "./AnalysisResultsView";
import styles from "./WebsiteAnalysisEntry.module.css";

export default function WebsiteAnalysisEntry() {
  const {
    domain,
    phase,
    crawlRunId,
    websiteId,
    findings,
    findingsSummary,
    comparison,
    errorMessage,
    startAnalysis,
    resetAnalysis,
  } = useAnalysis();
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const animatedPlaceholder = useAnimatedPlaceholder(!input && !isFocused);
  const showAnimatedPlaceholder = !input && !isFocused;
  const isAnalyzing = phase === "starting" && !!domain;
  const isCompleted = phase === "completed" && !!domain;

  useCrawlPolling();
  useExplanationEnrichmentPolling();

  useEffect(() => {
    if (phase === "failed" && errorMessage) {
      setError(errorMessage);
      setHasSubmitted(true);
    }
  }, [phase, errorMessage]);

  const handleReset = () => {
    resetAnalysis();
    setInput("");
    setError(null);
    setHasSubmitted(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);

    const result = validateDomainInput(input);

    if (!result.valid) {
      setError(result.message);
      return;
    }

    setError(null);
    startAnalysis(result.normalized);
  };

  if (phase === "failed") {
    return (
      <div className={styles.wrapper}>
        <form
          className={`${styles.form} ${hasSubmitted && error ? styles.formInvalid : ""}`}
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={styles.inputShell}>
            {showAnimatedPlaceholder ? (
              <span className={styles.placeholder} aria-hidden="true">
                {animatedPlaceholder}
                <span className={styles.placeholderCursor} />
              </span>
            ) : null}
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              name="website"
              className={styles.input}
              placeholder=""
              aria-label="Website URL"
              value={input}
              aria-invalid={hasSubmitted && !!error}
              aria-describedby={error ? "website-analysis-error" : undefined}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(event) => {
                setInput(event.target.value);
                if (hasSubmitted) {
                  setError(null);
                  setHasSubmitted(false);
                }
              }}
            />
          </div>
          <button type="submit" className={styles.button}>
            Analyze
          </button>
        </form>
        {error ? (
          <p id="website-analysis-error" className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`${styles.wrapper} ${isCompleted ? styles.wrapperResults : ""}`.trim()}
    >
      {isAnalyzing ? (
        <AnalysisAnalyzingView onReset={handleReset} />
      ) : isCompleted ? (
        <AnalysisResultsView
          hostname={domain.hostname}
          findings={findings}
          findingsSummary={
            findingsSummary ?? {
              totalCount: findings.length,
              highlightedFindingIds: [],
              highlightGroups: [],
            }
          }
          comparison={comparison}
          crawlRunId={crawlRunId}
          websiteId={websiteId}
          onReset={handleReset}
        />
      ) : (
        <>
          <form
            className={`${styles.form} ${hasSubmitted && error ? styles.formInvalid : ""}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className={styles.inputShell}>
              {showAnimatedPlaceholder ? (
                <span className={styles.placeholder} aria-hidden="true">
                  {animatedPlaceholder}
                  <span className={styles.placeholderCursor} />
                </span>
              ) : null}
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                name="website"
                className={styles.input}
                placeholder=""
                aria-label="Website URL"
                value={input}
                aria-invalid={hasSubmitted && !!error}
                aria-describedby={error ? "website-analysis-error" : undefined}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (hasSubmitted) {
                    setError(null);
                    setHasSubmitted(false);
                  }
                }}
              />
            </div>
            <button type="submit" className={styles.button}>
              Analyze
            </button>
          </form>
          {error ? (
            <p id="website-analysis-error" className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
