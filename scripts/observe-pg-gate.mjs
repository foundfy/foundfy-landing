#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const container = "foundfy-observe-pg-gate-026";
const image = "postgres:16-alpine";
const sqlFile = path.join(root, "scripts/observe-pg-gate.sql");

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
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function psql(sql, extraArgs = []) {
  return run("docker", [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    ...extraArgs,
    "-c",
    sql,
  ]);
}

function psqlFile(filePath) {
  return run("docker", [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "-",
  ], { input: readFileSync(filePath, "utf8") });
}

function sleep(ms) {
  execFileSync("sleep", [String(ms / 1000)]);
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
    log(`APPLY ${name}`);
    psqlFile(path.join(dir, name));
  }
}

function spawnPsql(sql) {
  return spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
}

function collect(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr || stdout || `psql exited ${code}`));
    });
  });
}

function jsonFromPsql(text, which = "last") {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"));
  const picked = which === "first" ? lines.at(0) : lines.at(-1);
  if (!picked) {
    throw new Error(`no JSON payload in psql output: ${text}`);
  }
  return JSON.parse(picked);
}

async function concurrency() {
  const ids = {};
  for (const line of psql(
    "select k || '=' || v::text from observe_gate_ctx order by k;",
    ["-At"],
  )
    .trim()
    .split("\n")
    .filter(Boolean)) {
    const eq = line.indexOf("=");
    ids[line.slice(0, eq)] = line.slice(eq + 1);
  }
  for (const line of psql(
    "select k || '=' || v from observe_gate_text order by k;",
    ["-At"],
  )
    .trim()
    .split("\n")
    .filter(Boolean)) {
    const eq = line.indexOf("=");
    ids[line.slice(0, eq)] = line.slice(eq + 1);
  }

  const claimSql = (website, crawl, queue, inspect, urlKey, owner) =>
    `select public.claim_targeted_observation('${website}'::uuid,'${crawl}'::uuid,'${queue}'::uuid,'${inspect}'::uuid,'${urlKey}','${owner}'::uuid,'owner_selected');`;

  log("CONCURRENCY same-candidate claims");
  const sameA = spawnPsql(
    claimSql(ids.b_website, ids.b_crawl, ids.b_queue1, ids.b_inspect1, ids.b_url_key, ids.b_owner),
  );
  const sameB = spawnPsql(
    claimSql(ids.b_website, ids.b_crawl, ids.b_queue1, ids.b_inspect1, ids.b_url_key, ids.b_owner),
  );
  const sameResults = await Promise.all([collect(sameA), collect(sameB)]);
  const sameStatuses = sameResults.map((row) => jsonFromPsql(row).status).sort();
  if (!(sameStatuses.includes("claimed") && sameStatuses.includes("already_running"))) {
    throw new Error(`same-candidate concurrency unexpected: ${sameResults.join(" | ")}`);
  }
  const runningSame = Number(psql(
    `select count(*) from targeted_observations where website_id='${ids.b_website}' and status='running';`,
    ["-At"],
  ).trim());
  const crawlsSame = Number(psql(
    `select count(*) from crawl_runs where website_id='${ids.b_website}' and purpose='targeted_observe';`,
    ["-At"],
  ).trim());
  const orphan = psql(
    `select count(*) from crawl_runs where website_id='${ids.b_website}' and purpose='targeted_observe' and id not in (select targeted_crawl_run_id from targeted_observations);`,
    ["-At"],
  ).trim();
  if (runningSame !== 1 || crawlsSame !== 1 || orphan !== "0") {
    throw new Error(`same-candidate concurrency row counts running=${runningSame} crawls=${crawlsSame} orphan=${orphan}`);
  }
  psql(
    `insert into observe_gate_results(test, status, detail) values ('claim_concurrent_same','PASS', '${sameStatuses.join(",")}') on conflict (test) do update set status=excluded.status, detail=excluded.detail;`,
  );

  log("CONCURRENCY different-candidate claims");
  const diffA = spawnPsql(
    claimSql(ids.e_website, ids.e_crawl, ids.e_queue1, ids.e_inspect1, ids.e_url_key, ids.e_owner),
  );
  const diffB = spawnPsql(
    claimSql(ids.e_website, ids.e_crawl, ids.e_queue2, ids.e_inspect1, ids.e_url_key_2, ids.e_owner),
  );
  const diffResults = await Promise.all([collect(diffA), collect(diffB)]);
  const diffStatuses = diffResults.map((row) => jsonFromPsql(row).status).sort();
  if (!(diffStatuses.includes("claimed") && diffStatuses.includes("already_running"))) {
    throw new Error(`different-candidate concurrency unexpected: ${diffResults.join(" | ")}`);
  }
  const runningDiff = Number(psql(
    `select count(*) from targeted_observations where website_id='${ids.e_website}' and status='running';`,
    ["-At"],
  ).trim());
  const orphanDiff = psql(
    `select count(*) from crawl_runs where website_id='${ids.e_website}' and purpose='targeted_observe' and id not in (select targeted_crawl_run_id from targeted_observations);`,
    ["-At"],
  ).trim();
  if (runningDiff !== 1 || orphanDiff !== "0") {
    throw new Error(`different-candidate concurrency running=${runningDiff} orphan=${orphanDiff}`);
  }
  psql(
    `insert into observe_gate_results(test, status, detail) values ('claim_concurrent_diff','PASS', '${diffStatuses.join(",")}') on conflict (test) do update set status=excluded.status, detail=excluded.detail;`,
  );
  const eRunning = JSON.parse(psql(
    `select jsonb_build_object('id', id, 'crawl', targeted_crawl_run_id) from targeted_observations where website_id='${ids.e_website}' and status='running' limit 1;`,
    ["-At"],
  ).trim());
  psql(`
    insert into pages (crawl_run_id, website_id, requested_url, final_url, title)
    select '${eRunning.crawl}'::uuid, website_id, requested_url, requested_url, 'Diff'
      from targeted_observations where id = '${eRunning.id}'::uuid;
  `);
  const ePageId = psql(
    `select id from pages where crawl_run_id='${eRunning.crawl}'::uuid limit 1;`,
    ["-At"],
  ).trim();

  log("CONCURRENCY claim-first then finalize");
  const claimHolder = spawnPsql(`
    begin;
    select public.claim_targeted_observation('${ids.e_website}'::uuid,'${ids.e_crawl}'::uuid,'${ids.e_queue1}'::uuid,'${ids.e_inspect1}'::uuid,'${ids.e_url_key}','${ids.e_owner}'::uuid,'owner_selected');
    select pg_sleep(1.5);
    commit;
  `);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const finalizeWaiter = spawnPsql(
    `select public.finalize_targeted_observation('${eRunning.id}'::uuid,'analyzed','${ePageId}'::uuid,null);`,
  );
  const [claimFirstOut, finalizeAfterOut] = await Promise.all([
    collect(claimHolder),
    collect(finalizeWaiter),
  ]);
  const claimFirstStatus = jsonFromPsql(claimFirstOut, "first").status;
  const finalizeAfterStatus = jsonFromPsql(finalizeAfterOut).status;
  if (claimFirstStatus !== "already_running") {
    throw new Error(`claim-first expected already_running, got ${claimFirstOut} / ${finalizeAfterOut}`);
  }
  if (finalizeAfterStatus !== "analyzed") {
    throw new Error(`claim-first finalize expected analyzed, got ${finalizeAfterOut}`);
  }
  const eRunningAfter = psql(
    `select count(*) from targeted_observations where website_id='${ids.e_website}' and status='running';`,
    ["-At"],
  ).trim();
  if (eRunningAfter !== "0") {
    throw new Error("claim-first left a running observation");
  }
  psql(
    `insert into observe_gate_results(test, status, detail) values ('claim_first_finalize_race','PASS', '${claimFirstStatus},${finalizeAfterStatus}') on conflict (test) do update set status=excluded.status, detail=excluded.detail;`,
  );

  const running = JSON.parse(psql(
    `select jsonb_build_object('id', id, 'crawl', targeted_crawl_run_id) from targeted_observations where website_id='${ids.b_website}' and status='running' limit 1;`,
    ["-At"],
  ).trim());

  log("CONCURRENCY finalize analyzed vs claim");
  psql(`
    insert into pages (crawl_run_id, website_id, requested_url, final_url, title)
    select '${running.crawl}'::uuid, website_id, requested_url, requested_url, 'Pintar'
      from targeted_observations
     where id = '${running.id}'::uuid;
  `);
  const pageId = psql(
    `select id from pages where crawl_run_id='${running.crawl}'::uuid limit 1;`,
    ["-At"],
  ).trim();

  const finalizeHolder = spawnPsql(`
    begin;
    select public.finalize_targeted_observation('${running.id}'::uuid,'analyzed','${pageId}'::uuid,null);
    select pg_sleep(1.5);
    commit;
  `);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const claimWaiter = spawnPsql(
    claimSql(ids.b_website, ids.b_crawl, ids.b_queue1, ids.b_inspect1, ids.b_url_key, ids.b_owner),
  );
  const [finalizeOut, claimOut] = await Promise.all([
    collect(finalizeHolder),
    collect(claimWaiter),
  ]);
  const claimStatus = jsonFromPsql(claimOut).status;
  if (claimStatus !== "reused") {
    throw new Error(`claim vs finalize expected reused, got ${claimOut} / ${finalizeOut}`);
  }
  const runningCount = psql(
    `select count(*) from targeted_observations where website_id='${ids.b_website}' and status='running';`,
    ["-At"],
  ).trim();
  if (runningCount !== "0") {
    throw new Error("claim vs finalize left a running observation");
  }
  psql(
    `insert into observe_gate_results(test, status, detail) values ('claim_finalize_analyzed_race','PASS', '${claimStatus}') on conflict (test) do update set status=excluded.status, detail=excluded.detail;`,
  );

  log("CONCURRENCY fetch_failed vs later claim");
  const failedClaim = JSON.parse(
    psql(
      claimSql(ids.b_website, ids.b_crawl, ids.b_queue2, ids.b_inspect1, ids.b_url_key_2, ids.b_owner),
      ["-At"],
    ).trim(),
  );
  if (failedClaim.status !== "claimed") {
    throw new Error(`expected claimed after analyzed A, got ${JSON.stringify(failedClaim)}`);
  }
  const failHolder = spawnPsql(`
    begin;
    select public.finalize_targeted_observation('${failedClaim.observation_id}'::uuid,'fetch_failed',null,'interrupted');
    select pg_sleep(1.2);
    commit;
  `);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const claimDuringFail = spawnPsql(
    claimSql(ids.b_website, ids.b_crawl, ids.b_queue2, ids.b_inspect1, ids.b_url_key_2, ids.b_owner),
  );
  const [, duringFailOut] = await Promise.all([collect(failHolder), collect(claimDuringFail)]);
  const duringFailStatus = jsonFromPsql(duringFailOut).status;
  if (!["claimed", "already_running"].includes(duringFailStatus)) {
    throw new Error(`fetch_failed race unexpected ${duringFailOut}`);
  }
  const active = psql(
    `select count(*) from targeted_observations where website_id='${ids.b_website}' and status='running';`,
    ["-At"],
  ).trim();
  if (Number(active) > 1) {
    throw new Error("more than one running observation after fetch_failed race");
  }
  const orphans = psql(
    `select count(*) from crawl_runs where website_id='${ids.b_website}' and purpose='targeted_observe' and id not in (select targeted_crawl_run_id from targeted_observations);`,
    ["-At"],
  ).trim();
  if (orphans !== "0") {
    throw new Error("orphan targeted crawl after fetch_failed race");
  }
  psql(
    `insert into observe_gate_results(test, status, detail) values ('claim_finalize_failed_race','PASS', '${duringFailStatus}') on conflict (test) do update set status=excluded.status, detail=excluded.detail;`,
  );
}

async function main() {
  const summary = {
    claim: "NOT RUN",
    concurrency: "NOT RUN",
    finalize: "NOT RUN",
    t1: "NOT RUN",
    catalog: "NOT RUN",
    website_delete: "NOT RUN",
  };

  if (!dockerAvailable()) {
    log("OBSERVE_PG_GATE_BLOCKER=docker CLI/daemon not available");
    log(JSON.stringify(summary));
    process.exit(2);
  }

  try {
    try {
      run("docker", ["rm", "-f", container]);
    } catch {
      // ignore missing container
    }
    run("docker", [
      "run",
      "-d",
      "--name",
      container,
      "-e",
      "POSTGRES_PASSWORD=postgres",
      image,
    ]);
    waitForPostgres();
    psql(`
      do $$ begin
        create role service_role nologin;
      exception when duplicate_object then null;
      end $$;
      do $$ begin
        create role anon nologin;
      exception when duplicate_object then null;
      end $$;
      do $$ begin
        create role authenticated nologin;
      exception when duplicate_object then null;
      end $$;
    `);
    applyMigrations();
    log("APPLY observe-pg-gate.sql");
    psqlFile(sqlFile);
    summary.claim = psql("select status from observe_gate_results where test='claim_suite';", ["-At"]).trim() || "FAIL";
    summary.finalize = psql("select status from observe_gate_results where test='finalize_suite';", ["-At"]).trim() || "FAIL";
    summary.t1 = psql("select status from observe_gate_results where test='t1_suite';", ["-At"]).trim() || "FAIL";
    summary.catalog = psql("select status from observe_gate_results where test='catalog_suite';", ["-At"]).trim() || "FAIL";
    summary.website_delete = psql("select status from observe_gate_results where test='website_delete';", ["-At"]).trim() || "FAIL";
    await concurrency();
    summary.concurrency = "PASS";
    log("OBSERVE_PG_GATE_RESULTS");
    log(psql("select test, status, coalesce(detail,'') from observe_gate_results order by test;"));
    log(JSON.stringify(summary));
    const failed = Object.values(summary).some((value) => value !== "PASS" && value !== "FAIL_EXPECTED_RESTRICT");
    process.exitCode = failed && summary.website_delete !== "FAIL" ? 1 : 0;
    if (
      summary.claim !== "PASS" ||
      summary.finalize !== "PASS" ||
      summary.t1 !== "PASS" ||
      summary.catalog !== "PASS" ||
      summary.concurrency !== "PASS"
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    log(`OBSERVE_PG_GATE_ERROR=${error instanceof Error ? error.message : String(error)}`);
    if (error && typeof error === "object" && "stderr" in error) {
      log(String(error.stderr));
    }
    log(JSON.stringify(summary));
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
