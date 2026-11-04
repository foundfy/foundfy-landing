#!/usr/bin/env node
// Local disposable PostgreSQL 17 gate for the Google-derived data cleanup (C1).
// Not applied to production. Synthetic fixtures only.
//
//   node scripts/google-cleanup-pg-gate.mjs
//
// Applies migrations 001-028 (current production schema, including 016) to a throwaway
// container, then replays removeGoogleDerivedOwnerDataForWebsite as the app performs it:
// one statement per PostgREST call, each in its own transaction, stopping at the first error.
// Statement predicates mirror src/lib/actions/google-privacy.ts and its helpers:
//   analysis-requests/db.ts  disconnectAnalysisRequestsForWebsite   (a1, a2)
//   actions/db.ts            deleteOpenActionsForWebsite            (b)
//                            deleteActionLearningSnapshotsForWebsite (c)
//                            scrubGoogleMetricsFromActionEvidence   (d)
//   actions/review-db.ts     scrubGoogleMetricsFromReviewEvidence   (e1, e2)
//   decisions/db.ts          deleteDecisionEngineForWebsite         (legacy: f | corrected: f1, f2, f3)
//   observe/db.ts            deleteTargetedObservationsForWebsite   (f2)
//   gsc/db-search.ts         deleteSearchAnalyticsForWebsite        (g1, g2)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const container = "foundfy-google-cleanup-pg-gate";
const image = "postgres:17-alpine";
const sqlFile = path.join(root, "scripts/google-cleanup-pg-gate.sql");
const results = [];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options });
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", sql,
  ]).trim();
}

function psqlFile(filePath) {
  return run(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
    { input: readFileSync(filePath, "utf8") },
  );
}

function tryPsql(sql) {
  try {
    return { ok: true, out: psql(sql) };
  } catch (error) {
    return { ok: false, out: String(error?.stderr ?? error?.message ?? error).trim() };
  }
}

function sleep(ms) {
  execFileSync("sleep", [String(ms / 1000)]);
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      psql("select 1;");
      return;
    } catch {
      sleep(500);
    }
  }
  throw new Error("Postgres did not become ready");
}

function applyMigrations() {
  const dir = path.join(root, "supabase/migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right, "en"));
  for (const name of files) {
    psqlFile(path.join(dir, name));
  }
  return files.length;
}

function check(test, ok, detail = "") {
  results.push({ test, status: ok ? "PASS" : "FAIL", detail: ok ? "" : detail });
  log(`${ok ? "PASS" : "FAIL"}  ${test}${ok ? "" : `  -- ${detail}`}`);
}

function websiteId(prefix) {
  return psql(`select google_cleanup_gate_website('${prefix}');`);
}

function state(prefix) {
  return JSON.parse(psql(`select google_cleanup_gate_state('${prefix}');`));
}

function orphans() {
  return JSON.parse(psql("select google_cleanup_gate_orphans();"));
}

function cleanupSteps(website, decisionEngine) {
  const w = `'${website}'`;
  const decisionSteps =
    decisionEngine === "legacy"
      ? [["f", `delete from decision_runs where website_id = ${w}`]]
      : [
          ["f1", `delete from decision_runs where website_id = ${w} and targeted_observation_id is not null`],
          ["f2", `delete from targeted_observations where website_id = ${w}`],
          ["f3", `delete from decision_runs where website_id = ${w}`],
        ];
  return [
    ["a1", `update analysis_requests set status = 'blocked', failure_reason = 'google_disconnected', decision_id = null, decision_run_id = null, gsc_sync_id = null, updated_at = now() where website_id = ${w} and status in ('requested', 'running')`],
    ["a2", `update analysis_requests set decision_id = null, decision_run_id = null, gsc_sync_id = null, updated_at = now() where website_id = ${w}`],
    ["b", `delete from actions where website_id = ${w} and status in ('prepared', 'awaiting_approval', 'approved')`],
    ["c", `delete from action_learning_snapshots where website_id = ${w}`],
    ["d", `update action_evidence_refs set snapshot = '{}'::jsonb where action_id in (select id from actions where website_id = ${w}) and kind in ('gsc_evidence', 'gsc_sync')`],
    ["e1", `update action_review_evidence_refs set snapshot = '{}'::jsonb where review_id in (select id from action_reviews where website_id = ${w}) and kind in ('gsc_evidence', 'gsc_sync')`],
    ["e2", `update action_reviews set gsc_sync_id = null where website_id = ${w}`],
    ...decisionSteps,
    ["g1", `delete from gsc_search_evidence where website_id = ${w}`],
    ["g2", `delete from gsc_search_syncs where website_id = ${w}`],
  ];
}

function runCleanup(prefix, decisionEngine) {
  for (const [step, sql] of cleanupSteps(websiteId(prefix), decisionEngine)) {
    const result = tryPsql(sql);
    if (!result.ok) {
      return { ok: false, step, error: result.out.split("\n")[0] };
    }
  }
  return { ok: true };
}

function cleanedState(s) {
  const problems = [];
  const expect = (name, actual, wanted) => {
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) problems.push(`${name}=${JSON.stringify(actual)}`);
  };
  expect("actions", s.actions, { blocked: 1, executed: 1, cancelled: 1 });
  expect("actions_with_null_refs", s.actions_with_null_refs, 3);
  expect("attempts", s.attempts, 1);
  expect("verifications", s.verifications, 1);
  expect("google_metric_snapshots", s.google_metric_snapshots, 0);
  expect("analysis_request_reasons", s.analysis_request_reasons, ["google_disconnected"]);
  expect("decision_runs", s.decision_runs, 0);
  expect("decisions", s.decisions, 0);
  expect("gsc_syncs", s.gsc_syncs, 0);
  expect("gsc_evidence", s.gsc_evidence, 0);
  expect("learning_snapshots", s.learning_snapshots, 0);
  expect("targeted_observations", s.targeted_observations, 0);
  expect("research_runs", s.research_runs, 1);
  expect("research_ideas", s.research_ideas, 1);
  return problems;
}

function scenarios() {
  // 1. Existing behavior fails once a targeted observation exists.
  psql("select google_cleanup_gate_seed('legacy', 'analyzed');");
  const legacy = runCleanup("legacy", "legacy");
  check(
    "legacy_order_fails_with_targeted_observation",
    !legacy.ok && legacy.step === "f" && /violates foreign key constraint/.test(legacy.error),
    JSON.stringify(legacy),
  );
  const partial = state("legacy");
  check(
    "legacy_failure_leaves_google_data_behind",
    partial.gsc_syncs === 1 && partial.gsc_evidence === 2 && partial.decision_runs === 3,
    JSON.stringify(partial),
  );

  // 2. Retrying the partially cleaned website with the corrected order completes.
  const recovered = runCleanup("legacy", "corrected");
  const recoveredProblems = cleanedState(state("legacy"));
  check("corrected_order_recovers_partial_cleanup", recovered.ok && recoveredProblems.length === 0, JSON.stringify({ recovered, recoveredProblems }));

  // 3. Corrected order on a fresh website with observation + T1.
  psql("select google_cleanup_gate_seed('analyzed', 'analyzed');");
  const before = state("analyzed");
  check("fixture_has_t0_observation_t1", before.targeted_observations === 1 && before.decision_runs === 3, JSON.stringify(before));
  const analyzed = runCleanup("analyzed", "corrected");
  const analyzedState = state("analyzed");
  const analyzedProblems = cleanedState(analyzedState);
  check("corrected_order_completes_with_targeted_observation", analyzed.ok && analyzedProblems.length === 0, JSON.stringify({ analyzed, analyzedProblems }));
  check(
    "crawl_history_preserved",
    analyzedState.targeted_crawl_runs === before.targeted_crawl_runs && analyzedState.pages === before.pages,
    JSON.stringify({ before, analyzedState }),
  );

  // 4. No targeted observations.
  psql("select google_cleanup_gate_seed('plain', 'none');");
  const plain = runCleanup("plain", "corrected");
  const plainProblems = cleanedState(state("plain"));
  check("corrected_order_completes_without_targeted_observation", plain.ok && plainProblems.length === 0, JSON.stringify({ plain, plainProblems }));

  // 5. Observation still running: deleted, and a late finalize fails closed.
  psql("select google_cleanup_gate_seed('running', 'running');");
  const observation = psql("select v from google_cleanup_gate_ids where k = 'running_observation';");
  const runningCleanup = runCleanup("running", "corrected");
  check("corrected_order_completes_with_running_observation", runningCleanup.ok && cleanedState(state("running")).length === 0, JSON.stringify(runningCleanup));
  const lateFinalize = tryPsql(`select finalize_targeted_observation('${observation}', 'fetch_failed', null, 'interrupted');`);
  const afterFinalize = state("running");
  check(
    "late_finalize_fails_safely_without_recreating_records",
    !lateFinalize.ok && /observation was not found/.test(lateFinalize.out) &&
      afterFinalize.targeted_observations === 0 && afterFinalize.decision_runs === 0 &&
      afterFinalize.gsc_syncs === 0 && afterFinalize.gsc_evidence === 0,
    JSON.stringify({ lateFinalize, afterFinalize }),
  );

  // 6. Cross-website isolation.
  psql("select google_cleanup_gate_seed('isolation_a', 'analyzed');");
  psql("select google_cleanup_gate_seed('isolation_b', 'analyzed');");
  const otherBefore = JSON.stringify(state("isolation_b"));
  const isolation = runCleanup("isolation_a", "corrected");
  const otherAfter = JSON.stringify(state("isolation_b"));
  check(
    "no_cross_website_deletion",
    isolation.ok && cleanedState(state("isolation_a")).length === 0 && otherBefore === otherAfter,
    JSON.stringify({ isolation, otherBefore, otherAfter }),
  );

  // 7. Repeated cleanup remains safe (idempotent no-op).
  const settled = JSON.stringify(state("analyzed"));
  const repeat = runCleanup("analyzed", "corrected");
  check("repeated_cleanup_is_safe", repeat.ok && JSON.stringify(state("analyzed")) === settled, JSON.stringify({ repeat }));

  // 8. Provenance invariants hold globally (untouched website keeps its full chain).
  const globalOrphans = orphans();
  check(
    "no_orphaned_provenance",
    globalOrphans.observations_without_t0 === 0 && globalOrphans.t1_without_observation === 0 &&
      state("isolation_b").targeted_observations === 1 && state("isolation_b").decision_runs === 3,
    JSON.stringify(globalOrphans),
  );
}

async function main() {
  if (!dockerAvailable()) {
    log("GOOGLE_CLEANUP_PG_GATE_BLOCKER=docker CLI/daemon not available");
    process.exit(2);
  }

  try {
    try {
      run("docker", ["rm", "-f", container]);
    } catch {
      // ignore missing container
    }
    run("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", image]);
    waitForPostgres();
    psql(`
      do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    `);
    const applied = applyMigrations();
    log(`APPLIED ${applied} migrations on PostgreSQL ${psql("select current_setting('server_version');")}`);
    psqlFile(sqlFile);
    scenarios();
    const failed = results.filter((result) => result.status !== "PASS");
    log("GOOGLE_CLEANUP_PG_GATE_RESULTS");
    log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length }));
    process.exitCode = failed.length === 0 ? 0 : 1;
  } catch (error) {
    log(`GOOGLE_CLEANUP_PG_GATE_ERROR=${error instanceof Error ? error.message : String(error)}`);
    if (error && typeof error === "object" && "stderr" in error) {
      log(String(error.stderr));
    }
    process.exitCode = 1;
  } finally {
    try {
      run("docker", ["rm", "-f", container]);
    } catch {
      // ignore
    }
  }
}

await main();
