import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type FkAction = "cascade" | "set null" | "restrict";

type Graph = Record<string, Array<{ child: string; action: FkAction }>>;

function simulateDelete(graph: Graph, table: string): { deleted: Set<string>; blocked: boolean } {
  const deleted = new Set<string>([table]);
  const visiting = [table];
  while (visiting.length > 0) {
    const current = visiting.pop();
    if (!current) {
      break;
    }
    for (const edge of graph[current] ?? []) {
      if (edge.action === "restrict" && !deleted.has(edge.child)) {
        return { deleted, blocked: true };
      }
      if (edge.action === "cascade" && !deleted.has(edge.child)) {
        deleted.add(edge.child);
        visiting.push(edge.child);
      }
    }
  }
  return { deleted, blocked: false };
}

describe("RESEARCH website deletion graph", () => {
  const migration = readFileSync(
    path.join(__dirname, "../../../supabase/migrations/020_research_v0.sql"),
    "utf8",
  );

  it("lets website deletion succeed while RESEARCH rows are present", () => {
    expect(migration).toMatch(
      /website_id uuid not null references public\.websites \(id\) on delete cascade/,
    );
    expect(migration).toMatch(
      /site_model_id uuid references public\.site_models \(id\) on delete set null/,
    );
    expect(migration).toMatch(
      /requested_by uuid references public\.gsc_observe_owners \(id\) on delete set null/,
    );
    expect(migration).not.toMatch(/site_models \(id\) on delete restrict/);
    expect(migration).not.toMatch(/gsc_observe_owners \(id\) on delete restrict/);

    const graph: Graph = {
      websites: [
        { child: "research_runs", action: "cascade" },
        { child: "research_ideas", action: "cascade" },
        { child: "site_models", action: "cascade" },
        { child: "gsc_observe_owners", action: "cascade" },
      ],
      site_models: [{ child: "research_runs", action: "set null" }],
      gsc_observe_owners: [{ child: "research_runs", action: "set null" }],
      gsc_search_syncs: [{ child: "research_runs", action: "set null" }],
      research_runs: [{ child: "research_ideas", action: "cascade" }],
      research_ideas: [{ child: "decision_runs", action: "cascade" }],
    };

    const result = simulateDelete(graph, "websites");
    expect(result.blocked).toBe(false);
    expect(result.deleted.has("research_runs")).toBe(true);
    expect(result.deleted.has("research_ideas")).toBe(true);
    expect(result.deleted.has("decision_runs")).toBe(true);
  });
});
