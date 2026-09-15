"use client";

import { useState } from "react";
import { buildWebsiteGoalsView } from "@/lib/goals/display";
import type { WebsiteGoalFields, WebsiteGoalType, WebsiteGoalsRecord } from "@/lib/goals/types";
import styles from "./SitePageView.module.css";

type SiteGoalsSectionProps = {
  websiteId: string;
  goals: WebsiteGoalsRecord | null;
  onUpdated: () => Promise<void>;
};

export default function SiteGoalsSection({
  websiteId,
  goals,
  onUpdated,
}: SiteGoalsSectionProps) {
  const view = buildWebsiteGoalsView(goals);
  const [isEditing, setIsEditing] = useState(goals === null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<WebsiteGoalFields>({
    primaryType: goals?.primaryType ?? "",
    secondaryType: goals?.secondaryType ?? "",
    note: goals?.note ?? "",
  });
  const [showSecondary, setShowSecondary] = useState(Boolean(goals?.secondaryType));

  const startEditing = () => {
    setDraft({
      primaryType: goals?.primaryType ?? "",
      secondaryType: goals?.secondaryType ?? "",
      note: goals?.note ?? "",
    });
    setShowSecondary(Boolean(goals?.secondaryType));
    setErrorMessage(null);
    setIsEditing(true);
  };

  const save = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryType: draft.primaryType,
          secondaryType: showSecondary ? draft.secondaryType : "",
          note: draft.note,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Unable to save this.");
        return;
      }

      setIsEditing(false);
      await onUpdated();
    } catch {
      setErrorMessage("Unable to save this.");
    } finally {
      setIsSaving(false);
    }
  };

  const needsNote = draft.primaryType === "custom" || (showSecondary && draft.secondaryType === "custom");

  return (
    <section className={styles.section} aria-labelledby="site-goals">
      <div className={styles.sectionIntro}>
        <h2 id="site-goals" className={styles.sectionHeading}>
          {view.heading}
        </h2>
      </div>

      {isEditing ? (
        <form
          className={styles.interpretationForm}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className={styles.goalOptions}>
            <legend className={styles.goalLegend}>{view.promptCopy}</legend>
            {view.options.map((option) => (
              <label key={option.type} className={styles.goalOption}>
                <input
                  type="radio"
                  name="primary-goal"
                  value={option.type}
                  checked={draft.primaryType === option.type}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      primaryType: option.type,
                      secondaryType:
                        current.secondaryType === option.type ? "" : current.secondaryType,
                    }))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          {showSecondary ? (
            <fieldset className={styles.goalOptions}>
              <legend className={styles.goalLegend}>{view.secondaryPrompt}</legend>
              {view.options
                .filter((option) => option.type !== draft.primaryType)
                .map((option) => (
                  <label key={option.type} className={styles.goalOption}>
                    <input
                      type="radio"
                      name="secondary-goal"
                      value={option.type}
                      checked={draft.secondaryType === option.type}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          secondaryType: option.type as WebsiteGoalType,
                        }))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              <button
                className={styles.textButton}
                type="button"
                onClick={() => {
                  setShowSecondary(false);
                  setDraft((current) => ({ ...current, secondaryType: "" }));
                }}
              >
                Remove the second thing
              </button>
            </fieldset>
          ) : (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => setShowSecondary(true)}
            >
              Add one more, if useful
            </button>
          )}

          <label className={styles.interpretationLabel}>
            {needsNote ? "What should happen, in a sentence." : view.notePrompt}
            <textarea
              className={styles.interpretationInput}
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({ ...current, note: event.target.value }))
              }
              rows={3}
              maxLength={280}
              required={needsNote}
            />
          </label>

          <div className={styles.interpretationActions}>
            <button className={styles.scanButton} type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : view.saveLabel}
            </button>
            {goals ? (
              <button
                className={styles.textButton}
                type="button"
                disabled={isSaving}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className={styles.understandingBlock}>
          {view.narrative ? (
            <p className={styles.interpretationLead}>{view.narrative}</p>
          ) : null}
          {view.noteCopy ? (
            <p className={styles.understandingNote}>{view.noteCopy}</p>
          ) : null}
          <div className={styles.interpretationActions}>
            <button className={styles.textButton} type="button" onClick={startEditing}>
              {view.editLabel}
            </button>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
