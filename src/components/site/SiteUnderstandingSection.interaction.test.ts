/**
 * @vitest-environment jsdom
 *
 * Isolated React interaction for the Site Model editor.
 * Fetch is mocked — this never reads or writes production data.
 */
import { act, createElement } from "react";
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

const WEBSITE_A = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const WEBSITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const THREE_OFFERS = [
  "Filmmaking",
  "Creative Direction",
  "Commercial Production",
] as const;

function model(overrides: Partial<SiteModelRecord> = {}): SiteModelRecord {
  return {
    id: "model-selcuk",
    websiteId: WEBSITE_A,
    sourceCrawlRunId: "run-selcuk",
    version: SITE_MODEL_ROW_VERSION,
    status: "confirmed",
    understanding: {
      derivationVersion: 1,
      hostname: "selcukdemirci.me",
      seedUrl: "https://selcukdemirci.me/",
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
      evidenceHash: "hash-selcuk",
      sourceCrawlRunId: "run-selcuk",
      siteDescription: "The homepage heading is “Filmmaking”.",
      offers: ["Filmmaking"],
      audiences: [],
      locations: [],
      uncertainty: [],
    },
    confirmed: {
      confirmedAt: "2026-11-01T13:00:00.000Z",
      sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
      sourceGenerator: "heuristic",
      evidenceHash: "hash-selcuk",
      sourceCrawlRunId: "run-selcuk",
      siteDescription: "Selcuk Demirci makes films for artists and brands.",
      offers: ["Filmmaking"],
      audiences: ["artists"],
      locations: [],
    },
    evidence: {
      source: "crawl",
      websiteId: WEBSITE_A,
      crawlRunId: "run-selcuk",
      pageIds: [],
      artifactIds: [],
      fields: [],
    },
    derivedAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function labeledTextarea(container: HTMLElement, label: string): HTMLTextAreaElement {
  const match = [...container.querySelectorAll("label")].find((node) =>
    (node.textContent ?? "").includes(label),
  );
  const textarea = match?.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error(`No textarea for label: ${label}`);
  }
  return textarea;
}

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`No button: ${label}`);
  }
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("SiteUnderstandingSection editor interaction", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmedAfterSave: SiteModelRecord;

  function editorElement(props: {
    websiteId: string;
    siteModel: SiteModelRecord;
    onUpdated: () => Promise<void>;
  }) {
    return createElement(SiteUnderstandingSection, {
      key: props.websiteId,
      websiteId: props.websiteId,
      siteModel: props.siteModel,
      onUpdated: props.onUpdated,
    });
  }

  function renderEditor(props: {
    websiteId: string;
    siteModel: SiteModelRecord;
    onUpdated?: () => Promise<void>;
  }) {
    const onUpdated =
      props.onUpdated ??
      (async () => {
        act(() => {
          root.render(
            editorElement({
              websiteId: props.websiteId,
              siteModel: confirmedAfterSave,
              onUpdated: async () => undefined,
            }),
          );
        });
      });

    act(() => {
      root.render(
        editorElement({
          websiteId: props.websiteId,
          siteModel: props.siteModel,
          onUpdated,
        }),
      );
    });
  }

  async function submitForm() {
    await act(async () => {
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    confirmedAfterSave = model({
      confirmed: {
        confirmedAt: "2026-11-03T10:00:00.000Z",
        sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
        sourceGenerator: "heuristic",
        evidenceHash: "hash-selcuk",
        sourceCrawlRunId: "run-selcuk",
        siteDescription: "Selcuk Demirci makes films for artists and brands.",
        offers: [...THREE_OFFERS],
        audiences: ["artists"],
        locations: [],
      },
    });
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("opens on Edit, keeps newlines and spaces, and saves three distinct offerings", async () => {
    renderEditor({ websiteId: WEBSITE_A, siteModel: model() });

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelectorAll("#site-understanding")).toHaveLength(1);
    expect(
      [...container.querySelectorAll("button")].filter(
        (node) => node.textContent?.trim() === "Edit",
      ),
    ).toHaveLength(1);

    await act(async () => {
      clickButton(container, "Edit");
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelectorAll("#site-understanding")).toHaveLength(1);

    const offers = labeledTextarea(
      container,
      "What it appears to offer or publish",
    );

    await act(async () => {
      setNativeValue(offers, "Filmmaking");
    });
    expect(offers.value).toBe("Filmmaking");

    await act(async () => {
      setNativeValue(offers, "Filmmaking\n");
    });
    expect(offers.value).toBe("Filmmaking\n");

    await act(async () => {
      setNativeValue(offers, "Filmmaking\nCreative Direction");
    });
    expect(offers.value).toBe("Filmmaking\nCreative Direction");

    await act(async () => {
      setNativeValue(offers, "Filmmaking\nCreative Direction\nCommercial Production");
    });
    expect(offers.value).toBe(
      "Filmmaking\nCreative Direction\nCommercial Production",
    );

    await act(async () => {
      setNativeValue(offers, "Filmmaking \nCreative Direction\nCommercial Production");
    });
    expect(offers.value).toContain("Filmmaking ");

    await act(async () => {
      setNativeValue(
        offers,
        "Filmmaking\nCreative Direction\nCommercial Production",
      );
    });

    await submitForm();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ];
    expect(url).toBe(`/api/websites/${WEBSITE_A}/confirm`);
    expect(init.method).toBe("POST");
    const payload = JSON.parse(String(init.body)) as {
      offers: string[];
      siteDescription: string;
    };
    expect(payload.offers).toEqual([...THREE_OFFERS]);
    expect(payload.siteDescription).toBe(
      "Selcuk Demirci makes films for artists and brands.",
    );

    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("Filmmaking");
    expect(container.textContent).toContain("Creative Direction");
    expect(container.textContent).toContain("Commercial Production");
  });

  it("edits one offering without removing the other two", async () => {
    const saved = model({
      confirmed: {
        confirmedAt: "2026-11-03T10:00:00.000Z",
        sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
        sourceGenerator: "heuristic",
        evidenceHash: "hash-selcuk",
        sourceCrawlRunId: "run-selcuk",
        siteDescription: "Selcuk Demirci makes films for artists and brands.",
        offers: [...THREE_OFFERS],
        audiences: ["artists"],
        locations: [],
      },
    });
    confirmedAfterSave = model({
      confirmed: {
        ...saved.confirmed!,
        offers: [
          "Filmmaking",
          "Creative Direction for brands",
          "Commercial Production",
        ],
      },
    });

    renderEditor({ websiteId: WEBSITE_A, siteModel: saved });

    await act(async () => {
      clickButton(container, "Edit");
    });

    const offers = labeledTextarea(
      container,
      "What it appears to offer or publish",
    );
    expect(offers.value).toBe(THREE_OFFERS.join("\n"));

    await act(async () => {
      setNativeValue(
        offers,
        "Filmmaking\nCreative Direction for brands\nCommercial Production",
      );
    });
    expect(offers.value.split("\n")).toEqual([
      "Filmmaking",
      "Creative Direction for brands",
      "Commercial Production",
    ]);

    await submitForm();

    const payload = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as [string, { body?: string }])[1].body,
      ),
    ) as { offers: string[] };
    expect(payload.offers).toEqual([
      "Filmmaking",
      "Creative Direction for brands",
      "Commercial Production",
    ]);
  });

  it("does not expose website A unsaved draft after switching websiteId", async () => {
    renderEditor({
      websiteId: WEBSITE_A,
      siteModel: model(),
      onUpdated: async () => undefined,
    });

    await act(async () => {
      clickButton(container, "Edit");
    });

    const offersA = labeledTextarea(
      container,
      "What it appears to offer or publish",
    );
    await act(async () => {
      setNativeValue(offersA, "Unsaved website A draft\nSecond A line");
    });
    expect(offersA.value).toContain("Unsaved website A draft");

    renderEditor({
      websiteId: WEBSITE_B,
      siteModel: model({
        id: "model-b",
        websiteId: WEBSITE_B,
        confirmed: {
          confirmedAt: "2026-11-03T10:00:00.000Z",
          sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
          sourceGenerator: "heuristic",
          evidenceHash: "hash-b",
          sourceCrawlRunId: "run-b",
          siteDescription: "Website B only.",
          offers: ["Search visibility"],
          audiences: [],
          locations: [],
        },
      }),
      onUpdated: async () => undefined,
    });

    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toContain("Unsaved website A draft");
    expect(container.textContent).toContain("Search visibility");

    await act(async () => {
      clickButton(container, "Edit");
    });

    const offersB = labeledTextarea(
      container,
      "What it appears to offer or publish",
    );
    expect(offersB.value).toBe("Search visibility");
    expect(offersB.value).not.toContain("Unsaved website A draft");
    expect(container.querySelectorAll("#site-understanding")).toHaveLength(1);
  });
});
