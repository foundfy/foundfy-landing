import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionError } from "../types";
import { renderHomepageDescriptionSource } from "./homepage-source";

const mintInstallationTokenMock = vi.fn();
const getBranchHeadShaMock = vi.fn();
const getFileAtRefMock = vi.fn();
const getCommitMock = vi.fn();
const createBlobMock = vi.fn();
const createTreeMock = vi.fn();
const createCommitMock = vi.fn();
const updateBranchRefMock = vi.fn();
const listRecentFileCommitsMock = vi.fn();

vi.mock("./auth", () => ({
  mintInstallationToken: (...args: unknown[]) => mintInstallationTokenMock(...args),
}));

vi.mock("./api", () => ({
  GitHubRequestError: class GitHubRequestError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getBranchHeadSha: (...args: unknown[]) => getBranchHeadShaMock(...args),
  getFileAtRef: (...args: unknown[]) => getFileAtRefMock(...args),
  getCommit: (...args: unknown[]) => getCommitMock(...args),
  createBlob: (...args: unknown[]) => createBlobMock(...args),
  createTree: (...args: unknown[]) => createTreeMock(...args),
  createCommit: (...args: unknown[]) => createCommitMock(...args),
  updateBranchRef: (...args: unknown[]) => updateBranchRefMock(...args),
  listRecentFileCommits: (...args: unknown[]) => listRecentFileCommitsMock(...args),
}));

import { commitHomepageDescription } from "./commit";
import { GitHubRequestError } from "./api";

const CONFIG = {
  appId: "1",
  installationId: "99",
  privateKey: "key",
};

const AFTER = "New homepage description.";

describe("commitHomepageDescription", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("commits only when Git before-state matches and HEAD can be updated without force", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([]);
    getBranchHeadShaMock.mockResolvedValue("head-1");
    getFileAtRefMock.mockResolvedValue({
      sha: "blob-before",
      content: renderHomepageDescriptionSource(null),
    });
    getCommitMock.mockResolvedValue({ sha: "head-1", tree: { sha: "tree-1" } });
    createBlobMock.mockResolvedValue("blob-after");
    createTreeMock.mockResolvedValue("tree-after");
    createCommitMock.mockResolvedValue({ sha: "commit-after" });
    updateBranchRefMock.mockResolvedValue(undefined);

    const artifact = await commitHomepageDescription({
      config: CONFIG,
      actionId: "action-1",
      expectedBefore: null,
      afterValue: AFTER,
    });

    expect(createCommitMock).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        message: "foundfy-act:action-1 set homepage meta description",
        parent: "head-1",
      }),
      expect.anything(),
    );
    expect(updateBranchRefMock).toHaveBeenCalledWith("token", "main", "commit-after", expect.anything());
    expect(artifact).toMatchObject({
      recovered: false,
      commitShaAfter: "commit-after",
      headShaBefore: "head-1",
    });
  });

  it("fails closed when Git already equals after without a Foundfy-owned commit", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([]);
    getBranchHeadShaMock.mockResolvedValue("head-1");
    getFileAtRefMock.mockResolvedValue({
      sha: "blob-after",
      content: renderHomepageDescriptionSource(AFTER),
    });

    await expect(
      commitHomepageDescription({
        config: CONFIG,
        actionId: "action-1",
        expectedBefore: null,
        afterValue: AFTER,
      }),
    ).rejects.toMatchObject({ code: "remote_state_changed" });

    expect(createCommitMock).not.toHaveBeenCalled();
    expect(updateBranchRefMock).not.toHaveBeenCalled();
  });

  it("recovers a Foundfy-owned commit instead of creating a duplicate", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([
      { sha: "owned-sha", message: "foundfy-act:action-1 set homepage meta description" },
    ]);
    getBranchHeadShaMock.mockResolvedValue("head-later");
    getFileAtRefMock.mockResolvedValue({
      sha: "blob-after",
      content: renderHomepageDescriptionSource(AFTER),
    });
    getCommitMock.mockResolvedValue({ sha: "owned-sha", tree: { sha: "tree-owned" } });

    const artifact = await commitHomepageDescription({
      config: CONFIG,
      actionId: "action-1",
      expectedBefore: null,
      afterValue: AFTER,
    });

    expect(createCommitMock).not.toHaveBeenCalled();
    expect(artifact).toMatchObject({
      recovered: true,
      commitShaAfter: "owned-sha",
    });
  });

  it("does not commit in recover-only mode without an owned commit", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([]);

    await expect(
      commitHomepageDescription({
        config: CONFIG,
        actionId: "action-1",
        expectedBefore: null,
        afterValue: AFTER,
        recoverOnly: true,
      }),
    ).rejects.toMatchObject({ code: "remote_state_changed" });

    expect(createCommitMock).not.toHaveBeenCalled();
    expect(getFileAtRefMock).not.toHaveBeenCalled();
  });

  it("fails closed on unexpected source shape before committing", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([]);
    getBranchHeadShaMock.mockResolvedValue("head-1");
    getFileAtRefMock.mockResolvedValue({
      sha: "blob-before",
      content: "export const NOT_THE_SYMBOL = null;\n",
    });

    await expect(
      commitHomepageDescription({
        config: CONFIG,
        actionId: "action-1",
        expectedBefore: null,
        afterValue: AFTER,
      }),
    ).rejects.toMatchObject({ code: "unexpected_source_shape" });

    expect(createCommitMock).not.toHaveBeenCalled();
  });

  it("treats a 409 ref update as a concurrency conflict", async () => {
    mintInstallationTokenMock.mockResolvedValue("token");
    listRecentFileCommitsMock.mockResolvedValue([]);
    getBranchHeadShaMock.mockResolvedValue("head-1");
    getFileAtRefMock.mockResolvedValue({
      sha: "blob-before",
      content: renderHomepageDescriptionSource(null),
    });
    getCommitMock.mockResolvedValue({ sha: "head-1", tree: { sha: "tree-1" } });
    createBlobMock.mockResolvedValue("blob-after");
    createTreeMock.mockResolvedValue("tree-after");
    createCommitMock.mockResolvedValue({ sha: "commit-after" });
    updateBranchRefMock.mockRejectedValue(new GitHubRequestError(409, "conflict"));

    await expect(
      commitHomepageDescription({
        config: CONFIG,
        actionId: "action-1",
        expectedBefore: null,
        afterValue: AFTER,
      }),
    ).rejects.toBeInstanceOf(ActionError);

    await expect(
      commitHomepageDescription({
        config: CONFIG,
        actionId: "action-1",
        expectedBefore: null,
        afterValue: AFTER,
      }),
    ).rejects.toMatchObject({ code: "git_concurrency_conflict" });
  });
});
