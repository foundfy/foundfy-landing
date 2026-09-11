import { describe, expect, it } from "vitest";
import {
  getWebsiteStepError,
  resolveEmailStepSubmit,
  resolveWebsiteStepAdvance,
  resolveWebsiteStepKeyDown,
} from "./form";

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
