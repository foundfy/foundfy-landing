import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Search Analytics stays out of findings and public overview", () => {
  it("does not write observations, findings, or jobs", () => {
    const sync = read("./sync.ts");
    const evidence = read("./evidence.ts");
    expect(sync).not.toMatch(/from \"@\/lib\/(observations|findings|jobs|recommendations)/);
    expect(evidence).not.toMatch(/from \"@\/lib\/(observations|findings|jobs|recommendations)/);
    expect(sync).not.toMatch(/openai|OpenAI/i);
    expect(evidence).not.toMatch(/openai|OpenAI/i);
  });
});
