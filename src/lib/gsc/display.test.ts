import { describe, expect, it } from "vitest";
import {
  OBSERVE_CONNECTED_NEXT,
  OBSERVE_CONNECTED_TITLE,
  OBSERVE_CONNECT_LABEL,
  OBSERVE_NOTICE_COPY,
  OBSERVE_SECTION_HEADING,
  assertObserveCopyDoesNotClaimSearchConsoleConnected,
} from "./display";

describe("OBSERVE Google-connection copy", () => {
  it("does not claim Search Console is connected before property binding", () => {
    const text = [
      OBSERVE_SECTION_HEADING,
      OBSERVE_CONNECT_LABEL,
      OBSERVE_CONNECTED_TITLE,
      OBSERVE_CONNECTED_NEXT,
      ...Object.values(OBSERVE_NOTICE_COPY),
    ].join(" ");

    expect(OBSERVE_CONNECTED_TITLE).toBe("Google account connected");
    expect(OBSERVE_CONNECTED_NEXT).toMatch(/choose the Search Console property/i);
    expect(text).not.toMatch(/search console connected/i);
    expect(() => assertObserveCopyDoesNotClaimSearchConsoleConnected(text)).not.toThrow();
  });
});
