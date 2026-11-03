import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Google Indexing Observation v0 boundary", () => {
  const inspect = read("./url-inspection.ts");
  const sitemaps = read("./sitemaps.ts");
  const check = read("./indexing-check.ts");
  const route = read("../../app/api/websites/[websiteId]/observe/indexing/check/route.ts");
  const hook = read("../../hooks/useGoogleIndexingEvidence.ts");
  const page = read("../../components/site/SitePageView.tsx");
  const ui = read("../../components/site/SiteFoundationsSection.tsx");
  const blob = [inspect, sitemaps, check, route, hook, page, ui].join("\n");

  it("Q. does not submit sitemaps, request indexing, or change OAuth grants", () => {
    expect(blob).not.toMatch(/urlNotifications:publish|indexing:publish|notifyUrl/i);
    expect(blob).not.toMatch(/sitemaps\.submit|submitSitemap|sitemaps\.delete/i);
    expect(blob).not.toMatch(/GOOGLE_OAUTH_SETUP_SCOPES|include_granted_scopes|siteverification/i);
    expect(read("./config.ts")).toContain("urlInspection/index:inspect");
    expect(inspect).toContain("GOOGLE_URL_INSPECTION_INSPECT_URL");
    expect(inspect).toContain('method: "POST"');
    expect(sitemaps).toContain("/sitemaps");
    expect(sitemaps).not.toMatch(/sitemaps\/\$\{|sitemaps\.get/);
    expect(route).toContain("export async function POST");
    expect(route).not.toMatch(/export async function GET/);
    expect(route).not.toMatch(/request\.json\(|inspectionUrl/);
  });

  it("does not auto-inspect on page mount and keeps the check owner-initiated", () => {
    expect(hook).toContain('method: "POST"');
    expect(hook).toContain("/observe/indexing/check");
    expect(
      hook.slice(hook.indexOf("useEffect"), hook.indexOf("const check")),
    ).not.toMatch(/fetch|indexing\/check/);
    expect(page).toContain("useGoogleIndexingEvidence(websiteId)");
    expect(page.match(/useGoogleIndexingEvidence\(/g)?.length).toBe(1);
    expect(ui).toContain("GOOGLE_INDEXING_CHECK_LABEL");
    expect(ui).toContain("onCheckIndexing");
    expect(ui).not.toMatch(/useEffect/);
  });

  it("does not add a schema, scheduler, or Decision/Research/ACT coupling", () => {
    const migrations = readdirSync(path.join(__dirname, "../../../supabase/migrations"));
    expect(
      migrations.filter((name) => /google.indexing|indexing_observation|url_inspection/i.test(name)),
    ).toEqual([]);
    expect(blob).not.toMatch(/alter table|create table|setInterval|cron/i);
    expect(check).not.toMatch(/from \"@\/lib\/(decisions|research|actions)/);
    expect(route).not.toMatch(/from \"@\/lib\/(decisions|research|actions)/);
  });
});
