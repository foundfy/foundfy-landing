import { FOUNDFY_GITHUB_OWNER, FOUNDFY_GITHUB_REPO } from "./config";

type GitHubJson = Record<string, unknown>;

export class GitHubRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

export async function githubRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const response = await fetchImpl(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "foundfy-act-execute",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new GitHubRequestError(response.status, `github_${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export function repoPath(path: string): string {
  return `/repos/${FOUNDFY_GITHUB_OWNER}/${FOUNDFY_GITHUB_REPO}${path}`;
}

export type GitRef = { object: { sha: string } };
export type GitCommit = { sha: string; tree: { sha: string }; message: string; html_url?: string };
export type GitTree = { sha: string };
export type GitBlobRef = { sha: string };
export type GitContent = { sha: string; content: string; encoding: string };

export async function getBranchHeadSha(
  token: string,
  branch: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const ref = await githubRequest<GitRef>(
    token,
    repoPath(`/git/ref/heads/${encodeURIComponent(branch)}`),
    {},
    fetchImpl,
  );
  return ref.object.sha;
}

export async function getCommit(
  token: string,
  sha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitCommit> {
  return githubRequest<GitCommit>(token, repoPath(`/git/commits/${sha}`), {}, fetchImpl);
}

export async function getFileAtRef(
  token: string,
  path: string,
  ref: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sha: string; content: string }> {
  const file = await githubRequest<GitContent>(
    token,
    `${repoPath(`/contents/${path}`)}?ref=${encodeURIComponent(ref)}`,
    {},
    fetchImpl,
  );
  const content = Buffer.from(file.content.replace(/\n/g, ""), file.encoding === "base64" ? "base64" : "utf8").toString(
    "utf8",
  );
  return { sha: file.sha, content };
}

export async function createBlob(
  token: string,
  content: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const blob = await githubRequest<GitBlobRef>(
    token,
    repoPath("/git/blobs"),
    { method: "POST", body: JSON.stringify({ content, encoding: "utf-8" }) },
    fetchImpl,
  );
  return blob.sha;
}

export async function createTree(
  token: string,
  baseTreeSha: string,
  path: string,
  blobSha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const tree = await githubRequest<GitTree>(
    token,
    repoPath("/git/trees"),
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [{ path, mode: "100644", type: "blob", sha: blobSha }],
      }),
    },
    fetchImpl,
  );
  return tree.sha;
}

export async function createCommit(
  token: string,
  input: { message: string; tree: string; parent: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GitCommit> {
  return githubRequest<GitCommit>(
    token,
    repoPath("/git/commits"),
    {
      method: "POST",
      body: JSON.stringify({
        message: input.message,
        tree: input.tree,
        parents: [input.parent],
      }),
    },
    fetchImpl,
  );
}

export async function updateBranchRef(
  token: string,
  branch: string,
  sha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await githubRequest<GitHubJson>(
    token,
    repoPath(`/git/refs/heads/${encodeURIComponent(branch)}`),
    { method: "PATCH", body: JSON.stringify({ sha, force: false }) },
    fetchImpl,
  );
}

export async function listRecentFileCommits(
  token: string,
  path: string,
  branch: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<{ sha: string; message: string }>> {
  const commits = await githubRequest<Array<{ sha: string; commit: { message: string } }>>(
    token,
    `${repoPath("/commits")}?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=30`,
    {},
    fetchImpl,
  );
  return commits.map((commit) => ({ sha: commit.sha, message: commit.commit.message }));
}
