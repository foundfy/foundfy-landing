import { RESEARCH_PROVIDER_TIMEOUT_MS } from "../config";
import { ResearchProviderError } from "../errors";
import {
  assertDataForSeoOrigin,
  type DataForSeoOrigin,
} from "./hosts";

export type DataForSeoFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export type DataForSeoClient = {
  origin: DataForSeoOrigin;
  post: (path: string, body: unknown) => Promise<unknown>;
};

function basicAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`;
}

export function createDataForSeoClient(input: {
  origin: string;
  login: string;
  password: string;
  fetchImpl?: DataForSeoFetch;
}): DataForSeoClient {
  const origin = assertDataForSeoOrigin(input.origin);
  const fetchImpl = input.fetchImpl ?? fetch;
  const authorization = basicAuthHeader(input.login, input.password);

  return {
    origin,
    async post(path: string, body: unknown): Promise<unknown> {
      const url = `${origin}${path}`;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(RESEARCH_PROVIDER_TIMEOUT_MS),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new ResearchProviderError("timeout", "DataForSEO request timed out.", true);
        }

        throw new ResearchProviderError("server_error", "DataForSEO request failed.", true);
      }

      if (response.status === 401 || response.status === 403) {
        throw new ResearchProviderError("unauthorized", "DataForSEO rejected the request.");
      }

      if (response.status === 429) {
        throw new ResearchProviderError("rate_limited", "DataForSEO rate limit.", true);
      }

      if (response.status >= 500) {
        throw new ResearchProviderError("server_error", "DataForSEO server error.", true);
      }

      if (!response.ok) {
        throw new ResearchProviderError("invalid_response", "DataForSEO returned an unexpected status.");
      }

      try {
        return await response.json();
      } catch {
        throw new ResearchProviderError("invalid_response", "DataForSEO returned invalid JSON.");
      }
    },
  };
}
