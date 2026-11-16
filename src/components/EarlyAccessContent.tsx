"use client";

import { FocusEvent, FormEvent, KeyboardEvent, ReactNode, useState } from "react";
import { useAnalysis } from "@/contexts/AnalysisContext";
import {
  getEarlyAccessCopy,
  getWebsiteStepError,
  resolveAnalyzedHostname,
  resolveEmailStepSubmit,
  resolveWebsitePrefill,
  resolveWebsiteStepAdvance,
  resolveWebsiteStepKeyDown,
} from "@/lib/early-access/form";
import { isValidEarlyAccessEmail } from "@/lib/early-access/validation";
import type { EarlyAccessFormCopy } from "@/lib/i18n/landing/types";
import Reveal from "./Reveal";
import styles from "./EarlyAccess.module.css";

// Submitted values stay the same in every language; only the labels change.
const ROLE_VALUES = ["business-owner", "seo-professional", "agency", "other"] as const;

const INTEREST_VALUES = ["seo", "ai", "content", "technical", "all"] as const;

type Step = 1 | 2 | 3 | 4;
type ChoiceOption = { value: string; label: string };

const EXIT_MS = 340;
const ENTER_MS = 520;

function getLabel(options: readonly ChoiceOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

type CompletedStepProps = {
  stepNum: string;
  label: string;
  value: string;
  onEdit: () => void;
};

function CompletedStep({ stepNum, label, value, onEdit }: CompletedStepProps) {
  return (
    <button type="button" className={styles.stepCompleted} onClick={onEdit}>
      <p className={styles.completedMeta}>
        <span>{stepNum}</span>
        {label}
      </p>
      <p className={styles.completedValue}>
        <span>{value}</span>
        <span className={styles.checkmark} aria-hidden="true">
          ✓
        </span>
      </p>
    </button>
  );
}

type PreviousButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  text: string;
};

function PreviousButton({ onClick, disabled, label, text }: PreviousButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.previousBtn} ${styles.stepChild}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span className={styles.previousArrow} aria-hidden="true">
        ←
      </span>
      {text}
    </button>
  );
}

function ActiveStepShell({
  exiting,
  children,
}: {
  exiting: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.stepActive} ${exiting ? styles.stepExit : styles.stepEnter}`}
    >
      {children}
    </div>
  );
}

export default function EarlyAccessContent({ copy: formCopy }: { copy: EarlyAccessFormCopy }) {
  const ROLES = ROLE_VALUES.map((value) => ({ value, label: formCopy.roles[value] }));
  const INTERESTS = INTEREST_VALUES.map((value) => ({
    value,
    label: formCopy.interests[value],
  }));

  const [step, setStep] = useState<Step>(1);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [leavingStep, setLeavingStep] = useState<Step | null>(null);

  const [role, setRole] = useState("");
  const [interest, setInterest] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [websiteError, setWebsiteError] = useState("");

  const { phase: analysisPhase, domain: analyzedDomain } = useAnalysis();
  const analyzedHostname = resolveAnalyzedHostname({
    phase: analysisPhase,
    hostname: analyzedDomain?.hostname,
  });
  const copy = getEarlyAccessCopy({
    analyzedHostname,
    submittedWebsite: website,
    text: formCopy.text,
  });
  const previousButtonText = { label: formCopy.backLabel, text: formCopy.back };

  const transitionToStep = (nextStep: Step) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setLeavingStep(step);

    window.setTimeout(() => {
      setStep(nextStep);
      setLeavingStep(null);
      window.setTimeout(() => setIsTransitioning(false), ENTER_MS);
    }, EXIT_MS);
  };

  const handlePrevious = () => {
    if (isTransitioning || step === 1) return;
    transitionToStep((step - 1) as Step);
  };

  const handleEdit = (targetStep: Step) => {
    if (isTransitioning) return;
    setStep(targetStep);
    setLeavingStep(null);
    setWebsiteError("");
    if (targetStep <= 1) {
      setInterest("");
      setWebsite("");
      setEmail("");
    } else if (targetStep <= 2) {
      setWebsite("");
      setEmail("");
    } else if (targetStep <= 3) {
      setEmail("");
    }
  };

  const handleRoleChange = (value: string) => {
    if (!value || isTransitioning) return;
    setRole(value);
    transitionToStep(2);
  };

  const handleInterestChange = (value: string) => {
    if (!value || isTransitioning) return;
    setInterest(value);
    setWebsite((current) =>
      resolveWebsitePrefill({ website: current, analyzedHostname }),
    );
    transitionToStep(3);
  };

  const tryAdvanceFromWebsite = () => {
    const decision = resolveWebsiteStepAdvance({ website, isTransitioning });
    if (decision === "block") {
      if (!isTransitioning) {
        setWebsiteError(getWebsiteStepError(website, formCopy.errors.websiteInvalid) ?? "");
      }
      return;
    }

    setWebsiteError("");
    transitionToStep(4);
  };

  const handleWebsiteBlur = (event: FocusEvent<HTMLInputElement>) => {
    const next = event.relatedTarget as HTMLElement | null;
    if (
      next?.classList.contains(styles.previousBtn) ||
      next?.classList.contains(styles.stepCompleted) ||
      next?.classList.contains(styles.inlineNext)
    ) {
      return;
    }
    if (!website.trim()) {
      return;
    }
    tryAdvanceFromWebsite();
  };

  const handleWebsiteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const decision = resolveWebsiteStepKeyDown({
      key: event.key,
      website,
      isTransitioning,
    });
    if (decision === "ignore") {
      return;
    }

    event.preventDefault();
    if (decision === "advance") {
      setWebsiteError("");
      transitionToStep(4);
      return;
    }

    setWebsiteError(getWebsiteStepError(website, formCopy.errors.websiteInvalid) ?? "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      resolveEmailStepSubmit({ email, isSubmitting, isTransitioning }) ===
      "ignore"
    ) {
      if (email.trim() && !isValidEarlyAccessEmail(email)) {
        setSubmitError(formCopy.errors.emailInvalid);
      }
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          interest,
          website: website.trim(),
          email: email.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setSubmitError(
          formCopy.errors.server ?? (data.error || formCopy.errors.generic),
        );
        return;
      }

      setSuccess(true);
    } catch {
      setSubmitError(formCopy.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showStep1Active = step === 1 || leavingStep === 1;
  const showStep2Active = step === 2 || leavingStep === 2;
  const showStep3Active = step === 3 || leavingStep === 3;
  const showStep4Active = step === 4 || leavingStep === 4;

  return (
    <>
      <div
        className={`${styles.atmosphere} ${success ? styles.atmosphereSuccess : ""}`}
        aria-hidden="true"
      />

      <div className={`section-inner ${styles.inner}`}>
        <div className={`grid-2 ${styles.layout}`}>
          <Reveal className={styles.copy}>
            <p className={`eyebrow ${styles.copyOrange}`} style={{ marginBottom: "var(--space-lg)" }}>
              {formCopy.eyebrow}
            </p>
            <h2
              className="heading-lg"
              style={{ marginBottom: "var(--space-md)", overflowWrap: "anywhere" }}
            >
              {copy.heading}
            </h2>
            <p className={`body-lg ${styles.copyText}`}>{copy.body}</p>
            <p className={`body-sm ${styles.email}`}>
              {formCopy.helloPrefix}{" "}
              <a href="mailto:hello@foundfy.me" className={styles.emailLink}>
                hello@foundfy.me
              </a>
            </p>
          </Reveal>

          <Reveal className={styles.formArea} delay={120}>
            {success ? (
              <div className={styles.successState} aria-live="polite">
                <p className={styles.successHeadline}>{copy.successHeadline}</p>
                <p className={styles.successSubline}>{copy.successSubline}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.formStack}>
                  {step > 1 && role && leavingStep !== 1 && (
                    <CompletedStep
                      stepNum="01"
                      label={formCopy.questions.role}
                      value={getLabel(ROLES, role).toUpperCase()}
                      onEdit={() => handleEdit(1)}
                    />
                  )}

                  {showStep1Active && (
                    <ActiveStepShell exiting={leavingStep === 1}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>01 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        {formCopy.questions.role}
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.stepChild}`}>
                        <select
                          id="role"
                          name="role"
                          className={styles.editorialSelect}
                          value={role}
                          onChange={(event) => handleRoleChange(event.target.value)}
                          disabled={isTransitioning}
                        >
                          <option value="" disabled>
                            {formCopy.selectPlaceholder}
                          </option>
                          {ROLES.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </ActiveStepShell>
                  )}

                  {step > 2 && interest && leavingStep !== 2 && (
                    <CompletedStep
                      stepNum="02"
                      label={formCopy.questions.interest}
                      value={getLabel(INTERESTS, interest).toUpperCase()}
                      onEdit={() => handleEdit(2)}
                    />
                  )}

                  {showStep2Active && (
                    <ActiveStepShell exiting={leavingStep === 2}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>02 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        {formCopy.questions.interest}
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.stepChild}`}>
                        <select
                          id="interest"
                          name="interest"
                          className={styles.editorialSelect}
                          value={interest}
                          onChange={(event) => handleInterestChange(event.target.value)}
                          disabled={isTransitioning}
                        >
                          <option value="" disabled>
                            {formCopy.selectPlaceholder}
                          </option>
                          {INTERESTS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <PreviousButton onClick={handlePrevious} disabled={isTransitioning} {...previousButtonText} />
                    </ActiveStepShell>
                  )}

                  {step > 3 && website.trim() && leavingStep !== 3 && (
                    <CompletedStep
                      stepNum="03"
                      label={formCopy.questions.websiteSummary}
                      value={website.trim().toUpperCase()}
                      onEdit={() => handleEdit(3)}
                    />
                  )}

                  {showStep3Active && (
                    <ActiveStepShell exiting={leavingStep === 3}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>03 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        {formCopy.questions.website}
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.fieldWithAction} ${styles.stepChild}`}>
                        <input
                          id="website"
                          name="website"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          className={styles.editorialInput}
                          placeholder={formCopy.websitePlaceholder}
                          value={website}
                          onChange={(event) => {
                            setWebsite(event.target.value);
                            if (websiteError) {
                              setWebsiteError("");
                            }
                          }}
                          onBlur={handleWebsiteBlur}
                          onKeyDown={handleWebsiteKeyDown}
                          disabled={isTransitioning}
                          aria-label={formCopy.websiteLabel}
                          aria-required={false}
                          aria-invalid={!!websiteError}
                          aria-describedby={websiteError ? "website-step-error" : undefined}
                        />
                        <button
                          type="button"
                          className={styles.inlineNext}
                          onClick={tryAdvanceFromWebsite}
                          disabled={isTransitioning}
                          aria-label={
                            website.trim()
                              ? formCopy.continueLabel
                              : formCopy.skipLabel
                          }
                        >
                          {formCopy.next}
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                      {websiteError ? (
                        <p
                          id="website-step-error"
                          className={`${styles.fieldError} ${styles.stepChild}`}
                          role="alert"
                        >
                          {websiteError}
                        </p>
                      ) : null}
                      <PreviousButton onClick={handlePrevious} disabled={isTransitioning} {...previousButtonText} />
                    </ActiveStepShell>
                  )}

                  {showStep4Active && (
                    <ActiveStepShell exiting={leavingStep === 4}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>04 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        {formCopy.questions.email}
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.stepChild}`}>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          className={styles.editorialInput}
                          placeholder={formCopy.emailPlaceholder}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          aria-label={formCopy.emailLabel}
                        />
                      </div>
                      <div className={`${styles.stepActions} ${styles.stepChild}`}>
                        <PreviousButton
                          onClick={handlePrevious}
                          disabled={isTransitioning || isSubmitting}
                          {...previousButtonText}
                        />
                        <button
                          type="submit"
                          className={`${styles.submitBtnOrange} ${
                            resolveEmailStepSubmit({
                              email,
                              isSubmitting: false,
                              isTransitioning: false,
                            }) === "submit"
                              ? styles.submitBtnOrangeActive
                              : ""
                          } ${isSubmitting ? styles.submitBtnOrangeSubmitting : ""}`}
                          disabled={
                            resolveEmailStepSubmit({
                              email,
                              isSubmitting,
                              isTransitioning,
                            }) === "ignore"
                          }
                          aria-busy={isSubmitting}
                        >
                          {isSubmitting ? formCopy.submitting : formCopy.submit}
                          {!isSubmitting && (
                            <span className={styles.submitArrow} aria-hidden="true">
                              →
                            </span>
                          )}
                        </button>
                      </div>
                      {submitError && (
                        <p className={`${styles.submitError} ${styles.stepChild}`} role="alert">
                          {submitError}
                        </p>
                      )}
                    </ActiveStepShell>
                  )}
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </>
  );
}
