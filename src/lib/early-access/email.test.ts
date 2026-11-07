import { describe, expect, it } from "vitest";
import type { EarlyAccessSubmission } from "./constants";
import { buildEarlyAccessNotificationEmail, escapeHtml } from "./email";

const SUBMITTED_AT = "2026-11-07T10:30:00.000Z";

function submission(
  overrides: Partial<EarlyAccessSubmission> = {},
): EarlyAccessSubmission {
  return {
    role: "business-owner",
    interest: "seo",
    website: "example.com",
    email: "owner@example.com",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("example.com")).toBe("example.com");
  });
});

describe("early access notification email", () => {
  it("renders the submission fields", () => {
    const email = buildEarlyAccessNotificationEmail(submission(), SUBMITTED_AT);

    expect(email.subject).toBe("New Early Access lead — owner@example.com");
    expect(email.html).toContain("<strong>Role:</strong> Business / Brand");
    expect(email.html).toContain("<strong>Interest:</strong> SEO insights");
    expect(email.html).toContain("<strong>Website:</strong> example.com");
    expect(email.html).toContain("<strong>Email:</strong> owner@example.com");
    expect(email.text).toContain("Website: example.com");
    expect(email.text).toContain("Email: owner@example.com");
  });

  it("renders submitted website text as text, not markup", () => {
    const website = `<a href="https://example.net">Click</a><img src=x>`;
    const email = buildEarlyAccessNotificationEmail(
      submission({ website }),
      SUBMITTED_AT,
    );

    expect(email.html).not.toContain("<a ");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain(
      "&lt;a href=&quot;https://example.net&quot;&gt;Click&lt;/a&gt;&lt;img src=x&gt;",
    );
    expect(email.text).toContain(`Website: ${website}`);
  });

  it("escapes characters allowed in email addresses", () => {
    const email = buildEarlyAccessNotificationEmail(
      submission({ email: "o'neil&co@example.com" }),
      SUBMITTED_AT,
    );

    expect(email.html).toContain(
      "<strong>Email:</strong> o&#39;neil&amp;co@example.com",
    );
  });

  it("shows a placeholder when no website was provided", () => {
    const email = buildEarlyAccessNotificationEmail(
      submission({ website: null }),
      SUBMITTED_AT,
    );

    expect(email.html).toContain("<strong>Website:</strong> Not provided");
    expect(email.text).toContain("Website: Not provided");
  });
});
