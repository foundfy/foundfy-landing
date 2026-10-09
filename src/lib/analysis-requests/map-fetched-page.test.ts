import { describe, expect, it } from "vitest";
import { mapGscPageUrl } from "@/lib/gsc/page-map";
import { mapRequestedUrlToFetchedPage } from "./map-fetched-page";

const REQUIRED = "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo";

describe("mapRequestedUrlToFetchedPage", () => {
  it("maps www/apex and trailing-slash requested/final URLs", () => {
    const pages = [
      {
        id: "page-1",
        requestedUrl: "https://dbhobby.com/es/pintura-seda/set-de-cianotipo",
        finalUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo/",
      },
    ];

    expect(mapRequestedUrlToFetchedPage(REQUIRED, pages)?.id).toBe("page-1");
  });

  it("does not treat a canonical target as the requested page itself", () => {
    const pages = [
      {
        id: "page-es",
        requestedUrl: "https://www.dbhobby.com/es",
        finalUrl: "https://www.dbhobby.com/es",
      },
    ];
    const withCanonical = [
      {
        ...pages[0],
        canonical: REQUIRED,
      },
    ];

    expect(mapRequestedUrlToFetchedPage(REQUIRED, pages)).toBeNull();
    expect(mapGscPageUrl(REQUIRED, withCanonical)).toBe("page-es");
  });
});
