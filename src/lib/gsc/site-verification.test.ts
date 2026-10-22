import { afterEach, describe, expect, it, vi } from "vitest";
import { SEARCH_PRESENCE_PERMISSION_COPY, SEARCH_PRESENCE_TRANSIENT_COPY } from "./google-write";
import {
  getDnsTxtVerificationToken,
  insertDnsTxtVerification,
  SITE_VERIFICATION_METHOD_DNS_TXT,
  SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN,
} from "./site-verification";
import { GoogleAuthExpiredError, SearchPresenceGoogleError } from "./types";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("Site Verification C0 client", () => {
  it("requests a DNS_TXT token for an INET_DOMAIN identifier", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "google-site-verification=abc" }),
      text: async () => "",
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(getDnsTxtVerificationToken("access-token", "gez.studio")).resolves.toBe(
      "google-site-verification=abc",
    );
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(init.body)).toEqual({
      verificationMethod: SITE_VERIFICATION_METHOD_DNS_TXT,
      site: { type: SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN, identifier: "gez.studio" },
    });
  });

  it("verifies with DNS_TXT and INET_DOMAIN only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).resolves.toBe(
      "verified",
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("verificationMethod=DNS_TXT");
    expect(JSON.parse(init.body)).toEqual({
      site: { type: SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN, identifier: "gez.studio" },
    });
  });

  it("maps verification-not-confirmed (HTTP 400) to pending without exposing Google payloads", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, { error: { message: "raw google body", reason: "notFound" } }),
    ) as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).resolves.toBe(
      "pending",
    );
  });

  it("maps auth failure to reconnect, not DNS pending", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(401, { error: { message: "invalid_token" } }),
    ) as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).rejects.toBeInstanceOf(
      GoogleAuthExpiredError,
    );
  });

  it("maps permission failure to setup authorization, not DNS pending", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: { message: "insufficientPermissions" } }),
    ) as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).rejects.toMatchObject({
      name: "SearchPresenceGoogleError",
      kind: "permission",
      message: SEARCH_PRESENCE_PERMISSION_COPY,
    });
  });

  it("maps 429 to a bounded temporary failure, not DNS pending", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(429, { error: { message: "rateLimitExceeded" } }),
    ) as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).rejects.toMatchObject({
      kind: "transient",
      message: SEARCH_PRESENCE_TRANSIENT_COPY,
    });
  });

  it("maps 5xx to a bounded temporary failure, not DNS pending", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(503, { error: { message: "backendError" } }),
    ) as typeof fetch;

    await expect(insertDnsTxtVerification("access-token", "gez.studio")).rejects.toMatchObject({
      kind: "transient",
      message: SEARCH_PRESENCE_TRANSIENT_COPY,
    });
  });

  it("maps unexpected malformed responses to a bounded setup error without raw Google payloads", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(418, { error: { message: "raw google teapot", errors: [{ reason: "secret" }] } }),
    ) as typeof fetch;

    try {
      await insertDnsTxtVerification("access-token", "gez.studio");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SearchPresenceGoogleError);
      expect(error).toMatchObject({ kind: "invalid" });
      expect(String(error)).not.toMatch(/raw google teapot|secret|insufficientPermissions/i);
    }
  });
});
