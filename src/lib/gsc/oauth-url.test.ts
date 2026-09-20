import { afterEach, describe, expect, it } from "vitest";
import {
  GOOGLE_OAUTH_AUTHORIZATION_URL,
  GOOGLE_OAUTH_SCOPE_STRING,
  OAUTH_CALLBACK_PATH,
} from "./config";
import { buildGoogleAuthorizationUrl, createOAuthStateValue } from "./oauth-url";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Google OAuth start URL", () => {
  it("requests offline readonly Search Console access with CSRF state", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    const state = createOAuthStateValue();
    const url = new URL(
      buildGoogleAuthorizationUrl({
        requestUrl: "http://localhost:3000/api/websites/abc/observe/connect",
        state,
      }),
    );

    expect(url.origin + url.pathname).toBe(GOOGLE_OAUTH_AUTHORIZATION_URL);
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `http://localhost:3000${OAUTH_CALLBACK_PATH}`,
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_OAUTH_SCOPE_STRING);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("scope")?.split(" ")).not.toContain(
      "https://www.googleapis.com/auth/webmasters",
    );
    expect(url.toString()).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(state).not.toBe(createOAuthStateValue());
  });

  it("strips wrapping newlines from the Google client id", () => {
    process.env.GOOGLE_CLIENT_ID = "1234567890-\nexample.apps.googleusercontent.com";
    const url = new URL(
      buildGoogleAuthorizationUrl({
        requestUrl: "http://localhost:3000/api/websites/abc/observe/connect",
        state: "state",
      }),
    );

    expect(url.searchParams.get("client_id")).toBe(
      "1234567890-example.apps.googleusercontent.com",
    );
    expect(url.searchParams.get("client_id")).not.toMatch(/\s/);
  });
});
