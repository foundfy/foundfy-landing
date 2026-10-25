import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("C0 Search Presence boundaries", () => {
  const setup = read("./setup.ts");
  const verification = read("./site-verification.ts");
  const oauthUrl = read("./oauth-url.ts");
  const config = read("./config.ts");
  const observe = read("./observe.ts");
  const properties = read("./properties.ts");
  const ui = read("../../components/site/SiteObserveSection.tsx");
  const privacy = read("../privacy/content.ts");

  it("does not write DNS, call registrars, or use META/FILE verification", () => {
    const blob = [setup, verification, ui].join("\n");
    expect(blob).not.toMatch(/cloudflare|route53|registrar|namecheap|dnsimple/i);
    expect(blob).not.toMatch(/DNS_CNAME|"FILE"|"META"|TAG_MANAGER/);
    expect(verification).toMatch(/DNS_TXT/);
    expect(verification).toMatch(/INET_DOMAIN/);
    expect(verification).not.toMatch(/webResource\.list|webResource\/list/);
  });

  it("does not request full siteverification and keeps first-connect readonly", () => {
    expect(config).toMatch(/GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE/);
    expect(oauthUrl).toMatch(/include_granted_scopes/);
    expect(oauthUrl).toMatch(/GOOGLE_OAUTH_SETUP_SCOPE_STRING/);
    expect(oauthUrl).toMatch(/C0 setup must not request full siteverification/);
    expect(config).toContain(`export const GOOGLE_OAUTH_SETUP_SCOPES = [
  GOOGLE_WEBMASTERS_SCOPE,
  GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE,
] as const;`);
  });

  it("does not persist verification tokens or setup state", () => {
    expect(setup).not.toMatch(/from\(["']gsc_.*verif/);
    expect(setup).not.toMatch(/verification_token|dns_txt_token/);
    expect(setup).not.toMatch(/console\.(log|info|error|debug).*token/i);
    expect(verification).not.toMatch(/console\.(log|info|error|debug)/);
  });

  it("does not execute ACT, DataForSEO, OpenAI, or live RESEARCH", () => {
    const blob = [setup, verification, observe, properties].join("\n");
    expect(blob).not.toMatch(/from \"@\/lib\/(actions\/execute|research\/providers|openai)/);
    expect(blob).not.toMatch(/dataforseo|OpenAI|RESEARCH_LIVE_ENABLED/i);
    expect(blob).not.toMatch(/claim_targeted_observation|finalize_targeted_observation/);
    expect(blob).not.toMatch(/source_inspect_run_id/);
  });

  it("does not mutate Release B inspect provenance", () => {
    expect(setup).not.toMatch(/gsc_search_sync_id/);
    expect(setup).not.toMatch(/inspect-t1|inspect-db|targeted_observations/);
    expect(properties).toMatch(/existing && existing.propertyUri !== verified.siteUrl/);
  });

  it("keeps owner copy account-scoped and does not claim Foundfy writes DNS", () => {
    expect(ui).toContain("OBSERVE_NO_PROPERTY_COPY");
    expect(ui).toContain("OBSERVE_SETUP_LABEL");
    expect(ui).toContain("OBSERVE_USE_ANOTHER_ACCOUNT_LABEL");
    expect(ui).toContain("OBSERVE_CONTINUE_SETUP_LABEL");
    expect(ui).toMatch(/observe\/setup\/connect/);
    expect(ui).toContain("onContinueSetup");
    expect(ui).toContain("showSetup && !verificationPending && !setupAuthRequired");
    const connectedPanel = ui.slice(
      ui.indexOf("function GoogleConnectedPanel"),
      ui.indexOf("function SearchConsoleConnectedPanel"),
    );
    expect(connectedPanel).not.toContain("OBSERVE_CONNECT_LABEL");
    expect(connectedPanel).not.toMatch(/observe\/connect(?!ed)/);
    const verifiedPanel = ui.slice(ui.indexOf("function SearchConsoleConnectedPanel"));
    expect(verifiedPanel).not.toContain("OBSERVE_CONNECT_LABEL");
    expect(verifiedPanel).not.toMatch(/\/observe\/connect/);
    expect(ui).not.toMatch(/No Search Console property exists/);
    expect(privacy).toContain("does not change your DNS");
    expect(privacy).not.toMatch(/Foundfy writes DNS|Foundfy updates your DNS/);
  });

  it("does not add a C0 SQL migration", () => {
    const migrations = readdirSync(path.join(__dirname, "../../../supabase/migrations"));
    expect(migrations.some((name) => name.includes("027"))).toBe(false);
  });

  it("keeps identity-scoped tokens and does not treat every Google write failure as DNS pending", () => {
    expect(observe).toMatch(/google_oauth_tokens is Google-identity-scoped/);
    expect(observe).toMatch(/remaining === 0 && token/);
    const verificationClient = read("./site-verification.ts");
    expect(verificationClient).toMatch(/if \(response\.status === 400\) \{\s*return "pending";/s);
    expect(verificationClient).toMatch(/throwForGoogleSetupFailure/);
    expect(setup).toMatch(/addResult === "conflict"/);
  });
});
