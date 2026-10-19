import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "../../..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === ".next" ||
      entry.name === "coverage"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Release A has no owner-facing targeted observe capability", () => {
  const files = walk(path.join(root, "src")).concat(walk(path.join(root, "scripts")));
  const appAndLib = files.filter(
    (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
  );
  const blob = appAndLib.map((file) => `${file}\n${readFileSync(file, "utf8")}`).join("\n");

  it("does not insert purpose targeted_observe", () => {
    expect(blob).not.toMatch(/purpose\s*:\s*CRAWL_RUN_PURPOSE_TARGETED_OBSERVE/);
    expect(blob).not.toMatch(/purpose\s*:\s*["']targeted_observe["']/);
  });

  it("does not insert targeted_observations rows", () => {
    expect(blob).not.toMatch(/from\(["']targeted_observations["']\)[\s\S]{0,200}\.insert/s);
    expect(blob).not.toMatch(/into public\.targeted_observations/i);
  });

  it("does not expose observe-candidates, targeted observe POST, or check-again APIs", () => {
    expect(blob).not.toMatch(/observe-candidates/);
    expect(blob).not.toMatch(/check-again/);
    expect(blob).not.toMatch(/persist_research_inspect_decision_with_observation/);
    const routes = readdirSync(path.join(root, "src/app/api"), { recursive: true })
      .map(String)
      .join("\n");
    expect(routes).not.toMatch(/observe-candidates/);
    expect(routes).not.toMatch(/check-again/);
  });

  it("creates normal crawls with explicit site_sample purpose", () => {
    const create = readFileSync(
      path.join(root, "src/lib/crawler/db/repository.ts"),
      "utf8",
    );
    expect(create).toMatch(/purpose: CRAWL_RUN_PURPOSE_SITE_SAMPLE/);
    expect(create).not.toMatch(/purpose: CRAWL_RUN_PURPOSE_TARGETED_OBSERVE/);
  });
});
