import { ActionError } from "../types";
import { metaValuesEqual } from "../meta";
import { mintInstallationToken } from "./auth";
import {
  createBlob,
  createCommit,
  createTree,
  getBranchHeadSha,
  getCommit,
  getFileAtRef,
  GitHubRequestError,
  listRecentFileCommits,
  updateBranchRef,
} from "./api";
import {
  FOUNDFY_GITHUB_BRANCH,
  FOUNDFY_GITHUB_OWNER,
  FOUNDFY_GITHUB_PROVIDER,
  FOUNDFY_GITHUB_REPO,
  githubCommitMarker,
  githubCommitMessage,
  type GitHubAppConfig,
} from "./config";
import { HOMEPAGE_DESCRIPTION_FILE_PATH, parseHomepageDescriptionSource, renderHomepageDescriptionSource } from "./homepage-source";

export type GitExecutionArtifact = {
  provider: typeof FOUNDFY_GITHUB_PROVIDER;
  repo: string;
  branch: string;
  filePath: string;
  headShaBefore: string;
  commitShaAfter: string;
  blobShaBefore: string;
  blobShaAfter: string;
  treeShaAfter: string;
  beforeValue: string | null;
  afterValue: string;
  installationId: string;
  recovered: boolean;
};

export async function recoverOwnedHomepageCommit(input: {
  token: string;
  actionId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ sha: string } | null> {
  const commits = await listRecentFileCommits(
    input.token,
    HOMEPAGE_DESCRIPTION_FILE_PATH,
    FOUNDFY_GITHUB_BRANCH,
    input.fetchImpl,
  );
  const marker = githubCommitMarker(input.actionId);
  const owned = commits.find((commit) => commit.message.includes(marker));
  return owned ? { sha: owned.sha } : null;
}

export async function commitHomepageDescription(input: {
  config: GitHubAppConfig;
  actionId: string;
  expectedBefore: string | null;
  afterValue: string;
  recoverOnly?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<GitExecutionArtifact> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const token = await mintInstallationToken(input.config, fetchImpl);
  const owned = await recoverOwnedHomepageCommit({
    token,
    actionId: input.actionId,
    fetchImpl,
  });
  if (owned) {
    const head = await getBranchHeadSha(token, FOUNDFY_GITHUB_BRANCH, fetchImpl);
    const file = await getFileAtRef(token, HOMEPAGE_DESCRIPTION_FILE_PATH, owned.sha, fetchImpl);
    let recoveredValue: string | null;
    try {
      recoveredValue = parseHomepageDescriptionSource(file.content);
    } catch {
      throw new ActionError(
        "unexpected_source_shape",
        "The homepage metadata source is not in the expected Foundfy format.",
      );
    }
    if (!metaValuesEqual(recoveredValue, input.afterValue)) {
      throw new ActionError(
        "remote_state_changed",
        "Foundfy found a previous commit for this action, but its homepage metadata does not match the approved after-state.",
      );
    }
    return {
      provider: FOUNDFY_GITHUB_PROVIDER,
      repo: `${FOUNDFY_GITHUB_OWNER}/${FOUNDFY_GITHUB_REPO}`,
      branch: FOUNDFY_GITHUB_BRANCH,
      filePath: HOMEPAGE_DESCRIPTION_FILE_PATH,
      headShaBefore: head,
      commitShaAfter: owned.sha,
      blobShaBefore: file.sha,
      blobShaAfter: file.sha,
      treeShaAfter: (await getCommit(token, owned.sha, fetchImpl)).tree.sha,
      beforeValue: input.expectedBefore,
      afterValue: input.afterValue,
      installationId: input.config.installationId,
      recovered: true,
    };
  }

  if (input.recoverOnly) {
    throw new ActionError(
      "remote_state_changed",
      "The live homepage already has the proposed meta description, but Foundfy did not record creating that change.",
    );
  }

  const headShaBefore = await getBranchHeadSha(token, FOUNDFY_GITHUB_BRANCH, fetchImpl);
  const file = await getFileAtRef(token, HOMEPAGE_DESCRIPTION_FILE_PATH, headShaBefore, fetchImpl);
  let currentValue: string | null;
  try {
    currentValue = parseHomepageDescriptionSource(file.content);
  } catch {
    throw new ActionError(
      "unexpected_source_shape",
      "The homepage metadata source is not in the expected Foundfy format.",
    );
  }

  if (metaValuesEqual(currentValue, input.afterValue)) {
    throw new ActionError(
      "remote_state_changed",
      "The Git homepage metadata already equals the proposed value, but Foundfy did not record creating that change.",
    );
  }

  if (!metaValuesEqual(currentValue, input.expectedBefore)) {
    throw new ActionError(
      "before_state_changed",
      "The Git homepage metadata no longer matches the approved before-state.",
    );
  }

  const nextSource = renderHomepageDescriptionSource(input.afterValue);
  const blobShaAfter = await createBlob(token, nextSource, fetchImpl);
  const parent = await getCommit(token, headShaBefore, fetchImpl);
  const treeShaAfter = await createTree(
    token,
    parent.tree.sha,
    HOMEPAGE_DESCRIPTION_FILE_PATH,
    blobShaAfter,
    fetchImpl,
  );
  const commit = await createCommit(
    token,
    {
      message: githubCommitMessage(input.actionId),
      tree: treeShaAfter,
      parent: headShaBefore,
    },
    fetchImpl,
  );

  try {
    await updateBranchRef(token, FOUNDFY_GITHUB_BRANCH, commit.sha, fetchImpl);
  } catch (error) {
    if (error instanceof GitHubRequestError && (error.status === 409 || error.status === 422)) {
      throw new ActionError(
        "git_concurrency_conflict",
        "main moved before Foundfy could record the commit. Retry after review.",
      );
    }
    throw error;
  }

  return {
    provider: FOUNDFY_GITHUB_PROVIDER,
    repo: `${FOUNDFY_GITHUB_OWNER}/${FOUNDFY_GITHUB_REPO}`,
    branch: FOUNDFY_GITHUB_BRANCH,
    filePath: HOMEPAGE_DESCRIPTION_FILE_PATH,
    headShaBefore,
    commitShaAfter: commit.sha,
    blobShaBefore: file.sha,
    blobShaAfter,
    treeShaAfter,
    beforeValue: input.expectedBefore,
    afterValue: input.afterValue,
    installationId: input.config.installationId,
    recovered: false,
  };
}
