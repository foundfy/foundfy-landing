import { describe, expect, it } from "vitest";
import { oauthPurposeFromReturnPath } from "./oauth-purpose";

describe("OAuth purpose encoded in return_path", () => {
  it("treats observe=setup as incremental setup without a new table", () => {
    expect(oauthPurposeFromReturnPath("/site/abc?observe=setup")).toBe("setup");
    expect(oauthPurposeFromReturnPath("/site/abc")).toBe("connect");
    expect(oauthPurposeFromReturnPath("/site/abc?observe=connected")).toBe("connect");
  });
});
