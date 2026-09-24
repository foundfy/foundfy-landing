import { describe, expect, it } from "vitest";
import {
  OBSERVE_CONNECTED_NEXT,
  OBSERVE_CONNECTED_TITLE,
  OBSERVE_CONNECT_LABEL,
  OBSERVE_NO_PROPERTY_COPY,
  OBSERVE_NOTICE_COPY,
  OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE,
  OBSERVE_SECTION_HEADING,
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
});
