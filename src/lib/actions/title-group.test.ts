import { describe, expect, it } from "vitest";
import { TITLE_PRIMARY_REASON } from "@/lib/decisions/supported-action";
import {
  freezeTitleGroupEvidence,
  otherDuplicateMemberUrls,
  titlePrimaryPage,
} from "./title-group";

const HOME = "https://www.dbhobby.com/";
const CA = "https://www.dbhobby.com/ca/pintura-en-seda";

describe("title group primary page", () => {
  it("uses the Decision primary page instead of the first URL in the group", () => {
    expect(
      titlePrimaryPage({
        pageId: "page-home",
        pageUrl: HOME,
      }),
    ).toEqual({ pageId: "page-home", pageUrl: HOME });

    const others = otherDuplicateMemberUrls({
      targetUrl: HOME,
      observations: [
        {
          id: "obs-ca",
          pageId: "page-ca",
          ruleKey: "page_fundamentals.duplicate_title",
          status: "active",
          evidence: { title: "Pintura sobre seda | DBHOBBY", duplicatePages: [CA, HOME] },
        },
        {
          id: "obs-home",
          pageId: "page-home",
          ruleKey: "page_fundamentals.duplicate_title",
          status: "active",
          evidence: { title: "Pintura sobre seda | DBHOBBY", duplicatePages: [CA, HOME] },
        },
      ],
      evidenceRefs: [
        { kind: "page", recordId: "page-ca", snapshot: { pageUrl: CA } },
        { kind: "page", recordId: "page-home", snapshot: { pageUrl: HOME } },
      ],
    });

    expect(others).toEqual([CA]);
    expect(others).not.toContain(HOME);
  });

  it("freezes group provenance on the chosen page only", () => {
    const frozen = freezeTitleGroupEvidence({
      evidenceRefs: [
        { kind: "page", recordId: "page-ca", snapshot: { pageUrl: CA } },
        { kind: "page", recordId: "page-home", snapshot: { pageUrl: HOME } },
      ],
      targetPageId: "page-home",
      targetUrl: HOME,
      sharedTitle: "Pintura sobre seda | DBHOBBY",
      otherMemberUrls: [CA],
      group: true,
    });

    expect(frozen[0]?.snapshot).toEqual({ pageUrl: CA });
    expect(frozen[1]?.snapshot).toMatchObject({
      pageUrl: HOME,
      sharedTitle: "Pintura sobre seda | DBHOBBY",
      otherMemberUrls: [CA],
      primaryReason: TITLE_PRIMARY_REASON,
    });
  });
});
