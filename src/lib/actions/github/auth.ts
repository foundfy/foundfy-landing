import { createPrivateKey, sign } from "node:crypto";
import { ActionError } from "../types";
import type { GitHubAppConfig } from "./config";

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function createGitHubAppJwt(config: GitHubAppConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: nowSeconds - 30,
      exp: nowSeconds + 540,
      iss: config.appId,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), createPrivateKey(config.privateKey));
  return `${unsigned}.${base64Url(signature)}`;
}

export async function mintInstallationToken(
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const jwt = createGitHubAppJwt(config);
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "foundfy-act-execute",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new ActionError("github_auth_failed", "Foundfy could not authenticate to GitHub.");
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== "string" || !body.token) {
    throw new ActionError("github_auth_failed", "Foundfy could not authenticate to GitHub.");
  }

  return body.token;
}
