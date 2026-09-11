"use client";

import { FocusEvent, FormEvent, KeyboardEvent, ReactNode, useState } from "react";
import {
  getWebsiteStepError,
  resolveEmailStepSubmit,
  resolveWebsiteStepAdvance,
  resolveWebsiteStepKeyDown,
} from "@/lib/early-access/form";
import { isValidEarlyAccessEmail } from "@/lib/early-access/validation";
import styles from "./EarlyAccess.module.css";

const ROLES = [
  { value: "business-owner", label: "Business / Brand" },
  { value: "seo-professional", label: "SEO Professional" },
  { value: "agency", label: "Agency" },
  { value: "other", label: "Other" },
] as const;

const INTERESTS = [
  { value: "seo", label: "SEO insights" },
  { value: "ai", label: "AI visibility" },
  { value: "content", label: "Content opportunities" },
  { value: "technical", label: "Technical checks" },
  { value: "all", label: "All of the above" },
] as const;

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
};

function PreviousButton({ onClick, disabled }: PreviousButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.previousBtn} ${styles.stepChild}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Go back to previous question"
    >
      <span className={styles.previousArrow} aria-hidden="true">
        ←
      </span>
      Back
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

export default function EarlyAccessContent() {
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
    transitionToStep(3);
  };

  const tryAdvanceFromWebsite = () => {
    const decision = resolveWebsiteStepAdvance({ website, isTransitioning });
    if (decision === "block") {
      if (!isTransitioning) {
        setWebsiteError(getWebsiteStepError(website) ?? "");
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

    setWebsiteError(getWebsiteStepError(website) ?? "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      resolveEmailStepSubmit({ email, isSubmitting, isTransitioning }) ===
      "ignore"
    ) {
      if (email.trim() && !isValidEarlyAccessEmail(email)) {
        setSubmitError("Please enter a valid email address.");
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
          data.error || "Something went wrong. Please try again.",
        );
        return;
      }

      setSuccess(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
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
          <div className={styles.copy}>
            <p className={`eyebrow ${styles.copyOrange}`} style={{ marginBottom: "var(--space-lg)" }}>
              Get early access
            </p>
            <h2 className="heading-lg" style={{ marginBottom: "var(--space-md)" }}>
              Tell us a bit about yourself.
            </h2>
            <p className={`body-lg ${styles.copyText}`}>
              Join the early access list and help shape what&apos;s next. We&apos;re
              building Foundfy with the people who&apos;ll use it most.
            </p>
            <p className={`body-sm ${styles.email}`}>
              Or just say hello{" "}
              <a href="mailto:hello@foundfy.me" className={styles.emailLink}>
                hello@foundfy.me
              </a>
            </p>
          </div>

          <div className={styles.formArea}>
            {success ? (
              <div className={styles.successState} aria-live="polite">
                <p className={styles.successHeadline}>YOU&apos;RE EARLY.</p>
                <p className={styles.successSubline}>
                  We&apos;ll let you know when there&apos;s more to discover.
                </p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.formStack}>
                  {step > 1 && role && leavingStep !== 1 && (
                    <CompletedStep
                      stepNum="01"
                      label="What best describes you?"
                      value={getLabel(ROLES, role).toUpperCase()}
                      onEdit={() => handleEdit(1)}
                    />
                  )}

                  {showStep1Active && (
                    <ActiveStepShell exiting={leavingStep === 1}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>01 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        What best describes you?
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
                            Select one
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
                      label="What are you most interested in?"
                      value={getLabel(INTERESTS, interest).toUpperCase()}
                      onEdit={() => handleEdit(2)}
                    />
                  )}

                  {showStep2Active && (
                    <ActiveStepShell exiting={leavingStep === 2}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>02 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        What are you most interested in?
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
                            Select one
                          </option>
                          {INTERESTS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <PreviousButton onClick={handlePrevious} disabled={isTransitioning} />
                    </ActiveStepShell>
                  )}

                  {step > 3 && website.trim() && leavingStep !== 3 && (
                    <CompletedStep
                      stepNum="03"
                      label="Website"
                      value={website.trim().toUpperCase()}
                      onEdit={() => handleEdit(3)}
                    />
                  )}

                  {showStep3Active && (
                    <ActiveStepShell exiting={leavingStep === 3}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>03 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        Your website (optional)
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.fieldWithAction} ${styles.stepChild}`}>
                        <input
                          id="website"
                          name="website"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          className={styles.editorialInput}
                          placeholder="https://"
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
                          aria-label="Your website (optional)"
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
                              ? "Continue"
                              : "Skip website and continue"
                          }
                        >
                          Next
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
                      <PreviousButton onClick={handlePrevious} disabled={isTransitioning} />
                    </ActiveStepShell>
                  )}

                  {showStep4Active && (
                    <ActiveStepShell exiting={leavingStep === 4}>
                      <p className={`${styles.stepCounter} ${styles.stepChild}`}>04 / 04</p>
                      <h3 className={`${styles.activeQuestion} ${styles.stepChild}`}>
                        Where should we keep you posted?
                      </h3>
                      <div className={`${styles.fieldShell} ${styles.stepChild}`}>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          className={styles.editorialInput}
                          placeholder="you@company.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          aria-label="Your email"
                        />
                      </div>
                      <div className={`${styles.stepActions} ${styles.stepChild}`}>
                        <PreviousButton
                          onClick={handlePrevious}
                          disabled={isTransitioning || isSubmitting}
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
                          {isSubmitting ? "Submitting…" : "Get early access"}
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
          </div>
        </div>
      </div>
    </>
  );
}
