#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const container = "foundfy-research-pg-gate-027";
const image = "postgres:16-alpine";
const sqlFile = path.join(root, "scripts/research-027-pg-gate.sql");

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

async function main() {
  if (!dockerAvailable()) {
    log("RESEARCH_027_PG_GATE_SKIP=docker_unavailable");
    process.exitCode = 1;
    return;
  }

  try {
    run("docker", ["rm", "-f", container], { stdio: "ignore" });
  } catch {
    // ignore
  }

  try {
    run("docker", [
      "run",
      "--rm",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-d",
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
    log("APPLY research-027-pg-gate.sql");
    psqlFile(sqlFile);
    const results = psql(
      "select test || '=' || status from research_027_gate_results order by test;",
      ["-At"],
    );
    log("RESEARCH_027_PG_GATE_RESULTS");
    log(results);
    const failed = results
      .trim()
      .split("\n")
      .filter(Boolean)
      .some((line) => !line.endsWith("=PASS"));
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    log(`RESEARCH_027_PG_GATE_ERROR=${error instanceof Error ? error.message : String(error)}`);
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
