import { afterEach, describe, expect, it, vi } from "vitest";

const listObservePropertiesMock = vi.fn();

vi.mock("@/lib/gsc/properties", () => ({
  listObserveProperties: (...args: unknown[]) => listObservePropertiesMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/observe/properties", () => {
  it("requires an owner session", async () => {
    listObservePropertiesMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/properties"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(listObservePropertiesMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });
});
