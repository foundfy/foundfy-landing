import { afterEach, describe, expect, it, vi } from "vitest";

const completeGoogleOAuthMock = vi.fn();

vi.mock("@/lib/gsc/oauth", () => ({
  completeGoogleOAuth: (...args: unknown[]) => completeGoogleOAuthMock(...args),
}));

import { OBSERVE_SESSION_COOKIE } from "@/lib/gsc/config";
import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

function cookieHeader(response: Response): string {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    return setCookie.join("\n");
  }

  return response.headers.get("set-cookie") ?? "";
}

describe("GET /api/gsc/oauth/callback", () => {
  it("sets an HttpOnly owner session cookie and never serializes the refresh token", async () => {
    completeGoogleOAuthMock.mockResolvedValue({
      redirectUrl: "/site/website-1?observe=connected",
      sessionToken: "opaque-session-token",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/gsc/oauth/callback?code=abc&state=state-1",
      ),
    );
    const cookies = cookieHeader(response);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/site/website-1?observe=connected");
    expect(cookies).toContain(`${OBSERVE_SESSION_COOKIE}=opaque-session-token`);
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).toMatch(/Path=\//i);
    expect(await response.text()).not.toContain("refresh");
  });
});
