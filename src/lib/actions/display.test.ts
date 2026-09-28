import { describe, expect, it } from "vitest";
import { ACTION_EXECUTE_DISABLED, ACTION_PREPARE_LABEL } from "./display";
import { ACTION_VERIFICATION_PLAN } from "./config";

describe("ACT display copy", () => {
  it("does not claim ranking or traffic improvement", () => {
    expect(ACTION_VERIFICATION_PLAN).toBe(
      "After execution, Foundfy will re-check this page and confirm whether the meta description changed.",
    );
    expect(ACTION_VERIFICATION_PLAN).not.toMatch(/rank|traffic|clicks|impressions/i);
    expect(ACTION_EXECUTE_DISABLED).toContain("site connection");
    expect(ACTION_PREPARE_LABEL).toBe("Prepare this change");
  });
});
