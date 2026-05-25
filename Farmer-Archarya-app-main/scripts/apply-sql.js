#!/usr/bin/env node
// Apply SQL files to Supabase through the Supabase Management API.
// Usage:
//   SUPABASE_PAT=sbp_... SUPABASE_PROJECT_REF=projectref node scripts/apply-sql.js supabase/migrations/001_farmer_initial_schema.sql

const fs = require("fs");
const path = require("path");
const https = require("https");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

const localEnv = readEnvFile(path.resolve(".env.local"));
const PAT = process.env.SUPABASE_PAT;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || "";
const refFromUrl = (() => {
  try { return new URL(url).host.split(".")[0]; } catch { return ""; }
})();
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || refFromUrl;

if (!PAT) {
  console.error("SUPABASE_PAT env required. Create a Supabase personal access token and rerun.");
  process.exit(1);
}
if (!PROJECT_REF) {
  console.error("SUPABASE_PROJECT_REF env required, or set NEXT_PUBLIC_SUPABASE_URL in .env.local.");
  process.exit(1);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/apply-sql.js <file.sql> ...");
  process.exit(1);
}

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      method: "POST",
      host: "api.supabase.com",
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const file of files) {
    const full = path.resolve(file);
    const sql = fs.readFileSync(full, "utf8");
    console.log(`\nApplying ${file} (${sql.length} bytes) to ${PROJECT_REF}`);
    const { status, body } = await query(sql);
    if (status >= 200 && status < 300) {
      console.log(`${status} OK`);
    } else {
      console.error(`${status}: ${body.slice(0, 1200)}`);
      process.exit(1);
    }
  }

  const verify = `select
    (select count(*) from public.farmer_modules) as modules,
    (select count(*) from public.farmer_sections) as sections,
    (select count(*) from public.farmer_users) as users;`;
  const { status, body } = await query(verify);
  console.log(`\nVerify ${status}: ${body}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

