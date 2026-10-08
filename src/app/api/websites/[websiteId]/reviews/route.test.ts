import { afterEach, describe, expect, it, vi } from "vitest";

const listCanonicalReviewsForOwnerMock = vi.fn();
const submitCanonicalReviewMock = vi.fn();

vi.mock("@/lib/actions/review", () => ({
  listCanonicalReviewsForOwner: (...args: unknown[]) => listCanonicalReviewsForOwnerMock(...args),
  submitCanonicalReview: (...args: unknown[]) => submitCanonicalReviewMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { ActionError } from "@/lib/actions/types";
import { GET, POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const DECISION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/websites/[websiteId]/reviews", () => {
  it("requires an owner session to list reviews", async () => {
    listCanonicalReviewsForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/reviews"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("records a canonical review outcome", async () => {
    submitCanonicalReviewMock.mockResolvedValue({
      id: "review-1",
      reviewType: "review_canonical_target",
      outcome: "intentional",
      pageUrl: "https://www.dbhobby.com/es",
      canonicalUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    });

    const response = await POST(
      new Request("https://www.foundfy.me/reviews", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: DECISION_ID, outcome: "intentional" }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reviewType: "review_canonical_target",
      outcome: "intentional",
    });
    expect(submitCanonicalReviewMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: DECISION_ID,
      outcome: "intentional",
    });
  });

  it("returns 409 for an unsupported Decision", async () => {
    submitCanonicalReviewMock.mockRejectedValue(
      new ActionError(
        "unsupported_decision",
        "Foundfy can only record a canonical review from a current canonical-points-elsewhere Decision.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/reviews", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: DECISION_ID, outcome: "intentional" }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "unsupported_decision" });
  });
});
