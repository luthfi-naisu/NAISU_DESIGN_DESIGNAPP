#!/usr/bin/env node
/**
 * Verify Supabase connection and create history_logs table if missing.
 * Reads credentials from frontend/.env.local and backend/.env
 *
 * Optional: set SUPABASE_DB_PASSWORD in backend/.env for direct Postgres DDL.
 *
 * Usage: node scripts/setup-supabase.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "frontend/package.json"));
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const frontendEnv = loadEnvFile(join(ROOT, "frontend/.env.local"));
const backendEnv = loadEnvFile(join(ROOT, "backend/.env"));

const SUPABASE_URL =
  frontendEnv.NEXT_PUBLIC_SUPABASE_URL || backendEnv.SUPABASE_URL;
const PUBLISHABLE_KEY =
  frontendEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  backendEnv.SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = backendEnv.SUPABASE_SECRET_KEY;
const DB_PASSWORD =
  backendEnv.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local",
  );
  process.exit(1);
}

const PROJECT_REF =
  SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

const SCHEMA_SQL = readFileSync(
  join(ROOT, "scripts/supabase-schema.sql"),
  "utf8",
);

async function tableExists(client) {
  const { error } = await client.from("history_logs").select("id").limit(1);
  if (!error) return true;
  if (
    error.code === "PGRST205" ||
    error.message?.includes("Could not find the table")
  ) {
    return false;
  }
  throw new Error(`Table check failed: ${error.message}`);
}

async function runSqlViaPostgres() {
  if (!DB_PASSWORD) {
    return { ok: false, reason: "No SUPABASE_DB_PASSWORD in backend/.env" };
  }

  let pg;
  try {
    pg = require("pg");
  } catch {
    return {
      ok: false,
      reason: "pg package not installed (npm install pg --prefix frontend)",
    };
  }

  const hosts = [
    `db.${PROJECT_REF}.supabase.co`,
    `aws-0-ap-southeast-1.pooler.supabase.com`,
    `aws-0-ap-southeast-2.pooler.supabase.com`,
  ];

  for (const host of hosts) {
    const client = new pg.Client({
      host,
      port: host.startsWith("db.") ? 5432 : 6543,
      user: host.startsWith("db.")
        ? "postgres"
        : `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      await client.query(SCHEMA_SQL);
      await client.end();
      return { ok: true, host };
    } catch (err) {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      if (host === hosts[hosts.length - 1]) {
        return { ok: false, reason: err.message };
      }
    }
  }

  return { ok: false, reason: "Could not connect to Postgres" };
}

async function main() {
  console.log("Supabase project:", SUPABASE_URL);

  const publishableClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

  if (!(await tableExists(publishableClient))) {
    console.log("Table history_logs not found — applying schema via Postgres...");
    const result = await runSqlViaPostgres();
    if (!result.ok) {
      console.log("\nCould not auto-apply schema.");
      console.log("Reason:", result.reason);
      console.log("\nManual step:");
      console.log(
        `1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`,
      );
      console.log("2. Paste and run scripts/supabase-schema.sql");
      console.log(
        "3. Re-run: node scripts/setup-supabase.mjs",
      );
      process.exit(1);
    }
    console.log(`✓ Schema applied via Postgres (${result.host})`);

    if (!(await tableExists(publishableClient))) {
      console.error("Schema ran but table still missing — refresh schema cache in Supabase.");
      process.exit(1);
    }
  } else {
    console.log("✓ Table history_logs already exists");
  }

  const { data, error } = await publishableClient
    .from("history_logs")
    .insert({
      type: "upload-mp4",
      status: "done",
      title: "Supabase connection test",
      input_summary: "setup-supabase.mjs",
    })
    .select()
    .single();

  if (error) {
    console.error("Insert test failed:", error.message);
    process.exit(1);
  }

  await publishableClient.from("history_logs").delete().eq("id", data.id);
  console.log("✓ Insert/delete test passed");
  console.log("\nSupabase is connected and ready for History Logs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
