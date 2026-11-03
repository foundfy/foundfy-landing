import { GOOGLE_URL_INSPECTION_INSPECT_URL } from "./config";
import { discardGoogleErrorBody } from "./google-write";
import type { GoogleIndexStatusFields } from "./indexing-interpret";
import { GoogleAuthExpiredError, GoogleIndexingError } from "./types";

type InspectionJson = {
  inspectionResult?: {
    indexStatusResult?: GoogleIndexStatusFields;
  };
  error?: unknown;
};

function mapInspectError(status: number): never {
  if (status === 401 || status === 403) {
    throw new GoogleAuthExpiredError();
  }

  if (status === 429) {
    throw new GoogleIndexingError("quota");
  }

  if (status >= 500) {
    throw new GoogleIndexingError("unavailable");
  }

  throw new GoogleIndexingError("malformed");
}

export async function inspectUrlIndexStatus(input: {
  accessToken: string;
  inspectionUrl: string;
  siteUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleIndexStatusFields> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(GOOGLE_URL_INSPECTION_INSPECT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inspectionUrl: input.inspectionUrl,
      siteUrl: input.siteUrl,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await discardGoogleErrorBody(response);
    mapInspectError(response.status);
  }

  const payload = (await response.json().catch(() => ({}))) as InspectionJson;
  return payload.inspectionResult?.indexStatusResult ?? {};
}
