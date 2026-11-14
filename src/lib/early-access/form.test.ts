import { describe, expect, it } from "vitest";
import {
  getEarlyAccessCopy,
  getWebsiteStepError,
  resolveAnalyzedHostname,
  resolveEmailStepSubmit,
  resolveWebsitePrefill,
  resolveWebsiteStepAdvance,
  resolveWebsiteStepKeyDown,
} from "./form";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";

describe("early access website step", () => {
  it("advances on Next when the website is empty", () => {
    expect(
      resolveWebsiteStepAdvance({ website: "", isTransitioning: false }),
    ).toBe("advance");
    expect(
      resolveWebsiteStepAdvance({ website: "   ", isTransitioning: false }),
    ).toBe("advance");
    expect(getWebsiteStepError("")).toBeNull();
  });

  it("advances on Enter when the website is empty", () => {
    expect(
      resolveWebsiteStepKeyDown({
        key: "Enter",
        website: "",
        isTransitioning: false,
      }),
    ).toBe("advance");
  });

  it("advances a non-empty valid website", () => {
    expect(
      resolveWebsiteStepAdvance({
        website: "example.com",
        isTransitioning: false,
      }),
    ).toBe("advance");
    expect(
      resolveWebsiteStepAdvance({
        website: "https://example.com",
        isTransitioning: false,
      }),
    ).toBe("advance");
  });

  it("blocks a malformed non-empty website", () => {
    expect(
      resolveWebsiteStepAdvance({
        website: "not a url",
        isTransitioning: false,
      }),
    ).toBe("block");
    expect(
      resolveWebsiteStepKeyDown({
        key: "Enter",
        website: "nope",
        isTransitioning: false,
      }),
    ).toBe("block");
    expect(getWebsiteStepError("not a url")).toMatch(/valid website/i);
  });

  it("ignores non-Enter keys and blocks during transitions", () => {
    expect(
      resolveWebsiteStepKeyDown({
        key: "Tab",
        website: "",
        isTransitioning: false,
      }),
    ).toBe("ignore");
    expect(
      resolveWebsiteStepAdvance({ website: "", isTransitioning: true }),
    ).toBe("block");
  });
});

describe("early access email step", () => {
  it("submits from the email CTA when the address is valid", () => {
    expect(
      resolveEmailStepSubmit({
        email: "you@company.com",
        isSubmitting: false,
        isTransitioning: false,
      }),
    ).toBe("submit");
  });

  it("treats Enter the same as the email CTA", () => {
    expect(
      resolveEmailStepSubmit({
        email: "you@company.com",
        isSubmitting: false,
        isTransitioning: false,
      }),
    ).toBe("submit");
  });

  it("does not submit an invalid email", () => {
    expect(
      resolveEmailStepSubmit({
        email: "not-an-email",
        isSubmitting: false,
        isTransitioning: false,
      }),
    ).toBe("ignore");
    expect(
      resolveEmailStepSubmit({
        email: "",
        isSubmitting: false,
        isTransitioning: false,
      }),
    ).toBe("ignore");
  });

  it("prevents a duplicate submit while pending", () => {
    expect(
      resolveEmailStepSubmit({
        email: "you@company.com",
        isSubmitting: true,
        isTransitioning: false,
      }),
    ).toBe("ignore");
    expect(
      resolveEmailStepSubmit({
        email: "you@company.com",
        isSubmitting: false,
        isTransitioning: true,
      }),
    ).toBe("ignore");
  });
});

describe("early access analyzed-site context", () => {
  it("uses the hostname only after the analysis has completed", () => {
    expect(
      resolveAnalyzedHostname({ phase: "completed", hostname: "example.com" }),
    ).toBe("example.com");
    expect(
      resolveAnalyzedHostname({ phase: "starting", hostname: "example.com" }),
    ).toBeNull();
    expect(
      resolveAnalyzedHostname({ phase: "failed", hostname: "example.com" }),
    ).toBeNull();
    expect(
      resolveAnalyzedHostname({ phase: "idle", hostname: null }),
    ).toBeNull();
    expect(
      resolveAnalyzedHostname({ phase: "completed", hostname: "  " }),
    ).toBeNull();
  });

  it("prefills an empty website with the analyzed hostname", () => {
    expect(
      resolveWebsitePrefill({ website: "", analyzedHostname: "example.com" }),
    ).toBe("example.com");
    expect(
      resolveWebsitePrefill({ website: "   ", analyzedHostname: "example.com" }),
    ).toBe("example.com");
  });

  it("never overwrites a website the visitor already typed", () => {
    expect(
      resolveWebsitePrefill({
        website: "other.com",
        analyzedHostname: "example.com",
      }),
    ).toBe("other.com");
  });

  it("leaves the website untouched without an analyzed site", () => {
    expect(
      resolveWebsitePrefill({ website: "", analyzedHostname: null }),
    ).toBe("");
  });

  it("produces a prefill that passes the website step", () => {
    const website = resolveWebsitePrefill({
      website: "",
      analyzedHostname: "www.example.com",
    });
    expect(
      resolveWebsiteStepAdvance({ website, isTransitioning: false }),
    ).toBe("advance");
    expect(getWebsiteStepError(website)).toBeNull();
  });

  it("keeps the default early access copy without an analyzed site", () => {
    expect(
      getEarlyAccessCopy({ analyzedHostname: null, submittedWebsite: "" }),
    ).toEqual({
      heading: "Tell us a bit about yourself.",
      body: "Join the early access list and help shape what's next. We're building Foundfy with the people who'll use it most.",
      successHeadline: "YOU'RE EARLY.",
      successSubline: "We'll let you know when there's more to discover.",
    });
  });

  it("personalizes the copy for the analyzed site", () => {
    const copy = getEarlyAccessCopy({
      analyzedHostname: "example.com",
      submittedWebsite: "example.com",
    });
    expect(copy.heading).toBe("Let's work on example.com.");
    expect(copy.body).toBe(
      "Answer a few quick questions and we'll get back to you by email about next steps.",
    );
    expect(copy.successHeadline).toBe("YOU'RE EARLY.");
    expect(copy.successSubline).toBe("We'll email you about example.com.");
  });

  it("does not name the analyzed site when another website was submitted", () => {
    expect(
      getEarlyAccessCopy({
        analyzedHostname: "example.com",
        submittedWebsite: "other.com",
      }).successSubline,
    ).toBe("We'll let you know when there's more to discover.");
    expect(
      getEarlyAccessCopy({
        analyzedHostname: "example.com",
        submittedWebsite: "",
      }).successSubline,
    ).toBe("We'll let you know when there's more to discover.");
  });
});

describe("early access copy in Spanish", () => {
  const text = ES_LANDING_COPY.earlyAccess.text;

  it("uses the Spanish default copy when nothing was analyzed", () => {
    expect(
      getEarlyAccessCopy({ analyzedHostname: null, submittedWebsite: "", text }),
    ).toEqual({
      heading: "Cuéntanos sobre tu negocio.",
      body: text.body,
      successHeadline: "¡SOLICITUD RECIBIDA!",
      successSubline: "Te escribiremos por email.",
    });
  });

  it("personalizes the Spanish copy with the analyzed hostname", () => {
    const copy = getEarlyAccessCopy({
      analyzedHostname: "example.com",
      submittedWebsite: "example.com",
      text,
    });
    expect(copy.heading).toBe("Trabajemos en example.com.");
    expect(copy.body).toBe(text.personalizedBody);
    expect(copy.successSubline).toBe("Te escribiremos sobre example.com.");
  });

  it("does not name the analyzed site in Spanish when another website was submitted", () => {
    expect(
      getEarlyAccessCopy({
        analyzedHostname: "example.com",
        submittedWebsite: "other.com",
        text,
      }).successSubline,
    ).toBe("Te escribiremos por email.");
  });

  it("returns the Spanish website error only for invalid input", () => {
    const message = ES_LANDING_COPY.earlyAccess.errors.websiteInvalid;
    expect(getWebsiteStepError("not a url", message)).toBe(message);
    expect(getWebsiteStepError("example.com", message)).toBeNull();
    expect(getWebsiteStepError("", message)).toBeNull();
  });
});
