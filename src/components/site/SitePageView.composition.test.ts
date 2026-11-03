/**
 * @vitest-environment jsdom
 *
 * Site Model section duplication is a sibling-key collision:
 * Understanding and Observe both used key={websiteId} under the same article.
 * Fetch is mocked — this never writes production data.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement, useState, type Dispatch, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_MODEL_ROW_VERSION, type SiteModelRecord } from "@/lib/site-model/types";

vi.mock("./SitePageView.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

import SiteUnderstandingSection from "./SiteUnderstandingSection";

const WEBSITE_A = "a1dc5561-8cca-4e46-a336-691ce29e3075";
const WEBSITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function model(websiteId: string): SiteModelRecord {
  return {
    id: `model-${websiteId}`,
    websiteId,
    sourceCrawlRunId: "run-1",
    version: SITE_MODEL_ROW_VERSION,
    status: "confirmed",
    understanding: {
      derivationVersion: 1,
      hostname: "foundfy.me",
      seedUrl: "https://foundfy.me/",
      sample: {
        pagesCrawled: 2,
        pagesDiscovered: 3,
        maxPages: 10,
        fetchedHttp200Count: 2,
        sampleIsCapped: true,
        fetchedEveryDiscoveredHtmlPage: false,
      },
      pageTypeCounts: [],
      pages: [],
      languages: { htmlLangs: ["en"], urlLocales: [] },
      navigationLabels: [],
      jsonLdTypes: [],
      jsonLdPropertyCount: 0,
      siteDiscovery: { robots: null, sitemaps: [] },
    },
    interpretation: {
      promptVersion: "site-interpretation-v1",
      generatedAt: "2026-11-01T12:00:00.000Z",
      generator: "heuristic",
      status: "ready",
      evidenceHash: "hash",
      sourceCrawlRunId: "run-1",
      siteDescription: "Draft",
      offers: [],
      audiences: [],
      locations: [],
      uncertainty: [],
    },
    confirmed: {
      confirmedAt: "2026-11-01T13:00:00.000Z",
      sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
      sourceGenerator: "heuristic",
      evidenceHash: "hash",
      sourceCrawlRunId: "run-1",
      siteDescription: "Foundfy helps people get found in search.",
      offers: ["SEO audit for small businesses"],
      audiences: ["website owners"],
      locations: [],
    },
    evidence: {
      source: "crawl",
      websiteId,
      crawlRunId: "run-1",
      pageIds: [],
      artifactIds: [],
      fields: [],
    },
    derivedAt: "2026-11-01T12:00:00.000Z",
  };
}

function understandingCount(container: HTMLElement): number {
  return container.querySelectorAll('section[aria-labelledby="site-understanding"]').length;
}

function understandingEdits(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll('section[aria-labelledby="site-understanding"] button')].filter(
    (node): node is HTMLButtonElement => node.textContent?.trim() === "Edit",
  );
}

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

type CollisionProps = {
  websiteId: string;
  tick: number;
  collide: boolean;
};

function CollisionArticle({ websiteId, tick, collide }: CollisionProps) {
  const understandingKey = collide ? websiteId : `understanding:${websiteId}`;
  const observeKey = collide ? websiteId : `observe:${websiteId}`;

  return createElement(
    "article",
    null,
    createElement(SiteUnderstandingSection, {
      key: understandingKey,
      websiteId,
      siteModel: model(websiteId),
      onUpdated: async () => undefined,
    }),
    createElement(
      "section",
      { key: observeKey, "aria-labelledby": "site-observe" },
      createElement("h2", { id: "site-observe" }, `Google Search ${tick}`),
    ),
  );
}

describe("Site Model sibling key collision", () => {
  let container: HTMLDivElement;
  let root: Root;
  let setProps: Dispatch<SetStateAction<CollisionProps>>;

  function Harness({ initial }: { initial: CollisionProps }) {
    const [props, update] = useState(initial);
    setProps = update;
    return createElement(CollisionArticle, props);
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("warns when Observe shares key={websiteId} with Understanding", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });

    act(() => {
      root.render(
        createElement(Harness, { initial: { websiteId: WEBSITE_A, tick: 0, collide: true } }),
      );
    });

    await act(async () => {
      setProps((current) => ({ ...current, tick: 1 }));
    });

    expect(errors.some((message) => message.includes("same key"))).toBe(true);
    expect(errors.some((message) => message.includes("duplicated"))).toBe(true);
  });

  it("keeps one Site Model section when Understanding and Observe keys are distinct", async () => {
    act(() => {
      root.render(
        createElement(Harness, { initial: { websiteId: WEBSITE_A, tick: 0, collide: false } }),
      );
    });

    expect(understandingCount(container)).toBe(1);
    expect(understandingEdits(container)).toHaveLength(1);

    await act(async () => {
      setProps((current) => ({ ...current, tick: 1 }));
    });

    expect(understandingCount(container)).toBe(1);
    expect(container.querySelectorAll("#site-understanding")).toHaveLength(1);

    await act(async () => {
      understandingEdits(container)[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelectorAll("form")).toHaveLength(1);
    const offers = container.querySelectorAll("textarea")[1] as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(offers, "SEO audit for small businesses\nTechnical checks");
    });
    expect(offers.value.split("\n")).toEqual([
      "SEO audit for small businesses",
      "Technical checks",
    ]);

    await act(async () => {
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      String((vi.mocked(fetch).mock.calls[0] as [string, { body?: string }])[1].body),
    ) as { offers: string[] };
    expect(payload.offers).toEqual(["SEO audit for small businesses", "Technical checks"]);
  });

  it("does not leak website A draft after switching websiteId with distinct keys", async () => {
    act(() => {
      root.render(
        createElement(Harness, { initial: { websiteId: WEBSITE_A, tick: 0, collide: false } }),
      );
    });

    await act(async () => {
      understandingEdits(container)[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const offers = container.querySelectorAll("textarea")[1] as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(offers, "Unsaved website A draft");
    });

    await act(async () => {
      setProps({ websiteId: WEBSITE_B, tick: 1, collide: false });
    });

    expect(understandingCount(container)).toBe(1);
    expect(container.textContent).not.toContain("Unsaved website A draft");
    expect(container.textContent).toContain("Foundfy helps people get found in search.");
  });
});

describe("SitePageView sibling keys", () => {
  it("gives Understanding and Observe distinct React keys", () => {
    const page = readFileSync(path.join(__dirname, "SitePageView.tsx"), "utf8");
    const understanding = page.slice(
      page.indexOf("<SiteUnderstandingSection"),
      page.indexOf("<SiteUnderstandingSection") + 280,
    );
    const observe = page.slice(
      page.indexOf("<SiteObserveSection"),
      page.indexOf("<SiteObserveSection") + 180,
    );

    expect(page.match(/<SiteUnderstandingSection/g)).toHaveLength(1);
    expect(understanding).toMatch(/key=\{/);
    expect(observe).toMatch(/key=\{/);
    expect(understanding).toContain("key={`understanding:${websiteId}`}");
    expect(observe).toContain("key={`observe:${websiteId}`}");
    expect(understanding.includes("key={websiteId}")).toBe(false);
    expect(observe.includes("key={websiteId}")).toBe(false);
  });
});
