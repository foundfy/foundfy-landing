import { RESEARCH_PROVIDER_TIMEOUT_MS } from "../config";
import { ResearchProviderError } from "../errors";
import { logDataForSeoHttp } from "./dataforseo-diagnostics";
import {
  assertDataForSeoOrigin,
  dataForSeoRequestCategory,
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
        const category = dataForSeoRequestCategory(path);
        if (error instanceof DOMException && error.name === "TimeoutError") {
          logDataForSeoHttp({ category, errorCode: "timeout" });
          throw new ResearchProviderError("timeout", "DataForSEO request timed out.", true);
        }

        logDataForSeoHttp({ category, errorCode: "server_error" });
        throw new ResearchProviderError("server_error", "DataForSEO request failed.", true);
      }

      const category = dataForSeoRequestCategory(path);

      if (response.status === 401 || response.status === 403) {
        logDataForSeoHttp({ category, httpStatus: response.status, errorCode: "unauthorized" });
        throw new ResearchProviderError("unauthorized", "DataForSEO rejected the request.");
      }

      if (response.status === 429) {
        logDataForSeoHttp({ category, httpStatus: response.status, errorCode: "rate_limited" });
        throw new ResearchProviderError("rate_limited", "DataForSEO rate limit.", true);
      }

      if (response.status >= 500) {
        logDataForSeoHttp({ category, httpStatus: response.status, errorCode: "server_error" });
        throw new ResearchProviderError("server_error", "DataForSEO server error.", true);
      }

      if (!response.ok) {
        logDataForSeoHttp({
          category,
          httpStatus: response.status,
          errorCode: "invalid_response",
        });
        throw new ResearchProviderError("invalid_response", "DataForSEO returned an unexpected status.");
      }

      logDataForSeoHttp({ category, httpStatus: response.status });

      try {
        return await response.json();
      } catch {
        logDataForSeoHttp({
          category,
          httpStatus: response.status,
          errorCode: "invalid_response",
        });
        throw new ResearchProviderError("invalid_response", "DataForSEO returned invalid JSON.");
      }
    },
  };
}
