"use client";

import { useState } from "react";
import { buildSiteUnderstandingView } from "@/lib/site-model/display";
import { buildSiteInterpretationView } from "@/lib/site-model/interpretation/display";
import type { SiteInterpretationFields, SiteModelRecord } from "@/lib/site-model/types";
import styles from "./SitePageView.module.css";

type SiteUnderstandingSectionProps = {
  websiteId: string;
  siteModel: SiteModelRecord;
  onUpdated: () => Promise<void>;
};

function fieldsToLines(values: string[]): string {
  return values.join("\n");
}

function linesToFields(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SiteUnderstandingSection({
  websiteId,
  siteModel,
  onUpdated,
}: SiteUnderstandingSectionProps) {
  const interpretation = buildSiteInterpretationView(siteModel);
  const evidence = buildSiteUnderstandingView(siteModel);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<SiteInterpretationFields>(interpretation.fields);

  const startEditing = () => {
    setDraft(interpretation.fields);
    setErrorMessage(null);
    setIsEditing(true);
  };

  const saveConfirmation = async (fields: SiteInterpretationFields) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Unable to save this understanding.");
        return;
      }

      setIsEditing(false);
      await onUpdated();
    } catch {
      setErrorMessage("Unable to save this understanding.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="site-understanding">
      <div className={styles.sectionIntro}>
        <h2 id="site-understanding" className={styles.sectionHeading}>
          {interpretation.heading}
          {siteModel.confirmed ? (
            <span className={styles.confirmedMark} aria-hidden="true">
              {" "}
              ✓
            </span>
          ) : null}
        </h2>
        <p className={styles.sectionMeta}>{interpretation.statusLabel}</p>
      </div>

      {isEditing ? (
        <form
          className={styles.interpretationForm}
          onSubmit={(event) => {
            event.preventDefault();
            void saveConfirmation(draft);
          }}
        >
          <label className={styles.interpretationLabel}>
            What is this site?
            <textarea
              className={styles.interpretationInput}
              value={draft.siteDescription}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  siteDescription: event.target.value,
                }))
              }
              rows={4}
              required
            />
          </label>
          <label className={styles.interpretationLabel}>
            What it appears to offer or publish
            <textarea
              className={styles.interpretationInput}
              value={fieldsToLines(draft.offers)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  offers: linesToFields(event.target.value),
                }))
              }
              rows={3}
              placeholder="One item per line. Leave blank if this is not clear."
            />
          </label>
          <label className={styles.interpretationLabel}>
            Who should find it
            <textarea
              className={styles.interpretationInput}
              value={fieldsToLines(draft.audiences)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  audiences: linesToFields(event.target.value),
                }))
              }
              rows={3}
              placeholder="One item per line. Leave blank if this is not clear."
            />
          </label>
          <label className={styles.interpretationLabel}>
            Locations, if the site makes them clear
            <textarea
              className={styles.interpretationInput}
              value={fieldsToLines(draft.locations)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  locations: linesToFields(event.target.value),
                }))
              }
              rows={2}
              placeholder="Leave blank unless a place is actually stated."
            />
          </label>
          <div className={styles.interpretationActions}>
            <button className={styles.scanButton} type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save and confirm"}
            </button>
            <button
              className={styles.textButton}
              type="button"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.understandingBlock}>
          {interpretation.narrative ? (
            <p className={styles.interpretationLead}>{interpretation.narrative}</p>
          ) : (
            <p className={styles.understandingCopy}>
              Foundfy does not have a draft interpretation yet. The crawl evidence is below.
            </p>
          )}
          {interpretation.uncertaintyPreview.map((note) => (
            <p key={note} className={styles.understandingNote}>
              {note}
            </p>
          ))}
          {interpretation.askCopy ? (
            <p className={styles.interpretationAsk}>{interpretation.askCopy}</p>
          ) : null}
          <div className={styles.interpretationActions}>
            {interpretation.canConfirm ? (
              <button
                className={styles.scanButton}
                type="button"
                disabled={isSaving}
                onClick={() => void saveConfirmation(interpretation.fields)}
              >
                {isSaving ? "Saving…" : "Yes, that’s right"}
              </button>
            ) : null}
            <button
              className={styles.textButton}
              type="button"
              disabled={isSaving}
              onClick={startEditing}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <details className={styles.evidenceDetails}>
        <summary className={styles.evidenceSummary}>{interpretation.whySummary}</summary>
        <div className={styles.understandingBlock}>
          <p className={styles.sectionMeta}>{evidence.sampleCopy}</p>
          {evidence.coverageCopy ? (
            <p className={styles.sectionMeta}>{evidence.coverageCopy}</p>
          ) : null}

          <h3 className={styles.subsectionHeading}>URL types in this sample</h3>
          <p className={styles.understandingCopy}>{evidence.pageTypeSummary}</p>

          <h3 className={styles.subsectionHeading}>Fetched pages</h3>
          <ol className={styles.understandingPageList}>
            {evidence.pages.map((page) => (
              <li key={page.pageId} className={styles.understandingPageItem}>
                <p className={styles.understandingPageTitle}>
                  {page.pathLabel}
                  <span className={styles.understandingPageClass}>
                    {page.pathClassLabel}
                  </span>
                </p>
                {page.title ? (
                  <p className={styles.understandingCopy}>Title: {page.title}</p>
                ) : (
                  <p className={styles.understandingCopy}>No title stored.</p>
                )}
                {page.h1.length > 0 ? (
                  <p className={styles.understandingCopy}>H1: {page.h1.join(" · ")}</p>
                ) : null}
                {page.excerptPreview ? (
                  <p className={styles.understandingExcerpt}>{page.excerptPreview}</p>
                ) : null}
              </li>
            ))}
          </ol>

          <h3 className={styles.subsectionHeading}>Languages observed</h3>
          <p className={styles.understandingCopy}>{evidence.languagesCopy}</p>

          <h3 className={styles.subsectionHeading}>Navigation labels</h3>
          <p className={styles.understandingCopy}>{evidence.navigationCopy}</p>

          <h3 className={styles.subsectionHeading}>Structured data stored</h3>
          <p className={styles.understandingCopy}>{evidence.structuredDataCopy}</p>

          <h3 className={styles.subsectionHeading}>robots.txt and sitemap</h3>
          <p className={styles.understandingCopy}>{evidence.discoveryCopy}</p>

          <p className={styles.understandingNote}>{evidence.confirmationNote}</p>
          {interpretation.uncertainty.map((note) => (
            <p key={note} className={styles.understandingNote}>
              {note}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
