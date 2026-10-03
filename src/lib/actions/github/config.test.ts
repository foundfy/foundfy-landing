import { describe, expect, it, vi } from "vitest";
import { FOUNDFY_GITHUB_OWNER, FOUNDFY_GITHUB_REPO, readGitHubAppConfig } from "./config";
import { updateBranchRef } from "./api";

describe("GitHub App config", () => {
  it("reads App credentials from env and never invents a PAT", () => {
    const config = readGitHubAppConfig({
      GITHUB_APP_ID: "123",
      GITHUB_APP_INSTALLATION_ID: "456",
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nABC\\n-----END RSA PRIVATE KEY-----",
    });
    expect(config).toEqual({
      appId: "123",
      installationId: "456",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----",
    });
    expect(FOUNDFY_GITHUB_OWNER).toBe("foundfy");
    expect(FOUNDFY_GITHUB_REPO).toBe("foundfy-landing");
  });

  it("returns null when App credentials are missing", () => {
    expect(readGitHubAppConfig({})).toBeNull();
  });
});

describe("GitHub ref update", () => {
  it("updates main without force", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await updateBranchRef("token", "main", "sha-after", fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/foundfy/foundfy-landing/git/refs/heads/main",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sha: "sha-after", force: false }),
      }),
    );
  });
});
