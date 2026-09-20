import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleUpdate = vi.fn();
const maybeSingleSelect = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "gsc_oauth_states") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        update: () => ({
          eq: () => ({
            is: () => ({
              gt: () => ({
                select: () => ({
                  maybeSingle: maybeSingleUpdate,
                }),
              }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: maybeSingleSelect,
          }),
        }),
      };
    },
  }),
}));

import { consumeOAuthState } from "./db";
import { OAuthStateError } from "./types";

const now = new Date("2026-09-20T12:00:00.000Z");

describe("OAuth state consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consumes a fresh unused state once", async () => {
    maybeSingleUpdate.mockResolvedValue({
      data: {
        id: "state-1",
        state: "abc",
        website_id: "website-1",
        return_path: "/site/website-1",
        expires_at: "2026-09-20T12:10:00.000Z",
        consumed_at: "2026-09-20T12:00:00.000Z",
      },
      error: null,
    });

    const consumed = await consumeOAuthState("abc", now);
    expect(consumed.websiteId).toBe("website-1");
    expect(maybeSingleSelect).not.toHaveBeenCalled();
  });

  it("rejects missing state", async () => {
    maybeSingleUpdate.mockResolvedValue({ data: null, error: null });
    maybeSingleSelect.mockResolvedValue({ data: null, error: null });

    await expect(consumeOAuthState("missing", now)).rejects.toMatchObject({
      reason: "missing",
    });
    await expect(consumeOAuthState("", now)).rejects.toBeInstanceOf(OAuthStateError);
  });

  it("rejects reused state", async () => {
    maybeSingleUpdate.mockResolvedValue({ data: null, error: null });
    maybeSingleSelect.mockResolvedValue({
      data: {
        id: "state-1",
        state: "abc",
        website_id: "website-1",
        return_path: "/site/website-1",
        expires_at: "2026-09-20T12:10:00.000Z",
        consumed_at: "2026-09-20T11:00:00.000Z",
      },
      error: null,
    });

    await expect(consumeOAuthState("abc", now)).rejects.toMatchObject({ reason: "reused" });
  });

  it("rejects expired state", async () => {
    maybeSingleUpdate.mockResolvedValue({ data: null, error: null });
    maybeSingleSelect.mockResolvedValue({
      data: {
        id: "state-1",
        state: "abc",
        website_id: "website-1",
        return_path: "/site/website-1",
        expires_at: "2026-09-20T11:50:00.000Z",
        consumed_at: null,
      },
      error: null,
    });

    await expect(consumeOAuthState("abc", now)).rejects.toMatchObject({ reason: "expired" });
  });
});
