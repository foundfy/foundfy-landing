/**
 * @vitest-environment jsdom
 *
 * Isolated React interaction for Google indexing owner states.
 * This never calls Google APIs.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GoogleIndexingEvidenceInput,
  StoredGoogleIndexingEvidence,
  StoredGooglePerformanceEvidence,
} from "@/lib/foundations/types";

vi.mock("./SitePageView.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

import SiteFoundationsSection from "./SiteFoundationsSection";

const WEBSITE_A = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const WEBSITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const google: StoredGooglePerformanceEvidence = {
  websiteId: WEBSITE_A,
  evidence: null,
  view: null,
  loadError: null,
};

function checkedEvidence(
  overrides: Partial<Extract<GoogleIndexingEvidenceInput, { kind: "checked" }>> = {},
): Extract<GoogleIndexingEvidenceInput, { kind: "checked" }> {
  return {
    kind: "checked",
    inspectedAt: "2026-11-03T23:44:07.651Z",
    reused: false,
    urls: [
      {
        url: "https://selcukdemirci.me/",
        role: "homepage",
        verdict: "indexed",
        coverageState: "Submitted and indexed",
        indexingState: "INDEXING_ALLOWED",
        robotsTxtState: null,
        pageFetchState: null,
        lastCrawlTime: "2026-11-01T10:00:00.000Z",
        inspectedAt: "2026-11-03T23:44:07.651Z",
        userCanonical: "https://selcukdemirci.me/",
        googleCanonical: "https://selcukdemirci.me/",
        canonicalMismatch: false,
        referringUrls: [],
        sitemaps: ["https://selcukdemirci.me/sitemap.xml"],
        reason: "Submitted and indexed",
      },
      {
        url: "https://selcukdemirci.me/about",
        role: "important_page",
        verdict: "not_indexed",
        coverageState: "Crawled - currently not indexed",
        indexingState: null,
        robotsTxtState: null,
        pageFetchState: null,
        lastCrawlTime: null,
        inspectedAt: "2026-11-03T23:44:07.651Z",
        userCanonical: "https://selcukdemirci.me/about",
        googleCanonical: null,
        canonicalMismatch: false,
        referringUrls: [],
        sitemaps: [],
        reason: "Crawled - currently not indexed",
      },
      {
        url: "https://selcukdemirci.me/contact",
        role: "important_page",
        verdict: "unknown",
        coverageState: null,
        indexingState: "INDEXING_ALLOWED",
        robotsTxtState: null,
        pageFetchState: null,
        lastCrawlTime: null,
        inspectedAt: "2026-11-03T23:44:07.651Z",
        userCanonical: "https://selcukdemirci.me/contact",
        googleCanonical: null,
        canonicalMismatch: false,
        referringUrls: [],
        sitemaps: [],
        reason: null,
      },
    ],
    sitemap: {
      crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
      listedInSearchConsole: true,
      sitemaps: [
        {
          path: "https://selcukdemirci.me/sitemap.xml",
          lastSubmitted: "2026-11-01T09:00:00.000Z",
          lastDownloaded: "2026-11-01T09:05:00.000Z",
          pending: false,
          errors: 0,
          warnings: 0,
          submittedUrlCount: 3,
        },
      ],
      interpretation: "listed_and_processed",
    },
    ...overrides,
  };
}

function snapshot(
  websiteId: string,
  evidence: GoogleIndexingEvidenceInput,
  loadError: string | null = null,
): StoredGoogleIndexingEvidence {
  return { websiteId, evidence, loadError };
}

describe("SiteFoundationsSection Google indexing owner states", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onCheckIndexing: ReturnType<typeof vi.fn>;

  function render(props: {
    websiteId?: string;
    indexing: StoredGoogleIndexingEvidence;
    indexingBusy?: boolean;
    indexingCheckAvailable?: boolean;
  }) {
    act(() => {
      root.render(
        createElement(SiteFoundationsSection, {
          websiteId: props.websiteId ?? WEBSITE_A,
          foundations: null,
          scanCompletedAt: null,
          google: { ...google, websiteId: props.websiteId ?? WEBSITE_A },
          indexing: props.indexing,
          indexingBusy: props.indexingBusy ?? false,
          indexingCheckAvailable: props.indexingCheckAvailable ?? true,
          onCheckIndexing,
        }),
      );
    });
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label,
    ) as HTMLButtonElement | undefined;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onCheckIndexing = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the primary action before a check and does not claim completion", () => {
    render({
      indexing: snapshot(WEBSITE_A, { kind: "not_checked" }),
    });

    const cta = button("Check Google indexing");
    expect(cta).toBeTruthy();
    expect(cta?.disabled).toBe(false);
    expect(cta?.className).toContain("observeConnectButton");
    expect(cta?.className).not.toContain("indexingSecondaryButton");
    expect(container.textContent).not.toContain("Google indexing checked");
    expect(button("Check again")).toBeUndefined();
  });

  it("disables the in-progress action so duplicate clicks are ignored", () => {
    render({
      indexing: snapshot(WEBSITE_A, { kind: "not_checked" }),
      indexingBusy: true,
    });

    const cta = button("Checking Google indexing…");
    expect(cta?.disabled).toBe(true);
    cta?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onCheckIndexing).not.toHaveBeenCalled();
  });

  it("shows the completed timestamp, mixed counts, secondary Check again, and sitemap evidence", () => {
    render({
      indexing: snapshot(WEBSITE_A, checkedEvidence()),
    });

    expect(container.textContent).toContain("Google indexing checked");
    expect(container.textContent).toContain("Indexed: 1 · Not indexed: 1 · Unknown: 1");
    expect(container.textContent).toMatch(/Checked .+2026/);
    expect(container.textContent).toContain("https://selcukdemirci.me/about");
    expect(container.textContent).toContain("Sitemap status in Search Console");
    expect(container.textContent).toContain("https://selcukdemirci.me/sitemap.xml");
    expect(container.textContent).toContain("Last Google crawl");

    const again = button("Check again");
    expect(again).toBeTruthy();
    expect(again?.disabled).toBe(false);
    expect(again?.className).toContain("indexingSecondaryButton");
    expect(button("Check Google indexing")).toBeUndefined();

    again?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onCheckIndexing).toHaveBeenCalledTimes(1);
  });

  it("offers Retry after an error and keeps previous results distinct from the failed attempt", () => {
    render({
      indexing: snapshot(
        WEBSITE_A,
        checkedEvidence(),
        "Foundfy could not complete a new Google indexing check.",
      ),
    });

    expect(container.textContent).not.toContain("Google indexing checked");
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "could not complete a new Google indexing check",
    );
    expect(container.textContent).toContain(
      "The results below are from the previous check. They are not from this failed attempt.",
    );
    expect(container.textContent).toContain("https://selcukdemirci.me/");
    const retry = button("Retry check");
    expect(retry).toBeTruthy();
    retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onCheckIndexing).toHaveBeenCalledTimes(1);
  });

  it("does not show a completed check for unavailable evidence or ineligible owners", () => {
    render({
      indexing: snapshot(WEBSITE_A, { kind: "unavailable", code: "unavailable" }),
    });
    expect(container.textContent).not.toContain("Google indexing checked");
    expect(button("Retry check")).toBeTruthy();

    render({
      indexing: snapshot(WEBSITE_A, { kind: "pilot_ineligible" }),
      indexingCheckAvailable: false,
    });
    expect(button("Check Google indexing")).toBeUndefined();
    expect(button("Check again")).toBeUndefined();
    expect(button("Retry check")).toBeUndefined();
    expect(container.textContent).not.toContain("Google indexing checked");
  });

  it("does not leak website A results onto website B", () => {
    render({
      websiteId: WEBSITE_B,
      indexing: snapshot(WEBSITE_A, checkedEvidence()),
    });

    expect(container.textContent).not.toContain("Google indexing checked");
    expect(container.textContent).not.toContain("https://selcukdemirci.me/about");
    expect(button("Check Google indexing")).toBeTruthy();
  });
});
