import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(__dirname, "../../../supabase/migrations");

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

const migration024 = readFileSync(
  path.join(migrationsDir, "024_research_decide_investigation.sql"),
  "utf8",
);
const migration025 = readFileSync(
  path.join(migrationsDir, "025_targeted_observe_foundation.sql"),
  "utf8",
);
const migration026 = readFileSync(
  path.join(migrationsDir, "026_targeted_observation_claim.sql"),
  "utf8",
);
const migration027 = readFileSync(
  path.join(migrationsDir, "027_research_idea_gsc_unavailable.sql"),
  "utf8",
);

describe("migration 027 research idea gsc_unavailable", () => {
  it("keeps frozen 024/025/026 hashes and uses the exact 027 filename", () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(sha256(migration024)).toBe(
      "22238501a027860f212653081c608f36c4c04dec68ccf0e00e43374961072228",
    );
    expect(sha256(migration025)).toBe(
      "749cc08f107c6128e473d488ceb294abf7512306608005b90515dec2b35ec884",
    );
    expect(sha256(migration026)).toBe(
      "b831220182ee216d2e52f16b93f3bfaeaaffc47c77b87706a985517c0c30ff98",
    );
    expect(files.filter((name) => name.startsWith("024"))).toEqual([
      "024_research_decide_investigation.sql",
    ]);
    expect(files.filter((name) => name.startsWith("025"))).toEqual([
      "025_targeted_observe_foundation.sql",
    ]);
    expect(files.filter((name) => name.startsWith("026"))).toEqual([
      "026_targeted_observation_claim.sql",
    ]);
    expect(files.filter((name) => name.startsWith("027"))).toEqual([
      "027_research_idea_gsc_unavailable.sql",
    ]);
  });

  it("only expands the initial_gsc_sample_status CHECK", () => {
    expect(migration027).toContain("drop constraint research_ideas_initial_gsc_sample_status_check");
    expect(migration027).toContain("add constraint research_ideas_initial_gsc_sample_status_check");
    expect(migration027).toContain("'in_current_gsc_sample'");
    expect(migration027).toContain("'not_in_current_gsc_sample'");
    expect(migration027).toContain("'gsc_unavailable'");
    expect(migration027).not.toMatch(/alter table public\.research_runs/);
    expect(migration027).not.toMatch(/request_fingerprint/);
    expect(migration027).not.toMatch(/gsc_search_syncs/);
    expect(migration027).not.toMatch(/drop table/i);
  });
});
