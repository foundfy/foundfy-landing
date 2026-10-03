export function isFoundfyHomepageMetaTarget(input: {
  hostname: string;
  pageUrl: string;
  field: string;
  actionType: string;
}): boolean {
  if (input.actionType !== "update_meta_description" || input.field !== "meta_description") {
    return false;
  }

  if (input.hostname.replace(/^www\./, "") !== "foundfy.me") {
    return false;
  }

  try {
    const url = new URL(input.pageUrl);
    const host = url.hostname.replace(/^www\./, "");
    return host === "foundfy.me" && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
}
