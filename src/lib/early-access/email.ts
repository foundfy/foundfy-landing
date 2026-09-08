import { Resend } from "resend";
import type { EarlyAccessSubmission } from "./constants";

const ROLE_LABELS: Record<EarlyAccessSubmission["role"], string> = {
  "business-owner": "Business / Brand",
  "seo-professional": "SEO Professional",
  agency: "Agency",
  other: "Other",
};

const INTEREST_LABELS: Record<EarlyAccessSubmission["interest"], string> = {
  seo: "SEO insights",
  ai: "AI visibility",
  content: "Content opportunities",
  technical: "Technical checks",
  all: "All of the above",
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend configuration is missing.");
  }

  return new Resend(apiKey);
}

function formatSubmissionTime(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

export async function sendEarlyAccessNotification(
  submission: EarlyAccessSubmission,
  submittedAt: string,
) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const notificationEmail = process.env.EARLY_ACCESS_NOTIFICATION_EMAIL;

  if (!fromEmail || !notificationEmail) {
    throw new Error("Resend configuration is missing.");
  }

  const resend = getResendClient();
  const submittedAtLabel = formatSubmissionTime(submittedAt);
  const websiteLabel = submission.website ?? "Not provided";

  const text = [
    "New Early Access submission",
    "",
    `Role: ${ROLE_LABELS[submission.role]}`,
    `Interest: ${INTEREST_LABELS[submission.interest]}`,
    `Website: ${websiteLabel}`,
    `Email: ${submission.email}`,
    `Submitted: ${submittedAtLabel} (UTC)`,
  ].join("\n");

  const html = `
    <h2>New Early Access submission</h2>
    <p><strong>Role:</strong> ${ROLE_LABELS[submission.role]}</p>
    <p><strong>Interest:</strong> ${INTEREST_LABELS[submission.interest]}</p>
    <p><strong>Website:</strong> ${websiteLabel}</p>
    <p><strong>Email:</strong> ${submission.email}</p>
    <p><strong>Submitted:</strong> ${submittedAtLabel} (UTC)</p>
  `.trim();

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: notificationEmail,
    subject: `New Early Access lead — ${submission.email}`,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send notification email.");
  }
}
