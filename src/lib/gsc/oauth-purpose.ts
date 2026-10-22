export type GoogleOAuthPurpose = "connect" | "setup";

export function oauthPurposeFromReturnPath(returnPath: string): GoogleOAuthPurpose {
  try {
    const parsed = new URL(returnPath, "https://foundfy.invalid");
    return parsed.searchParams.get("observe") === "setup" ? "setup" : "connect";
  } catch {
    return "connect";
  }
}
