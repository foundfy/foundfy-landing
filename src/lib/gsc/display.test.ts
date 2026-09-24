import { describe, expect, it } from "vitest";
import {
  OBSERVE_CONNECTED_NEXT,
  OBSERVE_CONNECTED_TITLE,
  OBSERVE_CONNECT_LABEL,
  OBSERVE_EVIDENCE_EMPTY_COPY,
  OBSERVE_EVIDENCE_TITLE,
  OBSERVE_NO_PROPERTY_COPY,
  OBSERVE_NOTICE_COPY,
  OBSERVE_QUERIES_REPORTED_LABEL,
  OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT,
  OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE,
  OBSERVE_SECTION_HEADING,
  OBSERVE_SYNC_LABEL,
  googleConnectedCopy,
} from "./display";

describe("OBSERVE Google-connection copy", () => {
  it("does not claim Search Console is connected before property binding", () => {
    const text = googleConnectedCopy();

    expect(OBSERVE_CONNECTED_TITLE).toBe("Google account connected");
    expect(OBSERVE_CONNECTED_NEXT).toMatch(/choose the Search Console property/i);
    expect(OBSERVE_NO_PROPERTY_COPY).toMatch(/couldn't find a Search Console property/i);
    expect(text).not.toMatch(/search console connected/i);
    expect(OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE).toBe("Search Console connected");
    expect(OBSERVE_CONNECT_LABEL).toBe("Connect Google");
    expect(OBSERVE_SECTION_HEADING).toBe("Google Search");
    expect(Object.values(OBSERVE_NOTICE_COPY).join(" ")).not.toMatch(/search console connected/i);
  });

  it("describes Search Analytics as evidence, not a decision", () => {
    const text = [
      OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT,
      OBSERVE_SYNC_LABEL,
      OBSERVE_EVIDENCE_TITLE,
      OBSERVE_EVIDENCE_EMPTY_COPY,
      OBSERVE_QUERIES_REPORTED_LABEL,
    ].join(" ");

    expect(OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT).toMatch(/ready to observe/i);
    expect(OBSERVE_EVIDENCE_EMPTY_COPY).toMatch(/hasn't reported search performance/i);
    expect(text).not.toMatch(/opportunity|high priority|optimize|you should|CTR is too low/i);
  });
});
