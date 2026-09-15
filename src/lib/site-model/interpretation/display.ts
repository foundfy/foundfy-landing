import type {
  SiteConfirmedUnderstanding,
  SiteInterpretationDraft,
  SiteInterpretationFields,
  SiteModelRecord,
  SiteModelStatus,
} from "../types";

export type SiteInterpretationView = {
  heading: string;
  statusLabel: string;
  narrative: string;
  uncertainty: string[];
  uncertaintyPreview: string[];
  askCopy: string | null;
  fields: SiteInterpretationFields;
  canConfirm: boolean;
  canEdit: boolean;
  whySummary: string;
};

function fieldsFromDisplayed(model: SiteModelRecord): {
  fields: SiteInterpretationFields;
  uncertainty: string[];
  source: "confirmed" | "interpretation" | "none";
} {
  if (model.confirmed) {
    return {
      fields: {
        siteDescription: model.confirmed.siteDescription,
        offers: model.confirmed.offers,
        audiences: model.confirmed.audiences,
        locations: model.confirmed.locations,
      },
      uncertainty: [],
      source: "confirmed",
    };
  }

  if (model.interpretation) {
    return {
      fields: {
        siteDescription: model.interpretation.siteDescription,
        offers: model.interpretation.offers,
        audiences: model.interpretation.audiences,
        locations: model.interpretation.locations,
      },
      uncertainty: model.interpretation.uncertainty,
      source: "interpretation",
    };
  }

  return {
    fields: {
      siteDescription: "",
      offers: [],
      audiences: [],
      locations: [],
    },
    uncertainty: [],
    source: "none",
  };
}

export function formatInterpretationNarrative(fields: SiteInterpretationFields): string {
  const parts: string[] = [];

  if (fields.siteDescription) {
    parts.push(fields.siteDescription);
  }

  if (fields.offers.length > 0) {
    parts.push(`It appears to offer or publish: ${fields.offers.join("; ")}.`);
  }

  if (fields.audiences.length > 0) {
    parts.push(`Who should find it: ${fields.audiences.join("; ")}.`);
  } else if (fields.siteDescription) {
    parts.push("Who should find it is not clear from the current crawl sample.");
  }

  if (fields.locations.length > 0) {
    parts.push(`Locations mentioned: ${fields.locations.join("; ")}.`);
  }

  return parts.join(" ");
}

export function formatInterpretationStatusLabel(
  status: SiteModelStatus,
  hasConfirmed: boolean,
): string {
  if (status === "stale" && hasConfirmed) {
    return "Confirmed · a newer crawl is available";
  }

  if (status === "confirmed" || hasConfirmed) {
    return "Confirmed";
  }

  return "Draft · not confirmed";
}

export function buildSiteInterpretationView(
  model: SiteModelRecord,
): SiteInterpretationView {
  const displayed = fieldsFromDisplayed(model);
  const hasConfirmed = model.confirmed !== null;
  const isDraft = model.status === "draft" && !hasConfirmed;

  return {
    heading: "Here’s what we understand about your site.",
    statusLabel: formatInterpretationStatusLabel(model.status, hasConfirmed),
    narrative: formatInterpretationNarrative(displayed.fields),
    uncertainty: displayed.uncertainty,
    uncertaintyPreview: displayed.uncertainty.slice(0, 1),
    askCopy: isDraft ? "Is this right?" : null,
    fields: displayed.fields,
    canConfirm: isDraft,
    canEdit: true,
    whySummary: "Why does Foundfy think this?",
  };
}

export function displayedInterpretationFields(
  model: SiteModelRecord,
): SiteInterpretationFields {
  return fieldsFromDisplayed(model).fields;
}

export function interpretationDraftFields(
  draft: SiteInterpretationDraft,
): SiteInterpretationFields {
  return {
    siteDescription: draft.siteDescription,
    offers: draft.offers,
    audiences: draft.audiences,
    locations: draft.locations,
  };
}

export function confirmedFields(
  confirmed: SiteConfirmedUnderstanding,
): SiteInterpretationFields {
  return {
    siteDescription: confirmed.siteDescription,
    offers: confirmed.offers,
    audiences: confirmed.audiences,
    locations: confirmed.locations,
  };
}
