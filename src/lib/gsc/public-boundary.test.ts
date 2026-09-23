import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("public vs owner-private OBSERVE boundary", () => {
  it("keeps private Google OAuth state off the public website overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const overviewTypes = read("../websites/types.ts");

    expect(overviewLoader).not.toMatch(/google_identit|observeOwner|refresh_token|gsc_property/i);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/gsc|observeOwner|propertyUri/i);
    expect(overviewTypes).not.toMatch(/googleIdentity|refreshToken|observeOwner/i);
  });

  it("keeps Search Console binding copy out of public overview and metrics", () => {
    const ui = read("../../components/site/SiteObserveSection.tsx");
    expect(ui).toContain("OBSERVE_CONNECT_LABEL");
    expect(ui).toContain("OBSERVE_CONNECTED_TITLE");
    expect(ui).toContain("OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE");
    expect(ui).toContain("Connect Google to begin observing how people discover this site.");
    expect(ui).not.toMatch(/impressions|clicks|CTR|average position/i);
  });
});
