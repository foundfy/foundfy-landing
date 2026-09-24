import { beforeEach, describe, expect, it, vi } from "vitest";

const findActivePropertyConnectionMock = vi.fn();

vi.mock("./db", () => ({
  findActivePropertyConnection: (...args: unknown[]) => findActivePropertyConnectionMock(...args),
}));

import { findOwnerSearchConsoleConnection, isOwnerSearchConsoleConnection } from "./connection";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";
const owner = { googleIdentityId: "identity-1" };

function connectedProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: "2d401e8b-5fcc-4452-acfb-146bddb2f4cb",
    websiteId: WEBSITE_ID,
    observeOwnerId: "97acf07b-owner",
    googleIdentityId: "identity-1",
    propertyUri: "sc-domain:dbhobby.com",
    propertyType: "domain",
    permissionLevel: "siteOwner",
    confirmationSource: "user",
    status: "connected",
    ...overrides,
  };
}

describe("owner Search Console connection contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats the OBSERVE connected property as connected for DECIDE", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(connectedProperty());

    const connection = await findOwnerSearchConsoleConnection({
      websiteId: WEBSITE_ID,
      owner,
    });

    expect(connection?.propertyUri).toBe("sc-domain:dbhobby.com");
    expect(isOwnerSearchConsoleConnection(connection, owner)).toBe(true);
  });

  it("treats a missing property as disconnected", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      findOwnerSearchConsoleConnection({ websiteId: WEBSITE_ID, owner }),
    ).resolves.toBeNull();
  });

  it("treats a revoked property as disconnected", async () => {
    const revoked = connectedProperty({ status: "revoked" });
    findActivePropertyConnectionMock.mockResolvedValue(revoked);

    expect(isOwnerSearchConsoleConnection(revoked, owner)).toBe(false);
    await expect(
      findOwnerSearchConsoleConnection({ websiteId: WEBSITE_ID, owner }),
    ).resolves.toBeNull();
  });

  it("treats a property owned by another Google identity as disconnected", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(
      connectedProperty({ googleIdentityId: "identity-other" }),
    );

    await expect(
      findOwnerSearchConsoleConnection({ websiteId: WEBSITE_ID, owner }),
    ).resolves.toBeNull();
  });
});
